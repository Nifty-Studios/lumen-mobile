// Friends: add people by email; they show up first when you share, so sharing takes one tap.

import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import type { Friend } from "@lumen/shared";
import { AccountError } from "@lumen/shared/client";
import { lumen } from "../db/lumen";
import { useAccount } from "../data/hooks";
import { Icon } from "../components/Icon";
import { useFriends } from "../lib/friends";
import { useColors } from "../theme";

export default function Friends() {
  const c = useColors();
  const { user } = useAccount();
  const [friends, setFriends] = useFriends();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

  if (!user)
    return (
      <View style={[styles.wrap, { backgroundColor: c.bg, flex: 1 }]}>
        <Text style={{ color: c.muted, fontSize: 15, lineHeight: 21 }}>Sign in to add friends.</Text>
        <Pressable onPress={() => router.replace("/signin")} style={[styles.primary, { backgroundColor: c.accent }]}>
          <Text style={{ color: c.accentText, fontWeight: "600", fontSize: 15 }}>Sign in or create an account</Text>
        </Pressable>
      </View>
    );

  const act = async (task: () => Promise<Friend[]>, done?: string) => {
    setBusy(true);
    setMessage(undefined);
    try {
      setFriends(await task());
      if (done) setMessage({ text: done });
      return true;
    } catch (e) {
      setMessage({ text: e instanceof AccountError ? e.message : String(e), error: true });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const groups: [string, Friend[]][] = [
    ["ASKED YOU", friends?.filter((f) => f.status === "incoming") ?? []],
    ["FRIENDS", friends?.filter((f) => f.status === "accepted") ?? []],
    ["WAITING FOR THEM", friends?.filter((f) => f.status === "outgoing") ?? []],
  ];

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20, marginBottom: 14 }}>Friends show up first when you share, so sharing takes one tap.</Text>
      <TextInput
        style={[styles.input, { backgroundColor: c.hover, color: c.text }]}
        placeholder="Their email address"
        placeholderTextColor={c.faint}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Pressable
        disabled={busy || !email.trim()}
        onPress={async () => {
          const to = email.trim();
          if (await act(() => lumen.account.addFriend(to), `Friend request sent to ${to}`)) setEmail("");
        }}
        style={[styles.primary, { backgroundColor: c.accent, opacity: busy || !email.trim() ? 0.6 : 1 }]}
      >
        {busy ? <ActivityIndicator color={c.accentText} /> : <Text style={{ color: c.accentText, fontWeight: "600", fontSize: 15 }}>Add friend</Text>}
      </Pressable>
      {message ? <Text style={{ color: message.error ? c.danger : c.muted, marginTop: 10, lineHeight: 19 }}>{message.text}</Text> : null}

      {!friends ? <ActivityIndicator color={c.muted} style={{ marginTop: 24 }} /> : null}
      {friends?.length === 0 ? <Text style={{ color: c.muted, marginTop: 24, lineHeight: 20 }}>No friends yet. Add someone by the email they use for Lumen.</Text> : null}
      {groups.map(([title, list]) =>
        list.length ? (
          <View key={title}>
            <Text style={[styles.section, { color: c.faint }]}>{title}</Text>
            {list.map((f) => (
              <View key={f.id} style={styles.person}>
                <View style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
                  <Text style={{ color: c.accent, fontWeight: "600" }}>{f.user.name[0]?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 15 }} numberOfLines={1}>
                    {f.user.name}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 12.5 }} numberOfLines={1}>
                    {f.user.email}
                  </Text>
                </View>
                {f.status === "incoming" ? (
                  <Pressable disabled={busy} onPress={() => void act(() => lumen.account.acceptFriend(f.id))} style={[styles.small, { backgroundColor: c.accent }]}>
                    <Icon name="user-check" size={15} color={c.accentText} />
                    <Text style={{ color: c.accentText, fontWeight: "600" }}>Accept</Text>
                  </Pressable>
                ) : null}
                <Pressable disabled={busy} onPress={() => void act(() => lumen.account.removeFriend(f.id))} style={[styles.small, { backgroundColor: c.hover }]}>
                  <Text style={{ color: c.muted }}>{f.status === "incoming" ? "Decline" : f.status === "outgoing" ? "Cancel" : "Remove"}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null,
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 18, paddingBottom: 48 },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15.5 },
  primary: { borderRadius: 14, paddingVertical: 13, alignItems: "center", marginTop: 12 },
  section: { fontSize: 11, letterSpacing: 1.5, fontWeight: "600", marginTop: 24, marginBottom: 6 },
  person: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  small: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
});
