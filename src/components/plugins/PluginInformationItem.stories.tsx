import { PluginInformationItem } from "./PluginInformationItem";

export const Metadata = () => (
  <dl className="grid max-w-2xl gap-4 rounded-box border border-base-300 bg-base-100 p-4 sm:grid-cols-2">
    <PluginInformationItem label="Category" value="Developer tools" />
    <PluginInformationItem
      href="https://example.com/plugin"
      label="Website"
      value="https://example.com/plugin"
    />
  </dl>
);
