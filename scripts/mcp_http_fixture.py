#!/usr/bin/env python3
"""A dependency-free Streamable HTTP MCP and OAuth fixture for local UI work."""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import secrets
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

HOST = "127.0.0.1"
PORT = 3920
PROTOCOL_VERSION = "2025-11-25"
BEARER_TOKEN = "ui-fixture-token"
API_KEY = "ui-fixture-key"
REGISTERED_CLIENT_ID = "ui-fixture-client"
RESOURCE_TEXT = "This is a sample MCP resource served by the Python UI fixture."

# Each mode has an independent resource URL and issuer so one local process can
# demonstrate every HTTP auth shape at once.
OAUTH_MODES = {"oauth-dcr", "oauth-cimd", "oauth-client", "oauth-client-credentials"}
KNOWN_PATHS = {
    "/mcp", "/mcp/bearer", "/mcp/header", "/mcp/proxy",
    *(f"/mcp/{mode}" for mode in OAUTH_MODES), "/mcp/ema",
}
ID_JAG_TYPE = "urn:ietf:params:oauth:token-type:id-jag"
JWT_BEARER_GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer"
TOKEN_EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange"


def json_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False).encode("utf-8")


def b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


class FixtureState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.clients: set[str] = {REGISTERED_CLIENT_ID}
        self.codes: dict[str, dict[str, str]] = {}
        self.tokens: set[str] = set()

    def register_client(self) -> str:
        client_id = "fixture-" + secrets.token_urlsafe(8)
        with self.lock:
            self.clients.add(client_id)
        return client_id

    def issue_code(self, fields: dict[str, str]) -> str:
        code = secrets.token_urlsafe(24)
        with self.lock:
            self.codes[code] = fields
        return code

    def redeem_code(self, code: str) -> dict[str, str] | None:
        with self.lock:
            return self.codes.pop(code, None)

    def issue_token(self) -> str:
        token = "fixture-access-" + secrets.token_urlsafe(18)
        with self.lock:
            self.tokens.add(token)
        return token


STATE = FixtureState()


