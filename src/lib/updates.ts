// App updates: when Lumen opens (and comes back to the front), it reads the release list in
// the download bucket. A newer version shows a banner; "Download" fetches the APK, and
// "Install" opens Android's own installer for it (Android always asks the person to confirm,
// and the first time to allow installs from Lumen).

import { useEffect, useState } from "react";
import { AppState } from "react-native";
import * as Application from "expo-application";
import { File, Paths } from "expo-file-system";
import { getContentUriAsync } from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";

const BASE = "https://pub-069d921642c646cd94244c50a3494c14.r2.dev";
/** Checked at most this often while the app keeps coming back to the front. */
const CHECK_EVERY = 3 * 60 * 60_000;
const FLAG_GRANT_READ_URI_PERMISSION = 1;

export type UpdateState =
  | { phase: "idle" }
  | { phase: "available"; version: string }
  | { phase: "downloading"; version: string; progress: number }
  | { phase: "ready"; version: string }
  | { phase: "error"; version: string };

let state: UpdateState = { phase: "idle" };
let release: { version: string; versioned: string } | null = null;
let lastCheck = 0;
const snoozed = new Set<string>();
const listeners = new Set<(s: UpdateState) => void>();
const announced = new Set<(version: string) => void>();

function set(next: UpdateState) {
  state = next;
  for (const l of listeners) l(state);
}

/** 1.2.10 > 1.2.9 */
function newer(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0;
  }
  return false;
}

const apkFile = (version: string) => new File(Paths.cache, `Lumen-${version}.apk`);

async function checkNow() {
  if (__DEV__ || state.phase !== "idle" || Date.now() - lastCheck < CHECK_EVERY) return;
  lastCheck = Date.now();
  try {
    const manifest = await fetch(`${BASE}/manifest.json`, { cache: "no-store" }).then((r) => r.json());
    const latest = manifest?.android as { version: string; versioned: string } | undefined;
    const current = Application.nativeApplicationVersion;
    // The update that was just installed leaves its APK behind.
    if (current && apkFile(current).exists) apkFile(current).delete();
    if (!latest || !current || !newer(latest.version, current) || snoozed.has(latest.version)) return;
    release = latest;
    set(apkFile(latest.version).exists ? { phase: "ready", version: latest.version } : { phase: "available", version: latest.version });
    for (const l of announced) l(latest.version);
  } catch {
    // Offline: try again next time.
  }
}

export const updates = {
  /** Checks now and whenever Lumen comes back to the front. Returns a stop function. */
  start() {
    void checkNow();
    const sub = AppState.addEventListener("change", (s) => s === "active" && void checkNow());
    return () => sub.remove();
  },
  /** Called once when a new version is found (for the chime). */
  onAvailable(listener: (version: string) => void) {
    announced.add(listener);
    return () => void announced.delete(listener);
  },
  async download() {
    if (!release || state.phase !== "available") return;
    const { version, versioned } = release;
    set({ phase: "downloading", version, progress: 0 });
    try {
      const file = apkFile(version);
      if (file.exists) file.delete();
      await File.downloadFileAsync(`${BASE}/${versioned}`, file, {
        idempotent: true,
        onProgress: ({ bytesWritten, totalBytes }) => totalBytes > 0 && set({ phase: "downloading", version, progress: bytesWritten / totalBytes }),
      });
      set({ phase: "ready", version });
    } catch {
      set({ phase: "error", version });
    }
  },
  async install() {
    if (state.phase !== "ready") return;
    const uri = await getContentUriAsync(apkFile(state.version).uri);
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: uri,
      type: "application/vnd.android.package-archive",
      flags: FLAG_GRANT_READ_URI_PERMISSION,
    });
  },
  later() {
    if (state.phase === "idle") return;
    snoozed.add(state.version);
    set({ phase: "idle" });
  },
  retry() {
    if (state.phase !== "error") return;
    set({ phase: "available", version: state.version });
    void updates.download();
  },
};

export function useUpdate(): UpdateState {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    return () => void listeners.delete(setS);
  }, []);
  return s;
}
