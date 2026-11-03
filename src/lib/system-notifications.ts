// Android's notification bar: shares, friend requests and calendar reminders.
// - Notices (lumen.onNotice) go to the bar as they're told. In front, the in-app banner shows
//   instead of a heads-up, but they stay in the bar.
// - Reminders for the next 30 days are scheduled with Android, so they ring with Lumen closed.
// - A background task (about every 15 minutes, when Android allows) checks for new
//   notifications and tops up the reminders. Real push would need FCM; this needs nothing.

import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import type { Notice } from "@lumen/shared/client";
import { lumen } from "../db/lumen";

const TASK = "lumen-inbox";
const AHEAD = 30 * 86_400_000;
const MAX_SCHEDULED = 60;

export type NotificationData =
  | { kind: "notice"; noticeKind?: string; pageId?: string; spaceId?: string; notificationId?: string }
  | { kind: "reminder"; eventId: string; date: string };

// ---- starting -----------------------------------------------------------------------------

let started: Promise<unknown> | undefined;
/** The app's own lumen.start() (so the background task doesn't start it twice). */
export function setStarted(p: Promise<unknown>) {
  started = p;
}
const ensureStarted = () => (started ??= lumen.start());

// ---- formatting ---------------------------------------------------------------------------

function formatTime(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  const clock = lumen.getSettings().clock;
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", ...(clock === "12h" ? { hour12: true } : clock === "24h" ? { hourCycle: "h23" as const } : {}) });
}

// ---- setup --------------------------------------------------------------------------------

Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const data = n.request.content.data as NotificationData | undefined;
    const front = AppState.currentState === "active";
    // In front, a notice already has the in-app banner.
    const banner = !(front && data?.kind === "notice");
    return { shouldShowBanner: banner, shouldShowList: true, shouldPlaySound: banner, shouldSetBadge: false };
  },
});

let channels: Promise<void> | undefined;
function ensureChannels() {
  if (Platform.OS !== "android") return Promise.resolve();
  return (channels ??= (async () => {
    await Notifications.setNotificationChannelAsync("notices", {
      name: "Shares and friends",
      description: "Pages and workspaces shared with you, and friend requests.",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "notify.wav",
      lightColor: "#8ab4ff",
    });
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Calendar reminders",
      description: "Your events, holidays and your birthday.",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "notify.wav",
      lightColor: "#8ab4ff",
    });
  })());
}

async function allowed() {
  const now = await Notifications.getPermissionsAsync();
  if (now.granted) return true;
  if (!now.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

// ---- notices ------------------------------------------------------------------------------

export async function showNotice(n: Notice) {
  await ensureChannels();
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  const data: NotificationData = { kind: "notice", noticeKind: n.kind, pageId: n.pageId, spaceId: n.spaceId, notificationId: n.notificationId };
  await Notifications.scheduleNotificationAsync({
    content: { title: n.title, body: n.body, data, sound: "notify.wav" },
    trigger: { channelId: "notices" },
  });
}

// ---- reminders ----------------------------------------------------------------------------

let scheduledKey = "";
let queued: ReturnType<typeof setTimeout> | undefined;

/** Replaces the scheduled reminders with the next 30 days' worth. */
export async function rescheduleReminders() {
  await ensureChannels();
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  const now = Date.now();
  const list = (await lumen.calendar.reminders(now + 5_000, now + AHEAD, formatTime)).slice(0, MAX_SCHEDULED);
  const key = JSON.stringify(list.map((r) => [r.key, r.at, r.title, r.body]));
  if (key === scheduledKey) return;
  for (const s of await Notifications.getAllScheduledNotificationsAsync())
    if ((s.content.data as NotificationData | undefined)?.kind === "reminder") await Notifications.cancelScheduledNotificationAsync(s.identifier);
  for (const r of list) {
    const data: NotificationData = { kind: "reminder", eventId: r.eventId, date: r.date };
    await Notifications.scheduleNotificationAsync({
      identifier: `reminder-${r.key}`.slice(0, 120),
      content: { title: r.title, body: r.body, data, sound: "notify.wav" },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: "reminders" },
    });
  }
  scheduledKey = key;
}

const soon = () => {
  clearTimeout(queued);
  queued = setTimeout(() => void rescheduleReminders().catch(console.warn), 1500);
};

// ---- background ---------------------------------------------------------------------------

// Must be defined when the bundle loads: Android may run it with no screen open.
TaskManager.defineTask(TASK, async () => {
  try {
    await ensureStarted();
    listen();
    await lumen.refreshInbox();
    await rescheduleReminders();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

let listening = false;
/** Every notice also goes to the notification bar. */
function listen() {
  if (listening) return;
  listening = true;
  lumen.onNotice((n) => void showNotice(n).catch(() => {}));
}

/** Call once the app has started (not signed-in only: reminders work signed out). */
export async function startSystemNotifications() {
  listen();
  await ensureChannels();
  await allowed();
  void rescheduleReminders().catch(console.warn);
  const offData = lumen.onChange((changed) => changed.some((c) => c.table === "block") && soon());
  const offSettings = lumen.onSettings(soon);
  const offProfile = lumen.profile.onChange(soon);
  const sub = AppState.addEventListener("change", (s) => s === "active" && soon());
  try {
    if (!(await TaskManager.isTaskRegisteredAsync(TASK))) await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
  } catch (e) {
    console.warn("background task", e);
  }
  return () => {
    offData();
    offSettings();
    offProfile();
    sub.remove();
  };
}