class Handler(BaseHTTPRequestHandler):
    server_version = "RuxexMcpUiFixture/1.0"

    def log_message(self, format: str, *args: Any) -> None:
        if os.environ.get("MCP_FIXTURE_VERBOSE"):
            super().log_message(format, *args)

    @property
    def origin(self) -> str:
        host = self.headers.get("Host", f"{HOST}:{self.server.server_port}")
        return f"http://{host}"

    def send_json(self, status: int, value: Any, headers: dict[str, str] | None = None) -> None:
        body = json_bytes(value)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, status: int, value: str, content_type: str = "text/plain; charset=utf-8") -> None:
        body = value.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Allow", "GET, POST, OPTIONS")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        path = urllib.parse.urlsplit(self.path).path
        if path.startswith("/.well-known/oauth-protected-resource"):
            mode = path.removeprefix("/.well-known/oauth-protected-resource").lstrip("/")
            self.protected_resource_metadata("/" + mode if mode else "/mcp")
        elif path.startswith("/.well-known/oauth-authorization-server"):
            mode = path.removeprefix("/.well-known/oauth-authorization-server").lstrip("/")
            self.authorization_server_metadata(mode)
        elif path.startswith("/oauth/") and path.endswith("/authorize"):
            self.authorize()
        elif path == "/oauth/callback":
            self.oauth_callback()
        elif path.startswith("/oauth/client-metadata/"):
            self.client_metadata(path.rsplit("/", 1)[-1])
        elif path == "/health":
            self.send_json(200, {"status": "ok", "mcp": sorted(KNOWN_PATHS)})
        else:
            self.send_text(404, "not found")

    def do_POST(self) -> None:
        path = urllib.parse.urlsplit(self.path).path
        if path == "/oauth/ema/idp/token":
            self.ema_idp_token()
            return
        if path == "/oauth/ema/resource/token":
            self.ema_resource_token()
            return
        if path.startswith("/oauth/") and path.endswith("/register"):
            self.register_client()
            return
        if path.startswith("/oauth/") and path.endswith("/token"):
            self.token()
            return
        if path.startswith("/test/control/"):
            self.send_response(204)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if path in KNOWN_PATHS:
            self.mcp(path)
            return
        self.send_json(404, {"error": "not_found"})

    def protected_resource_metadata(self, resource_path: str) -> None:
        resource_url = self.origin + resource_path
        self.send_json(200, {
            "resource": resource_url,
            "authorization_servers": [resource_url],
            "scopes_supported": [""],
        })

    def authorization_server_metadata(self, mode: str) -> None:
        # Discovery's issuer is a stable URL and is returned in auth responses
        # for RFC 9207 issuer validation.
        mode = mode.rsplit("/", 1)[-1]
        if mode == "idp":
            self.send_json(200, {
                "issuer": self.origin + "/idp",
                "token_endpoint": self.origin + "/oauth/ema/idp/token",
                "grant_types_supported": [TOKEN_EXCHANGE_GRANT],
                "authorization_grant_profiles_supported": ["urn:ietf:params:oauth:grant-profile:id-jag"],
                "token_endpoint_auth_methods_supported": ["none"],
            })
            return
        if mode == "ema-as":
            self.send_json(200, {
                "issuer": self.origin + "/ema-as",
                "token_endpoint": self.origin + "/oauth/ema/resource/token",
                "grant_types_supported": [JWT_BEARER_GRANT],
                "token_endpoint_auth_methods_supported": ["none"],
            })
            return
        issuer = self.origin + "/mcp/" + mode
        oauth_prefix = "/oauth/" + mode
        value: dict[str, Any] = {
            "issuer": issuer,
            "authorization_endpoint": self.origin + oauth_prefix + "/authorize",
            "token_endpoint": self.origin + oauth_prefix + "/token",
            "scopes_supported": [""],
            "response_types_supported": ["code"],
            "response_modes_supported": ["query"],
            "grant_types_supported": ["authorization_code", "refresh_token", "client_credentials"],
            "code_challenge_methods_supported": ["S256"],
            "token_endpoint_auth_methods_supported": ["none"],
        }
        if mode == "oauth-dcr":
            value["registration_endpoint"] = self.origin + oauth_prefix + "/register"
        elif mode == "oauth-cimd":
            value["client_id_metadata_document_supported"] = True
        self.send_json(200, value)

    def authorize(self) -> None:
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        required = ("client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method")
        if any(not query.get(key) for key in required):
            self.send_text(400, "Missing OAuth authorization parameters")
            return
        client_id = query["client_id"][0]
        with STATE.lock:
            known = client_id in STATE.clients
        if not known and not client_id.startswith("http"):
            self.send_text(400, "Unknown client_id; register it first")
            return
        if query["code_challenge_method"][0] != "S256":
            self.send_text(400, "Only PKCE S256 is supported")
            return
        csrf_state = query["state"][0]
        redirect_uri = query["redirect_uri"][0]
        code_challenge = query["code_challenge"][0]
        code = STATE.issue_code({
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "code_challenge": code_challenge,
        })
        callback = urllib.parse.urlsplit(redirect_uri)
        params = urllib.parse.parse_qsl(callback.query, keep_blank_values=True)
        mode = urllib.parse.urlsplit(self.path).path.split("/")[2]
        issuer = self.origin + "/mcp/" + mode
        params.extend([("code", code), ("state", csrf_state), ("iss", issuer)])
        target = urllib.parse.urlunsplit((callback.scheme, callback.netloc, callback.path,
                                         urllib.parse.urlencode(params), callback.fragment))
        self.send_response(302)
        self.send_header("Location", target)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def oauth_callback(self) -> None:
        self.send_text(200, "OAuth callback reached. You can close this page.")

    def register_client(self) -> None:
        data = self.read_form()
        client_id = STATE.register_client()
        redirect_uris = data.get("redirect_uris", "[]")
        if isinstance(redirect_uris, str):
            try:
                redirect_uris = json.loads(redirect_uris)
            except json.JSONDecodeError:
                redirect_uris = []
        self.send_json(201, {
            "client_id": client_id,
            "client_name": data.get("client_name", "MCP UI Fixture"),
            "redirect_uris": redirect_uris,
            "token_endpoint_auth_method": "none",
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
        })

    def client_metadata(self, client_id: str) -> None:
        self.send_json(200, {
            "client_id": self.origin + "/oauth/client-metadata/" + client_id,
            "client_name": "MCP UI Fixture Client",
            "redirect_uris": [self.origin + "/oauth/callback"],
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "none",
        })

    def read_form(self) -> dict[str, str]:
        size = min(int(self.headers.get("Content-Length", "0")), 1024 * 1024)
        raw = self.rfile.read(size).decode("utf-8", errors="replace")
        if "application/json" in self.headers.get("Content-Type", ""):
            try:
                value = json.loads(raw)
                return {key: json.dumps(item) if isinstance(item, list) else str(item)
                        for key, item in value.items()}
            except (json.JSONDecodeError, AttributeError):
                return {}
        return {key: values[-1] for key, values in urllib.parse.parse_qs(raw).items()}

    def token(self) -> None:
        form = self.read_form()
        grant_type = form.get("grant_type", "")
        if grant_type == "authorization_code":
            fields = STATE.redeem_code(form.get("code", ""))
            verifier = form.get("code_verifier", "")
            digest = b64url(hashlib.sha256(verifier.encode()).digest())
            if (fields is None or form.get("client_id") != fields["client_id"]
                    or form.get("redirect_uri") != fields["redirect_uri"]
                    or not secrets.compare_digest(digest, fields["code_challenge"])):
                self.send_json(400, {"error": "invalid_grant", "error_description": "code or PKCE verifier is invalid"})
                return
            self.send_token_response()
        elif grant_type == "client_credentials":
            client_id = form.get("client_id", "")
            with STATE.lock:
                valid_client = client_id in STATE.clients or client_id == REGISTERED_CLIENT_ID
            if not valid_client:
                self.send_json(401, {"error": "invalid_client"})
                return
            self.send_token_response()
        elif grant_type == "refresh_token":
            self.send_json(400, {"error": "invalid_grant", "error_description": "refresh token expired or revoked"})
        else:
            self.send_json(400, {"error": "unsupported_grant_type"})

    def send_token_response(self) -> None:
        self.send_json(200, {
            "access_token": STATE.issue_token(),
            "token_type": "Bearer",
            "expires_in": 3600,
            "refresh_token": "fixture-refresh-" + secrets.token_urlsafe(12),
            "scope": "",
        })

    def ema_idp_token(self) -> None:
        form = self.read_form()
        if form.get("grant_type") != TOKEN_EXCHANGE_GRANT or form.get("requested_token_type") != ID_JAG_TYPE:
            self.send_json(400, {"error": "unsupported_grant_type"})
            return
        resource = form.get("resource", "")
        claims = {
            "iss": self.origin + "/idp",
            "sub": form.get("subject_token", "fixture-user"),
            "aud": form.get("client_id", ""),
            "exp": int(time.time()) + 3600,
            "resource": resource,
        }
        if form.get("scope"):
            claims["scope"] = form["scope"]
        header = b64url(json_bytes({"alg": "ES256", "typ": "oauth-id-jag+jwt"}))
        assertion = f"{header}.{b64url(json_bytes(claims))}.fixture-signature"
        response: dict[str, Any] = {
            "access_token": assertion,
            "issued_token_type": ID_JAG_TYPE,
            "token_type": "N_A",
            "resource": resource,
        }
        if form.get("scope"):
            response["scope"] = form["scope"]
        self.send_json(200, response)

    def ema_resource_token(self) -> None:
        form = self.read_form()
        if form.get("grant_type") != JWT_BEARER_GRANT or not form.get("assertion"):
            self.send_json(400, {"error": "unsupported_grant_type"})
            return
        self.send_json(200, {
            "access_token": STATE.issue_token(),
            "issued_token_type": "urn:ietf:params:oauth:token-type:access_token",
            "token_type": "Bearer",
            "expires_in": 3600,
            "resource": self.origin + "/mcp/ema",
        })

    def mcp(self, path: str) -> None:
        mode = path.rsplit("/", 1)[-1] if path.count("/") > 1 else "none"
        auth_error = self.authorize_mcp_request(mode)
        if auth_error:
            self.send_json(401, {"error": "unauthorized"}, {
                "WWW-Authenticate": f'Bearer resource_metadata="{self.origin}/.well-known/oauth-protected-resource{path}"'
            })
            return
        length = min(int(self.headers.get("Content-Length", "0")), 1024 * 1024)
        try:
            request = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self.send_json(400, {"error": "invalid_json"})
            return
        if not isinstance(request, dict):
            self.send_json(400, {"error": "invalid_request"})
            return
        method = request.get("method")
        if method == "notifications/initialized" or method == "notifications/cancelled":
            self.send_response(202)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        result: Any
        if method == "initialize":
            result = {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {"tools": {"listChanged": True}, "resources": {"subscribe": False, "listChanged": False}},
                "serverInfo": {"name": "ruxex-python-mcp-fixture", "version": "1.0.0"},
            }
        elif method == "ping":
            result = {}
        elif method == "tools/list":
            result = {"tools": [{
                "name": "echo",
                "description": "Echo back the message and include fixture environment data.",
                "inputSchema": {"type": "object", "properties": {
                    "message": {"type": "string"}, "text": {"type": "string"},
                    "env_var": {"type": "string"}},
                    "anyOf": [{"required": ["message"]}, {"required": ["text"]}],
                    "additionalProperties": False},
                "outputSchema": {"type": "object", "properties": {
                    "echo": {"type": "string"}, "env": {"type": ["string", "null"]}},
                    "required": ["echo", "env"], "additionalProperties": False},
                "annotations": {"readOnlyHint": True},
            }]}
        elif method == "tools/call":
            params = request.get("params", {})
            if params.get("name") != "echo":
                self.send_rpc_error(request.get("id"), -32602, "unknown tool")
                return
            args = params.get("arguments", {})
            message = args.get("message", args.get("text"))
            if not isinstance(message, str):
                self.send_rpc_error(request.get("id"), -32602, "message must be a string")
                return
            result = {"content": [], "structuredContent": {
                "echo": "ECHOING: " + message,
                "env": os.environ.get(args.get("env_var", "MCP_TEST_VALUE")),
            }, "isError": False}
        elif method == "resources/list":
            result = {"resources": [{"uri": "memo://ruxex/example-note", "name": "example-note",
                "title": "Example Note", "description": "A sample MCP resource exposed for UI fixtures.", "mimeType": "text/plain"}]}
        elif method == "resources/templates/list":
            result = {"resourceTemplates": [{"uriTemplate": "memo://ruxex/{slug}", "name": "ruxex-memo",
                "title": "Ruxex Memo", "description": "Template for memo://ruxex/{slug} resources.", "mimeType": "text/plain"}]}
        elif method == "resources/read":
            if request.get("params", {}).get("uri") != "memo://ruxex/example-note":
                self.send_rpc_error(request.get("id"), -32002, "resource not found")
                return
            result = {"contents": [{"uri": "memo://ruxex/example-note", "mimeType": "text/plain", "text": RESOURCE_TEXT}]}
        else:
            self.send_rpc_error(request.get("id"), -32601, "method not found")
            return
        if "id" not in request:
            self.send_response(202)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        self.send_json(200, {"jsonrpc": "2.0", "id": request["id"], "result": result}, {
            "MCP-Protocol-Version": self.headers.get("MCP-Protocol-Version", PROTOCOL_VERSION),
        })

    def send_rpc_error(self, request_id: Any, code: int, message: str) -> None:
        self.send_json(200, {"jsonrpc": "2.0", "id": request_id,
            "error": {"code": code, "message": message}})

    def authorize_mcp_request(self, mode: str) -> bool:
        if mode == "bearer":
            expected = "Bearer " + os.environ.get("MCP_FIXTURE_BEARER_TOKEN", BEARER_TOKEN)
            return not secrets.compare_digest(self.headers.get("Authorization", ""), expected)
        if mode == "header":
            expected = os.environ.get("MCP_FIXTURE_API_KEY", API_KEY)
            return not secrets.compare_digest(self.headers.get("X-API-Key", ""), expected)
        if mode == "proxy":
            expected = os.environ.get(
                "MCP_FIXTURE_PROXY_HEADER",
                "Bearer " + os.environ.get("MCP_FIXTURE_PROXY_TOKEN", BEARER_TOKEN),
            )
            return not secrets.compare_digest(self.headers.get("Proxy-Authorization", ""), expected)
        if mode in OAUTH_MODES or mode == "ema":
            authorization = self.headers.get("Authorization", "")
            prefix, _, token = authorization.partition(" ")
            with STATE.lock:
                valid_token = token in STATE.tokens
            return prefix.lower() != "bearer" or not valid_token
        return False


