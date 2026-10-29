import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts, Fraunces_300Light, Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { lumen } from "../db/lumen";
import { AmbientProvider } from "../ambient/AmbientProvider";
import { FONTS, useColors } from "../theme";

export default function RootLayout() {
  const [boot, setBoot] = useState<{ error?: string; ready?: boolean }>({});
  const [fonts] = useFonts({ Fraunces_300Light, Fraunces_600SemiBold });

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

  if (!boot.ready || !fonts)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0b0c1a", padding: 24 }}>
        {boot.error ? <Text style={{ color: "#ff8a80" }}>Lumen could not start: {boot.error}</Text> : <ActivityIndicator color="#8d8a99" />}
      </View>
    );

  return (
    <AmbientProvider>
      <ThemedStack />
    </AmbientProvider>
  );
}

function ThemedStack() {
  const c = useColors();
  return (
    <>
      <StatusBar style={c.dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.text,
          headerTitleStyle: { fontFamily: FONTS.serif, fontSize: 19 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="page/[id]" options={{ title: "" }} />
        <Stack.Screen name="search" options={{ title: "Search", animation: "fade" }} />
        <Stack.Screen name="trash" options={{ title: "Trash" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
      </Stack>
    </>
  );
}
