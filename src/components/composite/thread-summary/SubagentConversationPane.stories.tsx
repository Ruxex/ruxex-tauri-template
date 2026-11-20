import type { Story } from "@ladle/react";

import { CatalogQueryProvider } from "../../../../.ladle/support/catalog-providers";
import { appServerQueryKeys } from "@/app-server/query-keys";
import { SubagentConversationPane } from "./SubagentConversationPane";

export default { title: "Composite / Thread Summary / Subagent Conversation Pane" };

export const Loading: Story = () => (
  <CatalogQueryProvider seeds={[{ queryKey: appServerQueryKeys.status, data: null }]}>
    <div className="h-96 border border-base-300 bg-base-100">
      <SubagentConversationPane threadId="subagent-catalog" />
    </div>
  </CatalogQueryProvider>
);
