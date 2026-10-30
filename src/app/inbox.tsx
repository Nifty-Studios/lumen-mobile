// Notifications: pages and workspaces shared with you, friend requests. Tapping one opens what
// it's about; friend requests can be answered right here.

import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import type { LumenNotification } from "@lumen/shared";
import type { IconName } from "@lumen/shared/icons";
import { lumen } from "../db/lumen";
import { Icon } from "../components/Icon";
import { ago, openNotification, useInbox } from "../lib/notifications";
import { useColors } from "../theme";

const ICON: Record<LumenNotification["kind"], IconName> = {
  page_shared: "file-text",
  space_shared: "layers",
  friend_request: "user-plus",
  friend_accepted: "user-check",
};

export default function Inbox() {
  const c = useColors();
  const { items, unread } = useInbox();
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => void lumen.refreshInbox(), []);

  const answer = async (n: LumenNotification, accept: boolean) => {
    if (!n.friendship_id) return;
    setBusy(n.id);
    setError(undefined);
    try {
      if (accept) await lumen.account.acceptFriend(n.friendship_id);
      else await lumen.account.removeFriend(n.friendship_id);
      await lumen.inbox.markRead([n.id]);
      await lumen.refreshInbox();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={{
          headerRight: () =>
            items.length ? (
              <Pressable hitSlop={8} onPress={() => (unread ? lumen.inbox.markRead() : lumen.inbox.clear())} style={{ paddingHorizontal: 6 }}>
                <Text style={{ color: c.accent, fontSize: 15 }}>{unread ? "Mark all read" : "Clear"}</Text>
              </Pressable>
            ) : null,
        }}
      />
      {error ? <Text style={{ color: c.danger, paddingHorizontal: 18, paddingTop: 10 }}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 10, paddingBottom: 40, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[c.accent]}
            progressBackgroundColor={c.surface}
            onRefresh={async () => {
              setRefreshing(true);
              await lumen.refreshInbox();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="bell" size={30} color={c.faint} />
            <Text style={{ color: c.muted, fontSize: 15, textAlign: "center", lineHeight: 21 }}>Nothing yet. Pages shared with you and friend requests show up here.</Text>
          </View>
        }
        renderItem={({ item: n }) => {
          const pendingRequest = n.kind === "friend_request" && !n.read_at;
          return (
            <Pressable
              android_ripple={{ color: c.hover }}
              onPress={() => !pendingRequest && void openNotification(n)}
              style={styles.row}
            >
              <View style={[styles.tile, { backgroundColor: n.read_at ? c.hover : c.accentSoft }]}>
                <Icon name={ICON[n.kind]} size={19} color={n.read_at ? c.muted : c.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontSize: 15, fontWeight: n.read_at ? "400" : "600", lineHeight: 20 }}>{n.title}</Text>
                <Text style={{ color: c.muted, fontSize: 13.5, lineHeight: 19, marginTop: 2 }}>{n.body}</Text>
                <Text style={{ color: c.faint, fontSize: 12, marginTop: 4 }}>{ago(n.created_at)}</Text>
                {pendingRequest ? (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    <Pressable disabled={busy === n.id} onPress={() => void answer(n, true)} style={[styles.button, { backgroundColor: c.accent }]}>
                      {busy === n.id ? <ActivityIndicator size="small" color={c.accentText} /> : <Text style={{ color: c.accentText, fontWeight: "600" }}>Accept</Text>}
                    </Pressable>
                    <Pressable disabled={busy === n.id} onPress={() => void answer(n, false)} style={[styles.button, { backgroundColor: c.hover }]}>
                      <Text style={{ color: c.text }}>Decline</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
              {!n.read_at ? <View style={[styles.dot, { backgroundColor: c.accent }]} /> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, padding: 12, borderRadius: 18 },
  tile: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
  button: { minWidth: 92, alignItems: "center", paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
});
