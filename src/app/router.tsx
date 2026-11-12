import { createHashRouter, Navigate } from "react-router-dom";
import { ApprovalCenter } from "../components/approvals/ApprovalCenter";
import { ActivityCenter } from "../components/activity/ActivityCenter";
import { AppLayout } from "../components/layout/AppLayout";
import { QuickPanelPage } from "../components/quick-panel/QuickPanelPage";
import { AccountPage } from "../pages/AccountPage";
import { AppearancePage } from "../pages/AppearancePage";
import { AppServerPage } from "../pages/AppServerPage";
import { ArchivePage } from "../pages/ArchivePage";
import { CapabilitiesPage } from "../pages/CapabilitiesPage";
import { HomePage } from "../pages/HomePage";
import { HooksPage } from "../pages/HooksPage";
import { MarketplaceSettingsPage } from "../pages/MarketplaceSettingsPage";
import { McpServersPage } from "../pages/McpServersPage";
import { ModelPage } from "../pages/ModelPage";
import { NewChatRedirect } from "../pages/NewChatRedirect";
import { PluginDetailPage } from "../pages/PluginDetailPage";
import { ProjectHomePage } from "../pages/ProjectHomePage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { SchedulesPage } from "../pages/SchedulesPage";
import { ScheduleDetailPage } from "../pages/ScheduleDetailPage";
import { SettingsOverviewPage } from "../pages/SettingsOverviewPage";
import { SettingsPage } from "../pages/SettingsPage";
import { ThreadPage } from "../pages/ThreadPage";
import { VersionPage } from "../pages/VersionPage";

export const router = createHashRouter([
  { path: "/quick-panel", element: <QuickPanelPage /> },
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "account",
        element: <Navigate replace to="/settings/account" />,
      },
      { path: "approvals", element: <ApprovalCenter /> },
      { path: "activity", element: <ActivityCenter /> },
      {
        path: "settings",
        element: <SettingsPage />,
        children: [
          { index: true, element: <SettingsOverviewPage /> },
          { path: "appearance", element: <AppearancePage /> },
          { path: "models", element: <ModelPage /> },
          { path: "app-server", element: <AppServerPage /> },
          { path: "hooks", element: <HooksPage /> },
          { path: "archive", element: <ArchivePage /> },
          { path: "marketplaces", element: <MarketplaceSettingsPage /> },
          { path: "mcp-servers", element: <McpServersPage /> },
          { path: "account", element: <AccountPage /> },
          { path: "version", element: <VersionPage /> },
        ],
      },
      { path: "schedules", element: <SchedulesPage /> },
      { path: "schedules/:scheduleId", element: <ScheduleDetailPage /> },
      { path: "capabilities", element: <CapabilitiesPage /> },
      {
        path: "capabilities/plugins/:marketplaceName/:pluginName",
        element: <PluginDetailPage />,
      },
      { path: "archive", element: <ArchivePage /> },
      { path: "chat/new", element: <NewChatRedirect /> },
      { path: "chat/:threadId", element: <ThreadPage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "projects/:projectId", element: <ProjectHomePage /> },
      {
        path: "projects/:projectId/chat/new",
        element: <NewChatRedirect />,
      },
    ],
  },
]);
