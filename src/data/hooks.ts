import { useEffect, useState } from "react";
import { lumen } from "../db/lumen";

/** Runs `load` now and again after every write and whenever the account or its access changes. */
export function useLive<T>(load: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let current = true;
    const run = () => load().then((v) => current && setValue(v), console.error);
    run();
    const offData = lumen.onChange(run);
    const offAccount = lumen.account.onChange(run);
    return () => {
      current = false;
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
