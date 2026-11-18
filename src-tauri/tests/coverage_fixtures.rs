use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

struct ChildGuard(Child);

impl Drop for ChildGuard {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

fn fixture_binary(name: &str) -> PathBuf {
    let env_name = match name {
        "stdio" => "CARGO_BIN_EXE_ruxex-mcp-fixture",
        "http" => "CARGO_BIN_EXE_ruxex-mcp-http-fixture",
        _ => panic!("unknown fixture binary"),
    };
    std::env::var_os(env_name)
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../../target/debug")
                .join(if name == "stdio" {
                    "ruxex-mcp-fixture"
                } else {
                    "ruxex-mcp-http-fixture"
                })
        })
}

#[test]
fn stdio_mcp_fixture_serves_tools_and_reports_invalid_calls() {
    let mut child = Command::new(fixture_binary("stdio"))
        .env("MCP_TEST_VALUE", "coverage-value")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("stdio fixture should start");
    let requests = [
        serde_json::json!({
            "jsonrpc":"2.0", "id":1, "method":"initialize",
            "params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"coverage","version":"1"}}
        }),
        serde_json::json!({"jsonrpc":"2.0","method":"notifications/initialized"}),
        serde_json::json!({"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}),
        serde_json::json!({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"echo","arguments":{"message":"hello","env_var":"MCP_TEST_VALUE"}}}),
        serde_json::json!({"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"unknown","arguments":{}}}),
        serde_json::json!({"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"echo"}}),
    ];
    {
        let input = child.stdin.as_mut().expect("fixture stdin should be open");
        for request in requests {
            writeln!(input, "{request}").unwrap();
        }
    }
    drop(child.stdin.take());
    let output = child
        .wait_with_output()
        .expect("fixture should exit on EOF");
    assert!(output.status.success());
    let response_lines = String::from_utf8(output.stdout).unwrap();
    assert!(response_lines.contains("\"name\":\"echo\""));
    assert!(response_lines.contains("coverage-value"));
    assert!(response_lines.contains("unknown tool: unknown"));
    assert!(response_lines.contains("missing arguments for echo tool"));
}

#[test]
fn http_fixture_headers_helper_is_isolated_and_tracks_invocations() {
    let binary = fixture_binary("http");
    let invocations = std::env::temp_dir().join(format!(
        "ruxex-http-helper-{}-{}.txt",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let first = Command::new(&binary)
        .args([
            "--http-headers-helper",
            invocations.to_str().unwrap(),
            "--authorization",
        ])
        .env_remove("MCP_TEST_AMBIENT_SECRET")
        .output()
        .unwrap();
    assert!(first.status.success());
    let first: serde_json::Value = serde_json::from_slice(&first.stdout).unwrap();
    assert_eq!(first["Authorization"], "Bearer gateway-token");
    assert_eq!(first["X-Helper-Generation"], "1");

    let second = Command::new(binary)
        .args(["--http-headers-helper", invocations.to_str().unwrap()])
        .env_remove("MCP_TEST_AMBIENT_SECRET")
        .output()
        .unwrap();
    let second: serde_json::Value = serde_json::from_slice(&second.stdout).unwrap();
    assert_eq!(second["Proxy-Authorization"], "Bearer gateway-token");
    assert_eq!(second["X-Helper-Generation"], "2");
    let _ = std::fs::remove_file(invocations);
}

fn http_request(
    address: SocketAddr,
    method: &str,
    path: &str,
    headers: &[(&str, &str)],
    body: &str,
) -> String {
    let mut stream = TcpStream::connect_timeout(&address, Duration::from_secs(2)).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(3)))
        .unwrap();
    write!(stream, "{method} {path} HTTP/1.1\r\nHost: {address}\r\nConnection: close\r\nContent-Length: {}\r\n", body.len()).unwrap();
    for (name, value) in headers {
        write!(stream, "{name}: {value}\r\n").unwrap();
    }
    write!(stream, "\r\n{body}").unwrap();
    let mut response = String::new();
    stream.read_to_string(&mut response).unwrap();
    response
}

fn wait_for_http_fixture(address: SocketAddr) {
    let deadline = Instant::now() + Duration::from_secs(5);
    while Instant::now() < deadline {
        if TcpStream::connect_timeout(&address, Duration::from_millis(100)).is_ok() {
            return;
        }
        thread::sleep(Duration::from_millis(25));
    }
    panic!("HTTP fixture did not start listening at {address}");
}

#[test]
fn http_fixture_exposes_oauth_metadata_and_enforces_both_bearer_headers() {
    let reserved = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = reserved.local_addr().unwrap();
    drop(reserved);
    let mut child = ChildGuard(
        Command::new(fixture_binary("http"))
            .env("MCP_STREAMABLE_HTTP_BIND_ADDR", address.to_string())
            .env("MCP_EXPECT_BEARER", "user-token")
            .env("MCP_EXPECT_GATEWAY_BEARER", "gateway-token")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap(),
    );
    wait_for_http_fixture(address);

    let metadata = http_request(
        address,
        "GET",
        "/.well-known/oauth-authorization-server/mcp",
        &[],
        "",
    );
    assert!(metadata.starts_with("HTTP/1.1 200"));
    assert!(metadata.contains(&format!("http://{address}/oauth/authorize")));

    let forbidden = http_request(address, "GET", "/private", &[], "");
    assert!(forbidden.starts_with("HTTP/1.1 401"));
    let token_error = http_request(address, "POST", "/oauth/token", &[], "{}");
    assert!(token_error.starts_with("HTTP/1.1 400"));

    let body = r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"coverage","version":"1"}}}"#;
    let accept = "application/json, text/event-stream";
    let no_user_token = http_request(
        address,
        "POST",
        "/mcp",
        &[("content-type", "application/json"), ("accept", accept)],
        body,
    );
    assert!(no_user_token.starts_with("HTTP/1.1 401"));
    let no_gateway_token = http_request(
        address,
        "POST",
        "/mcp",
        &[
            ("content-type", "application/json"),
            ("accept", accept),
            ("authorization", "Bearer user-token"),
        ],
        body,
    );
    assert!(no_gateway_token.starts_with("HTTP/1.1 401"));
    let allowed = http_request(
        address,
        "POST",
        "/mcp",
        &[
            ("content-type", "application/json"),
            ("accept", accept),
            ("authorization", "Bearer user-token"),
            ("proxy-authorization", "Bearer gateway-token"),
        ],
        body,
    );
    assert!(allowed.starts_with("HTTP/1.1 200"), "{allowed}");

    let arm = http_request(
        address,
        "POST",
        "/test/control/initialize-post-failure",
        &[
            ("content-type", "application/json"),
            ("accept", accept),
            ("authorization", "Bearer user-token"),
        ],
        r#"{"status":503,"remaining":1,"content_type":"text/plain","body":"temporary failure"}"#,
    );
    assert!(arm.starts_with("HTTP/1.1 204"));
    let failed = http_request(
        address,
        "POST",
        "/mcp",
        &[
            ("content-type", "application/json"),
            ("authorization", "Bearer user-token"),
            ("proxy-authorization", "Bearer gateway-token"),
        ],
        body,
    );
    assert!(failed.starts_with("HTTP/1.1 503"));
    assert!(failed.ends_with("temporary failure"));
    let _ = child.0.kill();
}
