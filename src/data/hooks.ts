import { useEffect, useState } from "react";
import { lumen } from "../db/lumen";

/** Runs `load` now and again after every write and whenever the account or its access changes. */
export function useLive<T>(load: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let current = true;
    let queued: ReturnType<typeof setTimeout> | undefined;
    const now = () => load().then((v) => current && setValue(v), console.error);
    // A burst of writes (typing, a sync pull) reloads once, not once per write.
    const run = () => {
      if (queued === undefined) queued = setTimeout(() => ((queued = undefined), now()), 60);
    };
    now();
    const offData = lumen.onChange(run);
    const offAccount = lumen.account.onChange(run);
    return () => {
      current = false;
      clearTimeout(queued);
      offData();
      offAccount();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

/** The signed-in account (or undefined), kept current. */
export function useAccount() {
  const [, render] = useState(0);
  useEffect(() => lumen.account.onChange(() => render((n) => n + 1)), []);
  const { account } = lumen;
  return { user: account.current?.user, reminderDue: account.reminderDue(), skipped: account.skipped, available: account.available };
}
