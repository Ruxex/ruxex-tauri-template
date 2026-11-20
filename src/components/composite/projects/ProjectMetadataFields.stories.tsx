import type { Story } from "@ladle/react";
import { useState } from "react";

import { DEFAULT_PROJECT_METADATA } from "./project-metadata";
import { ProjectMetadataFields } from "./ProjectMetadataFields";

export default { title: "Composite / Projects / Project Metadata Fields" };

export const Editable: Story = () => {
  const [value, setValue] = useState(DEFAULT_PROJECT_METADATA);
  return <ProjectMetadataFields onChange={setValue} value={value} />;
};
