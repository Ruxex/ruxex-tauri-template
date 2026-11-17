import { useTranslation } from "react-i18next";
import { Crepe } from "@milkdown/crepe";
import type { CrepeBuilder } from "@milkdown/crepe/builder";
import type { PlaceholderFeatureConfig } from "@milkdown/crepe/feature/placeholder";
import { editorViewCtx } from "@milkdown/kit/core";
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
import {
  getSlashCommandInputAtCursor,
  type SlashCommandToken,
} from "./slash-command";

import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";

type ComposerMessageInputProps = {
  disabled: boolean;
  onChange: (value: string) => void;
  onEditorReady?: (element: HTMLElement) => void;
  onSlashCommandContext?: (
    input: SlashCommandToken | null,
    removeToken: (() => void) | null,
  ) => void;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  placeholder: string;
  value: string;
};

function MilkdownEditor({
  disabled,
  onChange,
  onEditorReady,
  onSlashCommandContext,
  onKeyDown,
  placeholder,
  value,
}: ComposerMessageInputProps) {
  const { t } = useTranslation("conversation");

  const containerRef = useRef<HTMLDivElement>(null);
  const initialContentRef = useRef({ value, placeholder });
  const onChangeRef = useRef(onChange);
  const onEditorReadyRef = useRef(onEditorReady);
  const onSlashCommandContextRef = useRef(onSlashCommandContext);
  const [isLoading, getInstance] = useInstance();

  onChangeRef.current = onChange;
  onEditorReadyRef.current = onEditorReady;
  onSlashCommandContextRef.current = onSlashCommandContext;

  useEditor(
    (root) =>
      new Crepe({
        defaultValue: initialContentRef.current.value,
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
            text: initialContentRef.current.placeholder,
          },
        },
        root,
      }).on((listener) => {
        listener.markdownUpdated((_ctx, markdown) => {
          onChangeRef.current(markdown);
        });
      }),
    [],
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

    editor.setAttribute("aria-label", t("message"));
    editor.setAttribute("aria-multiline", "true");
    onEditorReadyRef.current?.(editor);
  }, [getInstance, isLoading, t]);

  useEffect(() => {
    if (isLoading) return;
    const instance = getInstance();
    if (!instance) return;

    const view = instance.action((ctx) => ctx.get(editorViewCtx));
    const updateContext = () => {
      if (!view.dom.contains(document.activeElement)) {
        onSlashCommandContextRef.current?.(null, null);
        return;
      }
      const { selection } = view.state;
      if (!selection.empty || !selection.$from.parent.isTextblock) {
        onSlashCommandContextRef.current?.(null, null);
        return;
      }
      const match = getSlashCommandInputAtCursor(
        selection.$from.parent.textContent,
        selection.$from.parentOffset,
      );
      if (!match) {
        onSlashCommandContextRef.current?.(null, null);
        return;
      }
      const from = selection.$from.start() + match.from;
      const to = selection.$from.start() + match.to;
      onSlashCommandContextRef.current?.({ ...match, from, to }, () => {
        const trailingSpace =
          view.state.doc.textBetween(to, to + 1) === " " ? 1 : 0;
        view.dispatch(view.state.tr.delete(from, to + trailingSpace));
        view.focus();
      });
    };
    document.addEventListener("selectionchange", updateContext);
    view.dom.addEventListener("input", updateContext);
    view.dom.addEventListener("keyup", updateContext);
    view.dom.addEventListener("mouseup", updateContext);
    updateContext();
    return () => {
      document.removeEventListener("selectionchange", updateContext);
      view.dom.removeEventListener("input", updateContext);
      view.dom.removeEventListener("keyup", updateContext);
      view.dom.removeEventListener("mouseup", updateContext);
      onSlashCommandContextRef.current?.(null, null);
    };
  }, [getInstance, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const instance = getInstance();
    if (!instance) return;

    instance.action((ctx) => {
      // Resolve by name, as Crepe bundles its own instance of the feature slice.
      const config = ctx.get<PlaceholderFeatureConfig, "placeholderConfigCtx">(
        "placeholderConfigCtx",
      );
      if (config.text === placeholder) return;
      ctx.update<PlaceholderFeatureConfig, "placeholderConfigCtx">(
        "placeholderConfigCtx",
        (current) => ({ ...current, text: placeholder }),
      );
      const view = ctx.get(editorViewCtx);
      view.updateState(view.state);
    });
  }, [getInstance, isLoading, placeholder]);

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
    container.addEventListener("keydown", handleKeyDown, true);
    return () => container.removeEventListener("keydown", handleKeyDown, true);
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
