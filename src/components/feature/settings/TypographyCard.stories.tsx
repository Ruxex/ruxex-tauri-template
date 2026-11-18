import type { Story } from "@ladle/react";
import { TypographyCard } from "./TypographyCard";

export const SystemTypography: Story = () => (
  <div className="max-w-3xl p-4">
    <TypographyCard
      chatFontFamily="system-ui"
      chatFontSize={14}
      uiFontFamily="system-ui"
      uiFontSize={14}
      uiZoom={100}
      onChatFontFamilyChange={() => undefined}
      onChatFontSizeChange={() => undefined}
      onReset={() => undefined}
      onUiFontFamilyChange={() => undefined}
      onUiFontSizeChange={() => undefined}
      onUiZoomChange={() => undefined}
    />
  </div>
);
