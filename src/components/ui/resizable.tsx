import type { ComponentProps } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ResizablePanelGroup({
  className,
  ...props
}: ComponentProps<typeof Group>) {
  return (
    <Group
      className={joinClasses(
        "flex h-full w-full min-h-0 data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

export function ResizablePanel(props: ComponentProps<typeof Panel>) {
  return <Panel {...props} />;
}

type ResizableHandleProps = ComponentProps<typeof Separator> & {
  withHandle?: boolean;
};

export function ResizableHandle({
  children,
  className,
  withHandle = false,
  ...props
}: ResizableHandleProps) {
  return (
    <Separator
      className={joinClasses(
        "relative flex w-2 shrink-0 cursor-col-resize items-center justify-center border-0 border-base-300/60 bg-base-300/20 p-0 outline-none transition-colors hover:bg-primary/30 data-[separator=active]:bg-primary/40 data-[separator=hover]:bg-primary/30 data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:w-full data-[orientation=horizontal]:cursor-row-resize",
        className,
      )}
      {...props}
    >
      {withHandle ? (
        <div className="z-10 h-8 w-1 rounded-full bg-base-content/20" />
      ) : (
        children
      )}
    </Separator>
  );
}
