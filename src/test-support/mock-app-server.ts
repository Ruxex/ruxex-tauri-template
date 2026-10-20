import type { AppServerEvent } from "../app-server/events";
import type { AppServerRequestError, AppServerStatus } from "../app-server/api";
import type { ClientRequest, ClientResponse, RequestId } from "../protocol";

type Method = ClientRequest["method"];
type RequestForMethod<M extends Method> = Extract<ClientRequest, { method: M }>;
type ResponseForMethod<M extends Method> = Extract<ClientResponse, { method: M }>;

type InvokeArgs = {
  request?: ClientRequest;
  requestId?: RequestId;
  result?: unknown;
  error?: AppServerRequestError;
};

export type MockResolution = {
  requestId: RequestId;
  result: unknown;
};

export type MockRejection = {
  requestId: RequestId;
  error: AppServerRequestError;
};

export class MockAppServer {
  readonly requests: ClientRequest[] = [];
  readonly resolutions: MockResolution[] = [];
  readonly rejections: MockRejection[] = [];
  readonly status: AppServerStatus = {
    socketPath: "/tmp/ruxex-test.sock",
    appServerVersion: "test-app-server",
  };

  private readonly responses = new Map<Method, unknown>();
  private readonly listeners = new Set<(event: AppServerEvent) => void>();

  respond<MethodName extends Method>(
    method: MethodName,
    response: ResponseForMethod<MethodName>["response"],
  ): void {
    this.responses.set(method, response);
  }

  onEvent(listener: (event: AppServerEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: AppServerEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  async invoke(command: string, args: InvokeArgs = {}): Promise<unknown> {
    switch (command) {
      case "ensure_app_server":
        return this.status;
      case "app_server_request": {
        if (!args.request) {
          throw new Error("app_server_request requires a request");
        }
        this.requests.push(args.request);
        const response = this.responses.get(args.request.method);
        if (response === undefined) {
          throw new Error(`No mock response registered for ${args.request.method}`);
        }
        return {
          method: args.request.method,
          id: args.request.id,
          response,
        };
      }
      case "app_server_resolve_server_request":
        if (args.requestId === undefined) {
          throw new Error("app_server_resolve_server_request requires requestId");
        }
        this.resolutions.push({ requestId: args.requestId, result: args.result });
        return undefined;
      case "app_server_reject_server_request":
        if (args.requestId === undefined || !args.error) {
          throw new Error("app_server_reject_server_request requires requestId and error");
        }
        this.rejections.push({ requestId: args.requestId, error: args.error });
        return undefined;
      default:
        throw new Error(`Unsupported mock Tauri command: ${command}`);
    }
  }

  request<MethodName extends Method>(
    method: MethodName,
    params: RequestForMethod<MethodName>["params"],
    id = this.requests.length + 1,
  ): Promise<ResponseForMethod<MethodName>> {
    return this.invoke("app_server_request", {
      request: { method, id, params } as RequestForMethod<MethodName>,
    }) as Promise<ResponseForMethod<MethodName>>;
  }
}
