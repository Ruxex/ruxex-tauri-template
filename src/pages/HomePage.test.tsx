// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useCreateThread = vi.hoisted(() => vi.fn());
const useModelList = vi.hoisted(() => vi.fn());
const useProject = vi.hoisted(() => vi.fn());
const useSetThreadGoal = vi.hoisted(() => vi.fn());
const useSendMessage = vi.hoisted(() => vi.fn());

vi.mock("../app-server/hooks", () => ({
  useCreateThread,
  useModelList,
  useProject,
  useSetThreadGoal,
  useSendMessage,
}));
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => vi.fn() };
});

describe("HomePage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useCreateThread.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: vi.fn().mockResolvedValue({ thread: { id: "thread-new" } }),
    });
    useModelList.mockReturnValue({
      data: {
        data: [
          {
            id: "model-1",
            model: "ruxex",
            displayName: "Ruxex",
            hidden: false,
            supportedReasoningEfforts: [
              { reasoningEffort: "medium", description: "Balanced" },
            ],
          },
        ],
      },
    });
    useProject.mockReturnValue({ data: undefined });
    useSetThreadGoal.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: vi.fn().mockResolvedValue({}),
    });
    useSendMessage.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: vi.fn().mockResolvedValue({}),
    });
  });

  it("renders a centered welcome state with a chat composer", async () => {
    const { HomePage } = await import("./HomePage");

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Let's get started" }),
    ).toBeTruthy();
    const settings = screen
      .getByLabelText("Model and effort")
      .closest("details");
    expect(settings).not.toBeNull();
    expect(settings?.open).toBe(false);
    expect(settings?.querySelectorAll("select")).toHaveLength(2);
    expect(screen.getByLabelText("Permission mode")).toBeTruthy();
    expect(screen.getByLabelText("Composer options")).toBeTruthy();
    expect(screen.getByLabelText("Message")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "New chat" })).toBeNull();
  });

  it("starts a thread from the shared composer", async () => {
    const { HomePage } = await import("./HomePage");

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    const createThread = useCreateThread.mock.results.at(-1)?.value
      .mutateAsync as ReturnType<typeof vi.fn>;
    const sendMessage = useSendMessage.mock.results.at(-1)?.value
      .mutateAsync as ReturnType<typeof vi.fn>;
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Start from home" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(createThread).toHaveBeenCalled());
    expect(createThread).toHaveBeenCalledWith({
      model: "ruxex",
      approvalPolicy: "on-request",
      sandbox: "workspace-write",
      config: { model_reasoning_effort: "medium" },
    });
    expect(sendMessage).toHaveBeenCalledWith({
      threadId: "thread-new",
      input: [{ type: "text", text: "Start from home", text_elements: [] }],
      turnTrigger: null,
    });
  });

  it("sets a goal from the shared composer without starting a turn", async () => {
    const { HomePage } = await import("./HomePage");

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Keep the project healthy" },
    });
    fireEvent.click(screen.getByLabelText("Composer options"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Goal mode" }));
    fireEvent.click(screen.getByRole("button", { name: "Set goal" }));

    const setGoal = useSetThreadGoal.mock.results.at(-1)?.value
      .mutateAsync as ReturnType<typeof vi.fn>;
    await waitFor(() => expect(setGoal).toHaveBeenCalled());
    expect(setGoal).toHaveBeenCalledWith({
      threadId: "thread-new",
      objective: "Keep the project healthy",
      status: "active",
    });
    expect(
      useSendMessage.mock.results.at(-1)?.value.mutateAsync,
    ).not.toHaveBeenCalled();
  });

  it("uses the plan trigger when plan mode is selected", async () => {
    const { HomePage } = await import("./HomePage");

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Plan the migration" },
    });
    fireEvent.click(screen.getByLabelText("Composer options"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Plan mode" }));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    const sendMessage = useSendMessage.mock.results.at(-1)?.value
      .mutateAsync as ReturnType<typeof vi.fn>;
    await waitFor(() => expect(sendMessage).toHaveBeenCalled());
    expect(sendMessage).toHaveBeenCalledWith({
      threadId: "thread-new",
      input: [{ type: "text", text: "Plan the migration", text_elements: [] }],
      turnTrigger: "plan",
    });
  });

  it("passes a project query into the shared start composer", async () => {
    const { HomePage } = await import("./HomePage");

    render(
      <MemoryRouter initialEntries={["/?projectId=project-1"]}>
        <HomePage />
      </MemoryRouter>,
    );

    expect(useProject).toHaveBeenLastCalledWith("project-1");
  });
});
