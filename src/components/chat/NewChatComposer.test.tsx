// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createThreadMutation = vi.hoisted(() => vi.fn());
const sendMessageMutation = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

vi.mock("../../app/branding-context", () => ({
  useBranding: () => ({ assistantName: "Example Assistant" }),
}));

vi.mock("../../app-server/hooks", () => ({
  useCollaborationModes: () => ({ data: { data: [] } }),
  useCreateThread: () => ({
    error: null,
    isPending: false,
    mutateAsync: createThreadMutation,
  }),
  useModelList: () => ({ data: { data: [] } }),
  useProject: () => ({ data: { project: { roots: [] } }, isLoading: false }),
  useProjectList: () => ({
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
    mutateAsync: vi.fn(),
  }),
}));

vi.mock("../conversation/useComposerSelection", () => ({
  useComposerSelection: () => ({
    effort: "",
    model: "",
    setEffort: vi.fn(),
    setModel: vi.fn(),
  }),
}));

vi.mock("../conversation/ComposerOptions", () => ({
  ComposerOptions: () => null,
  PermissionMenu: () => null,
}));

vi.mock("../conversation/ComposerSettings", () => ({
  ComposerSettings: () => null,
}));

vi.mock("../conversation/ComposerMessageInput", () => ({
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

vi.mock("../chats/ProjectSelector", () => ({
  ProjectSelector: () => null,
}));

vi.mock("../common/AttachmentPreview", () => ({
  AttachmentPreview: () => null,
}));

vi.mock("../common/useImageAttachment", () => ({
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
    navigate.mockReset();
    createThreadMutation.mockResolvedValue({ thread: { id: "thread-1" } });
    sendMessageMutation.mockResolvedValue({});
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
});
