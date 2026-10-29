import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { lumen } from "../db/lumen";
import { useColors } from "../theme";

export default function RootLayout() {
  const c = useColors();
  const [boot, setBoot] = useState<{ error?: string; ready?: boolean }>({});

  useEffect(() => {
    lumen.start().then(
      () => setBoot({ ready: true }),
      (e) => setBoot({ error: String(e) }),
    );
  }, []);

  // Background sync once started: on an interval, after edits, and whenever the app comes back.
  useEffect(() => {
    if (!boot.ready || !lumen.sync) return;
    const stop = lumen.sync.start();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") lumen.sync?.sync().catch(() => {});
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [boot.ready]);

  if (!boot.ready)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg, padding: 24 }}>
        {boot.error ? <Text style={{ color: c.danger }}>Lumen could not start: {boot.error}</Text> : <ActivityIndicator color={c.muted} />}
      </View>
    );

  return (
    <>
      <StatusBar style={c.dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Lumen" }} />
        <Stack.Screen name="page/[id]" options={{ title: "" }} />
        <Stack.Screen name="search" options={{ title: "Search", animation: "fade" }} />
        <Stack.Screen name="trash" options={{ title: "Trash" }} />
      </Stack>
    </>
  );
}
