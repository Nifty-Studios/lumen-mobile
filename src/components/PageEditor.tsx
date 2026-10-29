"use dom";

// The page body (icon, title, BlockNote editor) running in a webview. It only edits; the
// native side owns the database and receives changes through the onSave/onRename actions.

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@fontsource-variable/fraunces";
import { useEffect, useRef, useState, type CSSProperties, type Ref } from "react";
import { SuggestionMenuController, useCreateBlockNote, type SuggestionMenuProps } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { en } from "@blocknote/core/locales";
import type { Block as EditorBlock, PartialBlock } from "@blocknote/core";
import { useDOMImperativeHandle, type DOMImperativeFactory, type DOMProps } from "expo/dom";
import { filterSlashItems, lumenSchema, slashItems, type SlashItem } from "@lumen/shared/editor";
import { iconSvg, type IconName } from "@lumen/shared/icons";

const SAVE_DELAY = 300;
const MAX_IMAGE_SIDE = 1600;

export interface PageEditorRef extends DOMImperativeFactory {
  flush: () => void;
}

/** CSS colors from the native theme (shared/ambient/theme.ts). */
export interface EditorColors {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  faint: string;
  hover: string;
  active: string;
  border: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  selection: string;
  shadow: string;
}

interface Props {
  ref?: Ref<PageEditorRef>;
  dom?: DOMProps;
  title: string;
  icon: { name: string; color?: string } | null;
  initialContent: PartialBlock[] | null;
  dark: boolean;
  colors: EditorColors;
  onSave: (doc: EditorBlock[]) => Promise<void>;
  onRename: (title: string) => Promise<void>;
  onIconPress: () => Promise<void>;
}

const svg = (name: string, size: number, color = "currentColor") => ({ __html: iconSvg(name as IconName, { size, color }) });

async function imageToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/webp", 0.85);
}

export default function PageEditor({ ref, title, icon, initialContent, dark, colors, onSave, onRename, onIconPress }: Props) {
  const editor = useCreateBlockNote(
    {
      schema: lumenSchema,
      initialContent: (initialContent ?? undefined) as never,
      uploadFile: imageToDataUrl,
      dictionary: { ...en, placeholders: { ...en.placeholders, default: "Write, or type / for blocks", emptyDocument: "Start writing, or type / for blocks" } },
    },
    [],
  );
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dirty = useRef(false);

  const flush = () => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    onSave(editor.document as never).catch(console.error);
  };

  // The native screen calls flush() before it leaves; pagehide covers the app going away.
  useDOMImperativeHandle(ref as Ref<PageEditorRef>, () => ({ flush }), []);
  useEffect(() => {
    addEventListener("pagehide", flush);
    return () => removeEventListener("pagehide", flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Tapping empty space puts the caret at the end, adding a line if the last one has text. */
  const focusEnd = () => {
    const blocks = editor.document;
    const last = blocks[blocks.length - 1];
    const empty = last && last.type === "paragraph" && Array.isArray(last.content) && last.content.length === 0 && last.children.length === 0;
    const target = last && !empty ? editor.insertBlocks([{ type: "paragraph" }], last, "after")[0]?.id : last?.id;
    if (target) editor.setTextCursorPosition(target, "end");
    editor.focus();
  };

  const vars = {
    "--bg": colors.bg,
    "--surface": colors.surface,
    "--text": colors.text,
    "--muted": colors.muted,
    "--faint": colors.faint,
    "--hover": colors.hover,
    "--active": colors.active,
    "--border": colors.border,
    "--accent": colors.accent,
    "--accent-soft": colors.accentSoft,
    "--accent-text": colors.accentText,
    "--selection": colors.selection,
    "--shadow": colors.shadow,
  } as CSSProperties;

  return (
    <div
      className="page"
      style={vars}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          focusEnd();
        }
      }}
    >
      <style>{css}</style>
      <button className="icon-tile" onClick={() => onIconPress()} aria-label="Change icon">
        <span dangerouslySetInnerHTML={svg(icon?.name ?? "file-text", 28, icon?.color ?? colors.muted)} />
      </button>
      <Title initial={title} onRename={onRename} onEnter={() => editor.focus()} />
      <BlockNoteView
        editor={editor}
        theme={dark ? "dark" : "light"}
        slashMenu={false}
        emojiPicker={false}
        onChange={() => {
          dirty.current = true;
          clearTimeout(timer.current);
          timer.current = setTimeout(flush, SAVE_DELAY);
        }}
      >
        <SuggestionMenuController<(query: string) => Promise<SlashItem[]>>
          triggerCharacter="/"
          getItems={async (query) => filterSlashItems(slashItems(editor), query)}
          suggestionMenuComponent={SlashMenu}
          onItemClick={(item) => item.onItemClick()}
        />
      </BlockNoteView>
      <div
        className="filler"
        onPointerDown={(e) => {
          e.preventDefault();
          focusEnd();
        }}
      />
    </div>
  );
}