def print_config_examples() -> None:
    base = f"http://{HOST}:{PORT}"
    examples = {
        "none": {"url": base + "/mcp"},
        "bearer": {"url": base + "/mcp/bearer", "bearer_token_env_var": "MCP_FIXTURE_BEARER_TOKEN"},
        "custom header": {"url": base + "/mcp/header", "http_headers": {"X-API-Key": "ui-fixture-key"}},
        "environment header": {"url": base + "/mcp/header", "env_http_headers": {"X-API-Key": "MCP_FIXTURE_API_KEY"}},
        "proxy bearer": {"url": base + "/mcp/proxy", "env_http_headers": {"Proxy-Authorization": "MCP_FIXTURE_PROXY_HEADER"}},
        "OAuth via DCR": {"url": base + "/mcp/oauth-dcr", "auth": "oauth"},
        "OAuth via CIMD": {"url": base + "/mcp/oauth-cimd", "auth": "oauth"},
        "pre-registered OAuth": {"url": base + "/mcp/oauth-client", "auth": "oauth", "oauth": {"client_id": REGISTERED_CLIENT_ID}},
        "client credentials": {
            "url": base + "/mcp/oauth-client-credentials",
            "auth": "oauth",
            "oauth": {"client_id": REGISTERED_CLIENT_ID},
        },
        "EMA": {
            "mcp_enterprise_managed_auth": {
                "idp": {"issuer": base + "/idp", "client_id": "ui-fixture-idp-client"},
            },
            "mcp_servers": {
                "ui-fixture-ema": {
                    "url": base + "/mcp/ema",
                    "auth": "ema_auth",
                    "oauth": {
                        "client_id": "ui-fixture-mcp-client",
                        "authorization_server_issuer": base + "/ema-as",
                    },
                },
            },
        },
    }
    print(json.dumps(examples, indent=2, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    bind_addr = os.environ.get("MCP_STREAMABLE_HTTP_BIND_ADDR", f"{HOST}:{PORT}")
    default_host, _, default_port = bind_addr.rpartition(":")
    parser.add_argument("--host", default=os.environ.get("MCP_STREAMABLE_HTTP_BIND_HOST", default_host or HOST))
    parser.add_argument("--port", type=int, default=int(os.environ.get("MCP_STREAMABLE_HTTP_BIND_PORT", default_port or PORT)))
    parser.add_argument("--print-configs", action="store_true", help="print example MCP server configs and exit")
    args = parser.parse_args()
    if args.print_configs:
        print_config_examples()
        return
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Python MCP UI fixture listening on http://{args.host}:{server.server_port}/mcp", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
