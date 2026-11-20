import type { Story } from "@ladle/react";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./resizable";

export default { title: "Base / UI / Resizable" };

export const Horizontal: Story = () => (
  <div className="h-64 min-w-96 p-4">
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel defaultSize={40}>
        <div className="h-full rounded-box bg-base-200 p-4">Conversation</div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={60}>
        <div className="h-full rounded-box bg-base-100 p-4">Details</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
);
