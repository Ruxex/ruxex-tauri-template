import { Crepe } from "@milkdown/crepe";
import type { CrepeBuilder } from "@milkdown/crepe/builder";
import { replaceAll } from "@milkdown/kit/utils";
import {
  Milkdown,
  MilkdownProvider,
  useEditor,
  useInstance,
} from "@milkdown/react";
import {
  type KeyboardEvent,
  type KeyboardEventHandler,
  useEffect,
  useRef,
} from "react";

import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";

type ComposerMessageInputProps = {
  disabled: boolean;
  onChange: (value: string) => void;
  onEditorReady?: (element: HTMLElement) => void;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  placeholder: string;
  value: string;
};

function MilkdownEditor({
  disabled,
  onChange,
  onEditorReady,
  onKeyDown,
  placeholder,
  value,
}: ComposerMessageInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const onEditorReadyRef = useRef(onEditorReady);
  const [isLoading, getInstance] = useInstance();

  onChangeRef.current = onChange;
  onEditorReadyRef.current = onEditorReady;

  useEditor(
    (root) =>
      new Crepe({
        defaultValue: value,
        features: {
          [Crepe.Feature.BlockEdit]: false,
          [Crepe.Feature.CodeMirror]: false,
          [Crepe.Feature.ImageBlock]: false,
          [Crepe.Feature.Latex]: false,
          [Crepe.Feature.LinkTooltip]: false,
          [Crepe.Feature.Table]: false,
          [Crepe.Feature.Toolbar]: false,
        },
        featureConfigs: {
          [Crepe.Feature.Placeholder]: {
            mode: "doc",
            text: placeholder,
          },
        },
        root,
      }).on((listener) => {
        listener.markdownUpdated((_ctx, markdown) => {
          onChangeRef.current(markdown);
        });
      }),
    [placeholder],
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const instance = getInstance();
    const editor = containerRef.current?.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );
    if (!instance || !editor) {
      return;
    }

    editor.setAttribute("aria-label", "Message");
    editor.setAttribute("aria-multiline", "true");
    onEditorReadyRef.current?.(editor);
  }, [getInstance, isLoading]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const instance = getInstance();
    if (!instance) {
      return;
    }

    instance.action((ctx) => {
      const crepe = ctx.get<CrepeBuilder, "CrepeCtx">("CrepeCtx");
      crepe.setReadonly(disabled);
    });
  }, [disabled, getInstance, isLoading]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const instance = getInstance();
    if (!instance) {
      return;
    }

    const currentValue = instance.action((ctx) => {
      const crepe = ctx.get<CrepeBuilder, "CrepeCtx">("CrepeCtx");
      return crepe.getMarkdown();
    });
    if (currentValue !== value) {
      instance.action(replaceAll(value));
    }
  }, [getInstance, isLoading, value]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onKeyDown) {
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      onKeyDown(event as unknown as KeyboardEvent<HTMLDivElement>);
    };
    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [onKeyDown]);

  return (
    <div ref={containerRef} className="milkdown-composer">
      <Milkdown />
    </div>
  );
}

export function ComposerMessageInput(props: ComposerMessageInputProps) {
  return (
    <MilkdownProvider>
      <MilkdownEditor {...props} />
    </MilkdownProvider>
  );
}
