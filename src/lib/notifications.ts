// The inbox as React state, and what tapping a notification does.

import { useEffect, useState } from "react";
import { router } from "expo-router";
import type { LumenNotification } from "@lumen/shared";
import { lumen } from "../db/lumen";

export function useInbox() {
  const [, render] = useState(0);
  useEffect(() => lumen.inbox.onChange(() => render((n) => n + 1)), []);
  return { items: lumen.inbox.items, unread: lumen.inbox.unread() };
}

export function ago(t: number) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)} d ago`;
  return new Date(t).toLocaleDateString();
}

/** Opens what a notification is about. Shared a moment ago? Syncs first so it's on the phone. */
export async function openNotification(n: LumenNotification) {
  void lumen.inbox.markRead([n.id]);
  if (n.kind === "friend_request" || n.kind === "friend_accepted") return router.push("/friends");
  if (n.kind === "space_shared" && n.space_id) {
    if (!(await lumen.listSpaces()).some((s) => s.space.id === n.space_id)) await lumen.connect().catch(() => {});
    await lumen.setCurrentSpace(n.space_id);
    return router.dismissTo("/");
  }
  if (n.page_id) {
    if (!(await lumen.getBlock(n.page_id))) await lumen.connect().catch(() => {});
    if (await lumen.getBlock(n.page_id)) router.push(`/page/${n.page_id}`);
  }
}
