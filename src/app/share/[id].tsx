// Share a page (and the pages inside it) or the whole workspace. Invites need no email: they
// apply as soon as that address signs up or logs in.

import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { canEdit, type Person, type Role } from "@lumen/shared";
import { AccountError, pageTitle } from "@lumen/shared/client";
import { lumen } from "../../db/lumen";
import { useAccount, useLive } from "../../data/hooks";
import { Icon } from "../../components/Icon";
import { FONTS, useColors } from "../../theme";

type Tab = "page" | "workspace";
const ROLE_LABEL: Record<Role, string> = { owner: "Owner", editor: "Can edit", viewer: "Can view" };

export default function Share() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { user } = useAccount();
  const page = useLive(() => lumen.getBlock(id), [id]);
  const spaces = useLive(lumen.listSpaces, []) ?? [];
  const space = spaces.find((s) => s.space.id === page?.space_id);
  const [tab, setTab] = useState<Tab>("page");
  const [people, setPeople] = useState<Person[]>();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const canManage = tab === "page" ? canEdit(space?.role) : space?.role === "owner";
  const roles: Role[] = tab === "page" ? ["editor", "viewer"] : ["owner", "editor", "viewer"];
  const spaceId = page?.space_id ?? "";

  useEffect(() => {
    if (!user || !page) return;
    setPeople(undefined);
    setError(undefined);
    if (tab === "workspace" && !space) return setPeople([]);
    (tab === "page" ? lumen.account.pageShares(id) : lumen.account.members(spaceId)).then(setPeople, (e) =>
      setError(e instanceof AccountError ? e.message : String(e)),
    );
  }, [tab, id, spaceId, user, page, space]);

  const run = async (task: () => Promise<Person[]>) => {
    setBusy(true);
    setError(undefined);
    try {
      setPeople(await task());
      return true;
    } catch (e) {
      setError(e instanceof AccountError ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const share = (to: string, r: Role) =>
    run(() => (tab === "page" ? lumen.account.sharePage(id, { email: to, role: r === "viewer" ? "viewer" : "editor" }) : lumen.account.invite(spaceId, { email: to, role: r })));
  const remove = (p: Person) => run(() => (tab === "page" ? lumen.account.unsharePage(id, p.email) : lumen.account.removeMember(spaceId, p.email)));

  const personActions = (p: Person) =>
    Alert.alert(p.name ?? p.email, p.pending ? "Invited · joins when they sign up" : p.email, [
      ...roles.filter((r) => r !== p.role).map((r) => ({ text: ROLE_LABEL[r], onPress: () => void share(p.email, r) })),
      { text: "Remove", style: "destructive" as const, onPress: () => void remove(p) },
      { text: "Cancel", style: "cancel" as const },
    ]);

  if (!page) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  if (!user)
    return (
      <View style={[styles.wrap, { backgroundColor: c.bg }]}>
        <Text style={{ color: c.muted, fontSize: 15, lineHeight: 21 }}>Sign in to share pages.</Text>
        <Pressable onPress={() => router.replace("/signin")} style={[styles.primary, { backgroundColor: c.accent }]}>
          <Text style={{ color: c.accentText, fontWeight: "600", fontSize: 15 }}>Sign in or create an account</Text>
        </Pressable>
      </View>
    );

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={{ color: c.muted, fontSize: 14, marginBottom: 14 }} numberOfLines={2}>
        {tab === "page" ? `“${pageTitle(page)}” and the pages inside it` : `Everything in ${space?.space.name ?? "this workspace"}`}
      </Text>
      {space ? (
        <View style={[styles.tabs, { backgroundColor: c.hover }]}>
          {(["page", "workspace"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                setTab(t);
                setRole("editor");
              }}
              style={[styles.tab, tab === t && { backgroundColor: c.surface }]}
            >
              <Text style={{ color: tab === t ? c.text : c.muted }}>{t === "page" ? "This page" : "Workspace"}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {canManage ? (
        <>
          <TextInput
            style={[styles.input, { backgroundColor: c.hover, color: c.text }]}
            placeholder="Email address"
            placeholderTextColor={c.faint}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {roles.map((r) => (
              <Pressable key={r} onPress={() => setRole(r)} style={[styles.chip, { backgroundColor: role === r ? c.accent : c.hover }]}>
                <Text style={{ color: role === r ? c.accentText : c.text }}>{ROLE_LABEL[r]}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            disabled={busy || !email.trim()}
            onPress={async () => (await share(email.trim(), role)) && setEmail("")}
            style={[styles.primary, { backgroundColor: c.accent, opacity: busy || !email.trim() ? 0.6 : 1 }]}
          >
            {busy ? <ActivityIndicator color={c.accentText} /> : <Text style={{ color: c.accentText, fontWeight: "600", fontSize: 15 }}>Invite</Text>}
          </Pressable>
        </>
      ) : (
        <Text style={[styles.note, { backgroundColor: c.hover, color: c.muted }]}>
          {tab === "page" ? "Only people who can edit this workspace can share its pages." : "Only owners can invite people to the workspace."}
        </Text>
      )}
      {error ? <Text style={{ color: c.danger, marginTop: 10 }}>{error}</Text> : null}

      <Text style={[styles.section, { color: c.faint }]}>{tab === "page" ? "SHARED WITH" : "MEMBERS"}</Text>
      {!people ? <ActivityIndicator color={c.muted} style={{ marginTop: 12 }} /> : null}
      {people?.length === 0 ? <Text style={{ color: c.muted }}>{tab === "page" ? "Only people in the workspace can see this page." : "Nobody yet."}</Text> : null}
      {people?.map((p) => {
        const me = p.email === user.email;
        return (
          <Pressable key={p.email} disabled={!canManage || me} onPress={() => personActions(p)} android_ripple={{ color: c.hover }} style={styles.person}>
            <View style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
              <Text style={{ color: c.accent, fontWeight: "600" }}>{(p.name ?? p.email)[0]!.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 15 }} numberOfLines={1}>
                {p.name ?? p.email}
                {me ? <Text style={{ color: c.faint }}> (you)</Text> : null}
              </Text>
              <Text style={{ color: c.muted, fontSize: 12.5 }} numberOfLines={1}>
                {p.pending ? "Invited · joins when they sign up" : p.email}
              </Text>
            </View>
            <Text style={{ color: c.muted, fontSize: 13 }}>{ROLE_LABEL[p.role]}</Text>
            {canManage && !me ? <Icon name="chevron-down" size={15} color={c.faint} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 18, paddingBottom: 48 },
  tabs: { flexDirection: "row", borderRadius: 14, padding: 4, marginBottom: 14 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 11 },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15.5 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  primary: { borderRadius: 14, paddingVertical: 13, alignItems: "center", marginTop: 14 },
  note: { borderRadius: 14, padding: 12, fontSize: 13.5, lineHeight: 19 },
  section: { fontSize: 11, letterSpacing: 1.5, fontWeight: "600", marginTop: 24, marginBottom: 6 },
  person: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
