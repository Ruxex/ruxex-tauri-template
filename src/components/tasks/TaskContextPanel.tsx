import { useEffect } from "react";

import {
  ReviewWorkspace,
  type ReviewFileChange,
  type ReviewMutationState,
} from "../review/ReviewWorkspace";

export type TaskContextTab = "review" | "terminal" | "files";

type TaskContextPanelProps = {
  activeTab: TaskContextTab;
  branch?: string | null;
  changedFiles: ReviewFileChange[];
  onClose: () => void;
  onOpenContext: (tab: TaskContextTab) => void;
  onStartReview: () => void;
  review: ReviewMutationState;
  threadId: string;
  workspacePath?: string | null;
};

export function TaskContextPanel({
  activeTab,
  branch,
  changedFiles,
  onClose,
  onOpenContext,
  onStartReview,
  review,
  workspacePath,
}: TaskContextPanelProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <aside
      aria-label="Task context panel"
      className="fixed inset-4 z-20 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-box border border-base-300 bg-base-100 p-4 shadow-lg lg:static lg:max-h-none lg:max-w-2xl lg:self-end lg:shadow-sm"
      role="dialog"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Task context</h2>
        <button
          aria-label="Close task context"
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div className="mt-3 border-b border-base-300">
        <div
          aria-label="Task context tabs"
          role="tablist"
          className="tabs tabs-bordered"
        >
          {(["review", "terminal", "files"] as const).map((tab) => (
            <button
              aria-selected={activeTab === tab}
              className={`tab ${activeTab === tab ? "tab-active" : ""}`}
              key={tab}
              role="tab"
              type="button"
              onClick={() => onOpenContext(tab)}
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        {activeTab === "review" && (
          <ReviewWorkspace
            branch={branch}
            changedFiles={changedFiles}
            onStartReview={onStartReview}
            review={review}
            workspacePath={workspacePath}
          />
        )}
        {activeTab === "terminal" && (
          <p className="text-sm text-base-content/70">
            Terminal is not supported in this build.
          </p>
        )}
        {activeTab === "files" && (
          <p className="text-sm text-base-content/70">
            Files are not supported in this build.
          </p>
        )}
      </div>
    </aside>
  );
}
