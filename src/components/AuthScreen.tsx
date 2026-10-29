// Create an account or log in, over the live sky. At first launch it has "Later" (stay on
// this phone only); opened later from Settings or the home card, it has a close button.

import { useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MIN_PASSWORD } from "@lumen/shared";
import { AccountError, AccountSwitchError } from "@lumen/shared/client";
import { lumen } from "../db/lumen";
import { SkyCard } from "../ambient/SkyCard";
import { Icon } from "./Icon";
import { FONTS, useColors } from "../theme";

type Mode = "signup" | "login";

export function AuthScreen({ onDone, onLater, onClose }: { onDone: () => void; onLater?: () => void; onClose?: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [blocked, setBlocked] = useState<AccountSwitchError>();
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const submit = async (discardUnsent = false) => {
    if (busy) return;
    if (mode === "signup" && password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
    setBusy(true);
    setError(undefined);
    setBlocked(undefined);
    try {
      if (mode === "signup") await lumen.signUp({ name: name.trim(), email: email.trim(), password }, { discardUnsent });
      else await lumen.logIn({ email: email.trim(), password }, { discardUnsent });
      onDone();
    } catch (e) {
      if (e instanceof AccountSwitchError) setBlocked(e);
      else setError(e instanceof AccountError ? e.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  const field = { backgroundColor: c.hover, color: c.text };
  return (
    <View style={{ flex: 1, backgroundColor: c.tokens.skyBottom }}>
      <View style={StyleSheet.absoluteFill}>
        <SkyCard height={height + insets.top} bodyTop={insets.top + 90} />
      </View>
      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.center, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: c.tokens.glass }]}>
            {onClose ? (
              <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel="Close">
                <Icon name="x" size={20} color={c.muted} />
              </Pressable>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={[styles.logo, { backgroundColor: c.tokens.accentSoft }]}>
                <Icon name="sun" size={22} color={c.accent} />
              </View>
              <Text style={{ fontFamily: FONTS.serif, fontSize: 34, color: c.text }}>Lumen</Text>
            </View>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 18 }}>
              {mode === "signup" ? "Your notes on every device, and shared with whoever you choose." : "Welcome back. Your notes are waiting."}
            </Text>

            <View style={[styles.tabs, { backgroundColor: c.hover }]}>
              {(["signup", "login"] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    setMode(m);
                    setError(undefined);
                  }}
                  style={[styles.tab, mode === m && { backgroundColor: c.surface }]}
                >
                  <Text style={{ color: mode === m ? c.text : c.muted, fontSize: 14 }}>{m === "signup" ? "Create account" : "Log in"}</Text>
                </Pressable>
              ))}
            </View>

            {mode === "signup" ? (
              <TextInput style={[styles.input, field]} placeholder="Your name" placeholderTextColor={c.faint} value={name} onChangeText={setName} autoComplete="name" autoFocus returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => emailRef.current?.focus()} />
            ) : null}
            <TextInput
              ref={emailRef}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
              style={[styles.input, field]}
              placeholder="Email"
              placeholderTextColor={c.faint}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextInput
              ref={passwordRef}
              returnKeyType="done"
              style={[styles.input, field]}
              placeholder={mode === "signup" ? `Password (${MIN_PASSWORD}+ characters)` : "Password"}
              placeholderTextColor={c.faint}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              onSubmitEditing={() => submit()}
            />

            {blocked ? (
              <View style={[styles.notice, { backgroundColor: c.hover }]}>
                <Text style={{ color: c.text, fontSize: 13.5, lineHeight: 19 }}>
                  The notes on this phone belong to {blocked.owner}, and {blocked.pending} of their {blocked.pending === 1 ? "change hasn't" : "changes haven't"} reached
                  their account yet. Connect to the internet and try again to keep {blocked.pending === 1 ? "it" : "them"}.
                </Text>
                <Pressable onPress={() => submit(true)} style={{ marginTop: 8 }}>
                  <Text style={{ color: c.tokens.danger, fontWeight: "600" }}>Discard {blocked.pending === 1 ? "it" : "them"} and continue</Text>
                </Pressable>
              </View>
            ) : null}
            {error ? <Text style={{ color: c.tokens.danger, fontSize: 13.5, marginTop: 10 }}>{error}</Text> : null}

            <Pressable onPress={() => submit()} disabled={busy} style={({ pressed }) => [styles.primary, { backgroundColor: c.accent, opacity: pressed || busy ? 0.75 : 1 }]}>
              {busy ? <ActivityIndicator color={c.accentText} /> : <Text style={{ color: c.accentText, fontSize: 15, fontWeight: "600" }}>{mode === "signup" ? "Create account" : "Log in"}</Text>}
            </Pressable>
            {onLater ? (
              <Pressable onPress={onLater} style={styles.later}>
                <Text style={{ color: c.muted, fontSize: 13.5 }}>Later · keep my notes on this phone for now</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 18 },
  card: { borderRadius: 28, padding: 24 },
  close: { position: "absolute", top: 16, right: 16, zIndex: 1 },
  logo: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", borderRadius: 14, padding: 4, marginBottom: 12 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 11 },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15.5, marginTop: 10 },
  notice: { borderRadius: 14, padding: 12, marginTop: 12 },
  primary: { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  later: { alignItems: "center", paddingVertical: 12, marginTop: 4 },
});
