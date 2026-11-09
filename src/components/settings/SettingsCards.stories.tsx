import { InformationCircleIcon } from "@heroicons/react/24/outline";
import type { Story } from "@ladle/react";

import {
  AppServerCard,
  CapabilitiesCard,
  LanguageCard,
  NotificationsCard,
  ProviderAccountCard,
  QuickPanelCard,
  RuntimeSummary,
  SettingRow,
  SettingsPanel,
  TypographyCard,
  UiPreferencesCard,
} from "./SettingsCards";

export const SettingsPanelState: Story = () => (
  <SettingsPanel icon={InformationCircleIcon} title="Catalog panel">
    <SettingRow label="Status">
      <span className="text-success">Ready</span>
    </SettingRow>
  </SettingsPanel>
);

export const AppServer: Story = () => (
  <AppServerCard
    appServerReady
    appServerVersion="1.0.0"
    connected
    isAvailable={false}
    isFetching={false}
    isPending={false}
    isUpdatePending={false}
    mode="inprocess"
    onAction={() => undefined}
    onReconnect={() => undefined}
    onUpdate={() => undefined}
    resynchronizing={false}
  />
);

export const ProviderAccount: Story = () => (
  <ProviderAccountCard
    account="catalog@example.com"
    authStatus="authenticated"
    dataDirectory="/home/example/.ruxex_desktop"
    provider="Example Provider"
  />
);

export const Capabilities: Story = () => (
  <CapabilitiesCard
    capabilities={{
      modelListing: true,
      streaming: true,
      webSearch: false,
      interactiveLogin: "Unsupported",
    }}
  />
);

export const Runtime: Story = () => (
  <RuntimeSummary modelCount={4} permissionCount={3} rateLimitName="Standard" />
);

export const Language: Story = () => (
  <LanguageCard language="en" onLanguageChange={() => undefined} />
);

export const Notifications: Story = () => (
  <NotificationsCard
    enabled
    onEnabledChange={() => undefined}
    onSoundChange={() => undefined}
    sound="system"
  />
);

export const QuickPanel: Story = () => (
  <QuickPanelCard
    defaultShortcut="Ctrl+Shift+Space"
    disabled={false}
    isLoading={false}
    onReset={() => undefined}
    onSave={() => undefined}
    onShortcutKeyDown={() => undefined}
    shortcut="Ctrl+Shift+Space"
    waylandNotice="Global shortcuts may require desktop permissions."
  />
);

export const Interface: Story = () => (
  <UiPreferencesCard
    colorScheme="light"
    onAccentColorChange={() => undefined}
    onColorSchemeChange={() => undefined}
    theme={{ accentColor: "blue" }}
  />
);

export const Typography: Story = () => (
  <TypographyCard
    chatFontSize={12}
    onChatFontSizeChange={() => undefined}
    onUiFontSizeChange={() => undefined}
    uiFontSize={14}
  />
);
