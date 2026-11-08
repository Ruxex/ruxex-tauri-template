import { ChatTitle } from "./ChatTitle";

export const Short = () => (
  <div className="w-64 rounded-box border border-base-300 bg-base-100 p-2">
    <ChatTitle isHovered={false} title="Short chat title" />
  </div>
);

export const Long = () => {
  const title =
    "A long chat title that demonstrates the marquee treatment in the sidebar";

  return (
    <div className="w-64 rounded-box border border-base-300 bg-base-100 p-2">
      <ChatTitle isHovered title={title} />
    </div>
  );
};
