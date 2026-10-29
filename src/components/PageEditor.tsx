"use dom";

// The page body (title + BlockNote editor) running in a webview. It only edits; the native
// side owns the database and receives changes through the onSave/onRename actions.

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useEffect, useRef, useState, type Ref } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { Block as EditorBlock, PartialBlock } from "@blocknote/core";
import { useDOMImperativeHandle, type DOMImperativeFactory, type DOMProps } from "expo/dom";

const SAVE_DELAY = 300;

export interface PageEditorRef extends DOMImperativeFactory {
  flush: () => void;
}

interface Props {
  ref?: Ref<PageEditorRef>;
  dom?: DOMProps;
  title: string;
  initialContent: PartialBlock[] | null;
  dark: boolean;
  onSave: (doc: EditorBlock[]) => Promise<void>;
  onRename: (title: string) => Promise<void>;
}

export default function PageEditor({ ref, title, initialContent, dark, onSave, onRename }: Props) {
  const editor = useCreateBlockNote({ initialContent: initialContent ?? undefined }, []);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dirty = useRef(false);

  const flush = () => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    onSave(editor.document).catch(console.error);
  };

  // The native screen calls flush() before it leaves; pagehide covers the app going away.
  useDOMImperativeHandle(ref as Ref<PageEditorRef>, () => ({ flush }), []);
  useEffect(() => {
    addEventListener("pagehide", flush);
    return () => removeEventListener("pagehide", flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={dark ? "page dark" : "page"}>
      <style>{css}</style>
      <Title initial={title} onRename={onRename} onEnter={() => editor.focus()} />
      <BlockNoteView
        editor={editor}
        theme={dark ? "dark" : "light"}
        onChange={() => {
          dirty.current = true;
          clearTimeout(timer.current);
          timer.current = setTimeout(flush, SAVE_DELAY);
        }}
      />
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
  html, body { margin: 0; background: #ffffff; }
  @media (prefers-color-scheme: dark) { html, body { background: #191919; } }
  .page { min-height: 100vh; padding: 8px 0 160px; background: #ffffff; color: #37352f; font-family: Inter, system-ui, sans-serif; }
  .page.dark { background: #191919; color: #e6e6e4; }
  .title { box-sizing: border-box; width: 100%; padding: 0 20px 0 54px; margin: 0 0 8px; border: 0; outline: none; resize: none;
    overflow: hidden; background: transparent; color: inherit; font: 700 30px/1.25 Inter, system-ui, sans-serif; }
  .title::placeholder { color: rgba(127,127,127,.45); }
  .bn-container, .bn-editor { background: transparent !important; }
  .bn-editor { padding-inline: 54px 20px; }
`;
