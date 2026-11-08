import type { Story } from "@ladle/react";
import { Outlet, Route, Routes } from "react-router-dom";

import { AppLayout } from "./AppLayout";

export const ThreadsRoute: Story = () => (
  <Routes>
    <Route element={<AppLayout />} path="*">
      <Route element={<Outlet />} path="*" />
    </Route>
  </Routes>
);
