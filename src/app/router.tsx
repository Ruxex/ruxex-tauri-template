import { createHashRouter, Navigate } from "react-router-dom";

import { AppLayout } from "../components/layout/AppLayout";
import { AccountPage } from "../pages/AccountPage";
import { AppServerPage } from "../pages/AppServerPage";
import { AppearancePage } from "../pages/AppearancePage";
import { ArchivePage } from "../pages/ArchivePage";
import { CapabilitiesPage } from "../pages/CapabilitiesPage";
import { ApprovalCenter } from "../components/approvals/ApprovalCenter";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { ModelPage } from "../pages/ModelPage";
import { NewTaskRedirect } from "../pages/NewTaskRedirect";
import { ProjectHomePage } from "../pages/ProjectHomePage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { SettingsOverviewPage } from "../pages/SettingsOverviewPage";
import { SchedulesPage } from "../pages/SchedulesPage";
import { ThreadPage } from "../pages/ThreadPage";
import { ThreadsPage } from "../pages/ThreadsPage";

export const router = createHashRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "login", element: <LoginPage /> },
      {
        path: "account",
        element: <Navigate replace to="/settings/account" />,
      },
      { path: "approvals", element: <ApprovalCenter /> },
      {
        path: "settings",
        element: <SettingsPage />,
        children: [
          { index: true, element: <SettingsOverviewPage /> },
          { path: "appearance", element: <AppearancePage /> },
          { path: "models", element: <ModelPage /> },
          { path: "app-server", element: <AppServerPage /> },
          { path: "account", element: <AccountPage /> },
        ],
      },
      { path: "schedules", element: <SchedulesPage /> },
      { path: "capabilities", element: <CapabilitiesPage /> },
      { path: "archive", element: <ArchivePage /> },
      { path: "threads", element: <ThreadsPage /> },
      { path: "chat/new", element: <NewTaskRedirect /> },
      { path: "chat/:threadId", element: <ThreadPage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "projects/:projectId", element: <ProjectHomePage /> },
      {
        path: "projects/:projectId/chat/new",
        element: <NewTaskRedirect />,
      },
    ],
  },
]);
