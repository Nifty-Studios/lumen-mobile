// One spellchecker for the app, on the native side: every page's editor is its own webview,
// and loading the dictionary there each time would stall the page. The editor asks
// `misspelled` and `suggest` through its async actions instead.

import { defaultSpelling, loadSpellchecker, type Spellchecker, type SpellingVariant } from "@lumen/shared/spell";
import { lumen } from "../db/lumen";

const listeners = new Set<() => void>();
let current: { variant: SpellingVariant; ready: Promise<Spellchecker> } | undefined;

const variant = (): SpellingVariant => {
  const s = lumen.getSettings().spelling;
  return s === "auto" ? defaultSpelling() : s;
};

export function spellchecker() {
  const v = variant();
  if (current?.variant !== v)
    current = {
      variant: v,
      // A beat after the page opens, so the parse doesn't hold up its first frames.
      ready: new Promise<void>((r) => setTimeout(r, 400))
        .then(() => loadSpellchecker(v))
        .then((s) => {
          s.setPersonal(lumen.dictionary.words());
          return s;
        }),
    };
  return current.ready;
}

lumen.dictionary.onChange((words) => {
  void current?.ready.then((s) => {
    s.setPersonal(words);
    listeners.forEach((l) => l());
  });
});
let lastSpelling = lumen.getSettings().spelling;
lumen.onSettings((s) => {
  if (s.spelling === lastSpelling) return;
  lastSpelling = s.spelling;
  listeners.forEach((l) => l());
});

/** The dictionary or the spelling changed: open editors check their words again. */
export function onSpellChange(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export const misspelled = async (words: string[]) => (await spellchecker()).misspelled(words);
export const suggest = async (word: string) => (await spellchecker()).suggest(word);
