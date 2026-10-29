import { useEffect, useState } from "react";
import { lumen } from "../db/lumen";

/** Runs `load` now and again after every local write. */
export function useLive<T>(load: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let current = true;
    const run = () => load().then((v) => current && setValue(v), console.error);
    run();
    const off = lumen.onChange(run);
    return () => {
      current = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
