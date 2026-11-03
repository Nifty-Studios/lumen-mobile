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
  /** `installFailed`: Android refused the APK (not a download problem). */
  | { phase: "error"; version: string; installFailed?: boolean };

let state: UpdateState = { phase: "idle" };
let release: { version: string; versioned: string; bytes?: number } | null = null;
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
// Downloads land here first and become the APK only once complete: a download cut short
// (the app sent to the background, the network dropped) used to leave a partial APK behind
// that counted as "ready", and Android then said "App not installed".
const partFile = (version: string) => new File(Paths.cache, `Lumen-${version}.apk.part`);

/** The APK for a version, if it's all there (same size as the release says). */
function completeApk(version: string, bytes: number | undefined) {
  const file = apkFile(version);
  if (!file.exists) return undefined;
  if (bytes && file.size !== bytes) {
    file.delete();
    return undefined;
  }
  return file;
}

async function checkNow() {
  if (__DEV__ || state.phase !== "idle" || Date.now() - lastCheck < CHECK_EVERY) return;
  lastCheck = Date.now();
  try {
    const manifest = await fetch(`${BASE}/manifest.json`, { cache: "no-store" }).then((r) => r.json());
    const latest = manifest?.android as { version: string; versioned: string; bytes?: number } | undefined;
    const current = Application.nativeApplicationVersion;
    // The update that was just installed leaves its APK behind.
    if (current && apkFile(current).exists) apkFile(current).delete();
    if (!latest || !current || !newer(latest.version, current) || snoozed.has(latest.version)) return;
    release = latest;
    set(completeApk(latest.version, latest.bytes) ? { phase: "ready", version: latest.version } : { phase: "available", version: latest.version });
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
    const { version, versioned, bytes } = release;
    set({ phase: "downloading", version, progress: 0 });
    try {
      const part = partFile(version);
      if (part.exists) part.delete();
      const apk = apkFile(version);
      if (apk.exists) apk.delete();
      await File.downloadFileAsync(`${BASE}/${versioned}`, part, {
        idempotent: true,
        onProgress: ({ bytesWritten, totalBytes }) => totalBytes > 0 && set({ phase: "downloading", version, progress: bytesWritten / totalBytes }),
      });
      if (bytes && part.size !== bytes) throw new Error(`Downloaded ${part.size} of ${bytes} bytes`);
      part.move(apk);
      set({ phase: "ready", version });
    } catch {
      if (partFile(version).exists) partFile(version).delete();
      set({ phase: "error", version });
    }
  },
  async install() {
    if (state.phase !== "ready") return;
    const version = state.version;
    const apk = completeApk(version, release?.bytes);
    if (!apk) return set({ phase: "available", version });
    const uri = await getContentUriAsync(apk.uri);
    // INSTALL_PACKAGE with RETURN_RESULT tells us when Android refuses the APK, instead of
    // leaving the person on its "App not installed" screen with a card that says "ready".
    const result = await IntentLauncher.startActivityAsync("android.intent.action.INSTALL_PACKAGE", {
      data: uri,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
      extra: { "android.intent.extra.RETURN_RESULT": true },
    }).catch(() => undefined);
    // Success replaces the app, so we only get here when it didn't happen.
    if (result?.resultCode === IntentLauncher.ResultCode.FirstUser) {
      // Refused: the file may be damaged, so the next try downloads it again.
      if (apk.exists) apk.delete();
      set({ phase: "error", version, installFailed: true });
    }
  },
  later() {
    if (state.phase === "idle") return;
    snoozed.add(state.version);
    set({ phase: "idle" });
  },
  retry() {
    if (state.phase !== "error") return;
    const version = state.version;
    set({ phase: "available", version });
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
