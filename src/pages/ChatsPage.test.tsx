// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { i18n } from "../app/i18n";
import { ChatsPage } from "./ChatsPage";

vi.mock("../app-server/hooks", () => ({
  useAllProjectList: () => ({ data: { data: [] } }),
  useAllThreadList: () => ({
    data: { data: [] },
    isLoading: false,
    isError: false,
  }),
  useAllThreadSearch: () => ({
    data: { data: [] },
    isLoading: false,
    isError: false,
  }),
}));

afterEach(cleanup);

it("localizes chat search, sorting, tabs, and the empty state", async () => {
  await i18n.changeLanguage("ja");
  render(
    <MemoryRouter>
      <ChatsPage />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "チャット" })).toBeTruthy();
  expect(
    screen.getByRole("searchbox", { name: "チャットを検索" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("combobox", { name: "チャットの並び順" }),
  ).toBeTruthy();
  expect(screen.getByRole("tab", { name: "プロジェクトなし" })).toBeTruthy();
  expect(screen.getByText("チャットがまだありません")).toBeTruthy();
});