function SlashMenu({ items, selectedIndex, onItemClick }: SuggestionMenuProps<SlashItem>) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${selectedIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);
  if (!items.length) return <div className="slash empty">No blocks match</div>;
  let group = "";
  return (
    <div ref={list} className="slash" onPointerDown={(e) => e.preventDefault()}>
      {items.map((item, i) => {
        const header = item.group !== group ? item.group : null;
        group = item.group;
        return (
          <div key={item.key}>
            {header && <div className="slash-group">{header}</div>}
            <button data-index={i} className={i === selectedIndex ? "slash-item selected" : "slash-item"} onClick={() => onItemClick?.(item)}>
              <span className="slash-icon" dangerouslySetInnerHTML={svg(item.icon, 18)} />
              <span className="slash-text">
                <span className="slash-title">{item.title}</span>
                <span className="slash-sub">{item.subtext}</span>
              </span>
              {item.shortcut && <span className="slash-key">{item.shortcut}</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Title({ initial, onRename, onEnter }: { initial: string; onRename: (t: string) => Promise<void>; onEnter: () => void }) {
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder="Untitled"
      className="title"
      onChange={(e) => {
        const next = e.target.value.replace(/\n/g, "");
        setValue(next);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => onRename(next).catch(console.error), 300);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter();
        }
      }}
    />
  );
}

const css = `
  html, body { margin: 0; background: var(--bg); -webkit-tap-highlight-color: transparent; }
  *, *:focus, *:focus-visible { outline: none !important; }
  ::selection { background: var(--selection); }
  .page { min-height: 100vh; padding: 6px 0 0; background: var(--bg); color: var(--text); font-family: Inter, system-ui, sans-serif; }
  .icon-tile { display: grid; place-items: center; width: 56px; height: 56px; margin: 8px 0 14px 22px; border: 0; border-radius: 18px; background: var(--hover); }
  .title { box-sizing: border-box; display: block; width: 100%; padding: 0 22px; margin: 0 0 14px; border: 0; resize: none; overflow: hidden;
    background: transparent; color: inherit; font: 600 32px/1.18 "Fraunces Variable", Georgia, serif; letter-spacing: -0.01em; font-variation-settings: "SOFT" 60; }
  .title::placeholder { color: var(--faint); }
  .filler { min-height: 45vh; }

  .bn-container[data-color-scheme] {
    --bn-colors-editor-background: transparent; --bn-colors-editor-text: var(--text);
    --bn-colors-menu-background: var(--surface); --bn-colors-menu-text: var(--text);
    --bn-colors-tooltip-background: var(--surface); --bn-colors-tooltip-text: var(--text);
    --bn-colors-hovered-background: var(--hover); --bn-colors-hovered-text: var(--text);
    --bn-colors-selected-background: var(--accent-soft); --bn-colors-selected-text: var(--text);
    --bn-colors-disabled-background: var(--hover); --bn-colors-disabled-text: var(--faint);
    --bn-colors-shadow: var(--shadow); --bn-colors-border: transparent; --bn-colors-side-menu: var(--faint);
    --bn-border-radius: 12px; --mantine-color-default-border: transparent;
  }
  .bn-container .bn-editor { padding-inline: 22px; background: transparent; font-size: 16.5px; line-height: 1.65; }
  .bn-container [data-is-empty-and-focused] .bn-inline-content::before { color: var(--faint); }
  .bn-block-content[data-content-type="heading"] h1, .bn-block-content[data-content-type="heading"] h2, .bn-block-content[data-content-type="heading"] h3 {
    font-family: "Fraunces Variable", Georgia, serif; font-weight: 600; font-variation-settings: "SOFT" 60; }
  .bn-block-content[data-content-type="quote"] blockquote { border-left: 3px solid var(--accent-soft); color: var(--muted); font-style: italic; }
  .bn-block-content[data-content-type="codeBlock"] { background: var(--hover); border-radius: 12px; }
  .bn-block-content[data-content-type="checkListItem"] input[type="checkbox"] { accent-color: var(--accent); }
  .bn-block-content[data-content-type="checkListItem"][data-checked="true"] .bn-inline-content { color: var(--faint); }
  .bn-container .mantine-Menu-dropdown, .bn-container .bn-toolbar, .bn-container .mantine-Popover-dropdown { border: none !important; box-shadow: 0 18px 40px -18px var(--shadow) !important; }

  .lumen-callout { display: flex; gap: 10px; align-items: flex-start; width: 100%; padding: 12px 14px 12px 10px; border-radius: 14px; background: var(--accent-soft); }
  .lumen-callout-icon { flex: none; display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 9px; background: transparent; color: var(--accent); }
  .lumen-callout-content { flex: 1; min-width: 0; }

  .slash { width: min(330px, 88vw); max-height: min(380px, 50vh); overflow-y: auto; padding: 6px; border-radius: 18px; background: var(--surface);
    color: var(--text); box-shadow: 0 24px 60px -18px var(--shadow), 0 4px 14px -6px var(--shadow); font-family: Inter, system-ui, sans-serif; }
  .slash.empty { padding: 12px 16px; font-size: 13px; color: var(--muted); }
  .slash-group { padding: 10px 10px 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--faint); }
  .slash-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 6px 8px; border: 0; border-radius: 12px; background: transparent; color: inherit; text-align: left; font: inherit; }
  .slash-item.selected { background: var(--hover); }
  .slash-icon { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 10px; background: var(--hover); color: var(--muted); }
  .slash-item.selected .slash-icon { background: var(--accent); color: var(--accent-text); }
  .slash-text { flex: 1; min-width: 0; }
  .slash-title { display: block; font-size: 14px; }
  .slash-sub { display: block; font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .slash-key { font: 11px ui-monospace, monospace; color: var(--faint); }
`;
