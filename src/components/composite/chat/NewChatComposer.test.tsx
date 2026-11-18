// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createThreadMutation = vi.hoisted(() => vi.fn());
const createChatWorkspace = vi.hoisted(() => vi.fn());
const sendMessageMutation = vi.hoisted(() => vi.fn());
const setGoalMutation = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const useProject = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/platform/chat-workspace", () => ({ createChatWorkspace }));

vi.mock("@/app/branding-context", () => ({
  useBranding: () => ({ assistantName: "Example Assistant" }),
}));

vi.mock("@/app-server/hooks", () => ({
  useCollaborationModes: () => ({ data: { data: [] } }),
  useCreateThread: () => ({
    error: null,
    isPending: false,
    mutateAsync: createThreadMutation,
  }),
  useModelList: () => ({ data: { data: [] } }),
  useProject,
  useAllProjectList: () => ({
    data: { data: [{ id: "late-project", name: "Late project" }] },
    isLoading: false,
    isError: false,
  }),
  useProjectList: () => ({
    data: { data: [] },
    isLoading: false,
    isError: false,
  }),
  useSkillsList: () => ({
    data: { data: [] },
    isLoading: false,
    isError: false,
  }),
  useSendMessage: () => ({
    error: null,
    isPending: false,
    mutateAsync: sendMessageMutation,
  }),
  useSetThreadGoal: () => ({
    error: null,
    isPending: false,
    mutateAsync: setGoalMutation,
  }),
}));

vi.mock("@/components/feature/conversation/useComposerSelection", () => ({
  useComposerSelection: () => ({
    effort: "",
    model: "",
    setEffort: vi.fn(),
    setModel: vi.fn(),
  }),
}));

vi.mock("@/components/feature/conversation/ComposerOptions", () => ({
  ComposerOptions: ({ goalMode, onGoalModeChange }: { goalMode: boolean; onGoalModeChange: () => void }) => (
    <button aria-label="Goal mode" onClick={onGoalModeChange} type="button">
      {goalMode ? "Goal mode active" : "Goal mode"}
    </button>
  ),
  PermissionMenu: () => null,
}));

vi.mock("@/components/feature/conversation/ComposerSettings", () => ({
  ComposerSettings: () => null,
}));

vi.mock("@/components/feature/conversation/ComposerMessageInput", () => ({
  ComposerMessageInput: ({
    disabled,
    onChange,
    onKeyDown,
    placeholder,
    value,
  }: {
    disabled: boolean;
    onChange: (value: string) => void;
    onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
    placeholder: string;
    value: string;
  }) => (
    <textarea
      aria-label="Message"
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      value={value}
    />
  ),
}));

vi.mock("@/components/composite/chats/ProjectSelector", () => ({
  ProjectSelector: ({ projects }: { projects: { name: string }[] }) => (
    <ul aria-label="Project selector options">
      {projects.map((project) => (
        <li key={project.name}>{project.name}</li>
      ))}
    </ul>
  ),
}));

vi.mock("@/components/base/common/AttachmentPreview", () => ({
  AttachmentPreview: () => null,
}));

vi.mock("@/components/base/common/useImageAttachment", () => ({
  useImageAttachment: () => ({
    attachmentError: null,
    attachmentInput: { current: null },
    clearAttachment: vi.fn(),
    handleAttachmentChange: vi.fn(),
    imageFile: null,
    readImage: vi.fn(),
    resetAttachment: vi.fn(),
    setAttachmentError: vi.fn(),
  }),
}));

describe("NewChatComposer", () => {
  afterEach(cleanup);

  beforeEach(() => {
    createThreadMutation.mockReset();
    sendMessageMutation.mockReset();
    setGoalMutation.mockReset();
    navigate.mockReset();
    createThreadMutation.mockResolvedValue({ thread: { id: "thread-1" } });
    createChatWorkspace.mockReset().mockResolvedValue("/home/user/.ruxex/workspaces/chat-1");
    useProject.mockReset().mockReturnValue({
      data: { project: { roots: [] } },
      isLoading: false,
    });
    sendMessageMutation.mockResolvedValue({});
    setGoalMutation.mockResolvedValue({});
  });

  it("includes projects beyond the first API page in the project selector", async () => {
    const { NewChatComposer } = await import("./NewChatComposer");

    render(<NewChatComposer />);

    expect(screen.getByRole("list", { name: "Project selector options" }).textContent).toContain("Late project");
  });

  it("submits only with Ctrl+Enter", async () => {
    const { NewChatComposer } = await import("./NewChatComposer");

    render(<NewChatComposer />);
    const message = screen.getByLabelText("Message");
    fireEvent.change(message, { target: { value: "Start a thread" } });

    fireEvent.keyDown(message, { key: "Enter" });
    fireEvent.keyDown(message, { key: "Enter", shiftKey: true });
    expect(createThreadMutation).not.toHaveBeenCalled();

    fireEvent.keyDown(message, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(createThreadMutation).toHaveBeenCalled());
    expect(sendMessageMutation).toHaveBeenCalled();
  });

  it("starts a Projectless chat in its data-home workspace", async () => {
    const { NewChatComposer } = await import("./NewChatComposer");

    render(<NewChatComposer />);
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Start a chat" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(createThreadMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: "/home/user/.ruxex/workspaces/chat-1",
        }),
      ),
    );
    expect(createChatWorkspace).toHaveBeenCalledOnce();
  });

  it("keeps the selected Project root as cwd without creating a workspace", async () => {
    useProject.mockReturnValue({
      data: { project: { roots: [{ path: "/workspace/project-alpha" }] } },
      isLoading: false,
    });
    const { NewChatComposer } = await import("./NewChatComposer");

    render(<NewChatComposer projectId="project-1" />);
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Work in this project" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(createThreadMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: "/workspace/project-alpha",
          projectId: "project-1",
        }),
      ),
    );
    expect(createChatWorkspace).not.toHaveBeenCalled();
  });

  it("shows workspace creation failures and does not start a thread", async () => {
    createChatWorkspace.mockRejectedValue(new Error("workspace unavailable"));
    const { NewChatComposer } = await import("./NewChatComposer");

    render(<NewChatComposer />);
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Start a chat" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent ?? "").toContain("workspace unavailable");
    expect(createThreadMutation).not.toHaveBeenCalled();
  });

  it("keeps the editable input after sending a rendered message", async () => {
    const { NewChatComposer } = await import("./NewChatComposer");

    render(<NewChatComposer />);
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "# Preview this" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(createThreadMutation).toHaveBeenCalled());
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("keeps Send as the goal-mode action and allows goal mode to be dismissed", async () => {
    const { NewChatComposer } = await import("./NewChatComposer");

    render(<NewChatComposer />);
    fireEvent.click(screen.getByRole("button", { name: "Goal mode" }));
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Keep the project healthy" },
    });

    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Goal mode active" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Disable goal mode" }));

    expect(screen.queryByRole("status", { name: "Goal mode active" })).toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
  });
});
