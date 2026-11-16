// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { ChatsPage } from "../pages/ChatsPage";
import { HomePage } from "../pages/HomePage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { SettingsOverviewPage } from "../pages/SettingsOverviewPage";
import { QuickPanelPage } from "../components/quick-panel/QuickPanelPage";
import { i18n } from "./i18n";
import { UiPreferencesProvider } from "./ui-preferences";

afterEach(async () => {
  cleanup();
  window.localStorage.clear();
  await i18n.changeLanguage("en");
});

describe("Japanese UI smoke", () => {
  it("keeps Japanese names across home, projects, chats, and quick panel after selecting the language in Settings", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const router = createMemoryRouter(
      [
        { path: "/", element: <HomePage /> },
        { path: "/projects", element: <ProjectsPage /> },
        { path: "/chats", element: <ChatsPage /> },
        { path: "/settings", element: <SettingsOverviewPage /> },
        { path: "/quick-panel", element: <QuickPanelPage /> },
      ],
      { initialEntries: ["/settings"] },
    );
    render(
      <QueryClientProvider client={client}>
        <UiPreferencesProvider>
          <RouterProvider router={router} />
        </UiPreferencesProvider>
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
      target: { value: "ja" },
    });
    expect(await screen.findByRole("heading", { name: "一般" })).toBeTruthy();
    expect(document.documentElement.lang).toBe("ja");
    await act(() => router.navigate("/projects"));
    expect(screen.getByRole("heading", { name: "プロジェクト" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "新規プロジェクト" }),
    ).toBeTruthy();
    await act(() => router.navigate("/chats"));
    expect(screen.getByRole("heading", { name: "チャット" })).toBeTruthy();
    await act(() => router.navigate("/"));
    expect(screen.getByRole("button", { name: "送信" })).toBeTruthy();
    await act(() => router.navigate("/quick-panel"));
    expect(
      screen.getByRole("textbox", { name: "クイックリクエスト" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "画像を添付" })).toBeTruthy();
    client.clear();
    router.dispose();
  });
});
