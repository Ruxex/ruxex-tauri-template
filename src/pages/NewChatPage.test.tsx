// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.hoisted(() => vi.fn());
const useCreateThread = vi.hoisted(() => vi.fn());
const useModelList = vi.hoisted(() => vi.fn());
const useParams = vi.hoisted(() => vi.fn());
const useProjectList = vi.hoisted(() => vi.fn());
const useProject = vi.hoisted(() => vi.fn());
const useSendMessage = vi.hoisted(() => vi.fn());
const createThread = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  error: null as Error | null,
}));
const sendMessage = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  error: null as Error | null,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
  useParams,
}));
vi.mock("../app-server/hooks", () => ({
  useCreateThread,
  useModelList,
  useProjectList,
  useProject,
  useSendMessage,
}));

describe("NewChatPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    navigate.mockReset();
    createThread.mutateAsync.mockReset();
    sendMessage.mutateAsync.mockReset();
    createThread.error = null;
    sendMessage.error = null;
    useParams.mockReturnValue({ projectId: "project-1" });
    createThread.mutateAsync.mockResolvedValue({
      thread: { id: "thread-new" },
    });
    sendMessage.mutateAsync.mockResolvedValue({});
    useCreateThread.mockReturnValue(createThread);
    useSendMessage.mockReturnValue(sendMessage);
    useModelList.mockReturnValue({
      data: {
        data: [
          { id: "model-1", model: "ruxex-model", displayName: "Ruxex Model" },
        ],
      },
    });
    useProjectList.mockReturnValue({
      data: {
        data: [
          { id: "project-1", name: "Project Alpha" },
          { id: "project-2", name: "Project Beta" },
        ],
      },
      isLoading: false,
      isError: false,
    });
    useProject.mockImplementation((projectId: string) => ({
      data: {
        project: {
          roots: [
            {
              path:
                projectId === "project-2"
                  ? "/workspace/other"
                  : "/workspace/project",
            },
          ],
        },
      },
    }));
  });

  it("creates a project-scoped thread, sends the first message, and navigates", async () => {
    const { NewChatPage } = await import("./NewChatPage");

    render(<NewChatPage />);
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "ruxex-model" },
    });
    fireEvent.change(screen.getByLabelText("Reasoning"), {
      target: { value: "high" },
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Inspect this project" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start task" }));

    await waitFor(() =>
      expect(createThread.mutateAsync).toHaveBeenCalledWith({
        model: "ruxex-model",
        projectId: "project-1",
        cwd: "/workspace/project",
        approvalPolicy: "on-request",
        sandbox: "workspace-write",
        config: { model_reasoning_effort: "high" },
      }),
    );
    expect(sendMessage.mutateAsync).toHaveBeenCalledWith({
      threadId: "thread-new",
      input: [
        { type: "text", text: "Inspect this project", text_elements: [] },
      ],
    });
    expect(navigate).toHaveBeenCalledWith("/chat/thread-new");
  });

  it("renders mutation failures without navigating", async () => {
    createThread.mutateAsync.mockRejectedValueOnce(new Error("create failed"));
    const { NewChatPage } = await import("./NewChatPage");

    render(<NewChatPage />);
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Try again" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start task" }));

    await waitFor(() => expect(createThread.mutateAsync).toHaveBeenCalled());
    expect(sendMessage.mutateAsync).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("uses a project selected from an unscoped new task", async () => {
    useParams.mockReturnValue({ projectId: undefined });
    const { NewChatPage } = await import("./NewChatPage");

    render(<NewChatPage />);
    fireEvent.change(screen.getByLabelText("Project"), {
      target: { value: "project-2" },
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Inspect the selected project" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start task" }));

    await waitFor(() =>
      expect(createThread.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "project-2",
          cwd: "/workspace/other",
        }),
      ),
    );
  });

  it("passes the selected permissions to a new task", async () => {
    useParams.mockReturnValue({ projectId: undefined });
    const { NewChatPage } = await import("./NewChatPage");

    render(<NewChatPage />);
    fireEvent.change(screen.getByLabelText("Permissions"), {
      target: { value: "full-access" },
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Run the task" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start task" }));

    await waitFor(() =>
      expect(createThread.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          approvalPolicy: "never",
          sandbox: "danger-full-access",
        }),
      ),
    );
  });

  it("renders an existing mutation error below the form", async () => {
    createThread.error = new Error("create failed");
    const { NewChatPage } = await import("./NewChatPage");

    render(<NewChatPage />);

    expect(screen.getByText("Error: create failed")).toBeTruthy();
  });
});
