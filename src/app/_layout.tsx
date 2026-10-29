import { useEffect, useState } from "react";
import { AppState, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts, Fraunces_300Light, Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { lumen } from "../db/lumen";
import { AmbientProvider } from "../ambient/AmbientProvider";
import { AuthScreen } from "../components/AuthScreen";
import { NoticeBanner, playChime } from "../components/NoticeBanner";
import { updates } from "../lib/updates";
import { LoadingMark, WelcomeVideo } from "../components/Intro";
import { FONTS, useColors } from "../theme";

export default function RootLayout() {
  const [boot, setBoot] = useState<{ error?: string; ready?: boolean; auth?: boolean }>({});
  const [welcome, setWelcome] = useState(false);
  const [fonts] = useFonts({ Fraunces_300Light, Fraunces_600SemiBold });

  useEffect(() => {
    lumen.start().then(
      ({ needsAuth }) => {
        // First launch on this phone: the welcome animation plays before sign-in.
        if (needsAuth && !lumen.getSettings().welcomed) setWelcome(true);
        setBoot({ ready: true, auth: needsAuth });
      },
      (e) => setBoot({ error: String(e) }),
    );
  }, []);

  // Background sync once started: on an interval, after edits, and whenever the app comes back;
  // plus a live socket while the app is in front and signed in.
  useEffect(() => {
    const sync = lumen.sync;
    if (!boot.ready || boot.auth || !sync) return;
    const stop = sync.start();
    let closeLive: (() => void) | undefined;
    const updateLive = () => {
      const want = AppState.currentState === "active" && !!lumen.account.current;
      if (want && !closeLive) closeLive = sync.live();
      if (!want && closeLive) {
        closeLive();
        closeLive = undefined;
      }
    };
    updateLive();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") sync.sync().catch(() => {});
      updateLive();
    });
    const offAccount = lumen.account.onChange(updateLive);
    return () => {
      stop();
      closeLive?.();
      sub.remove();
      offAccount();
    };
  }, [boot.ready, boot.auth]);

  useEffect(() => {
    if (!boot.ready || boot.auth) return;
    const off = updates.onAvailable(playChime);
    const stop = updates.start();
    return () => {
      off();
      stop();
    };
  }, [boot.ready, boot.auth]);

  if (boot.error)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0b0c1a", padding: 24 }}>
        <Text style={{ color: "#ff8a80" }}>Lumen could not start: {boot.error}</Text>
      </View>
    );
  if (!boot.ready || !fonts) return <LoadingMark />;
  if (welcome)
    return (
      <WelcomeVideo
        onDone={() => {
          setWelcome(false);
          void lumen.updateSettings({ welcomed: true });
        }}
      />
    );

  return (
    <AmbientProvider>
      {boot.auth ? (
        <AuthScreen
          onDone={() => setBoot({ ready: true })}
          onLater={async () => {
            await lumen.continueSignedOut();
            setBoot({ ready: true });
          }}
        />
      ) : (
        <>
          <ThemedStack />
          <NoticeBanner />
        </>
      )}
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
        <Stack.Screen name="signin" options={{ headerShown: false, animation: "fade" }} />
        <Stack.Screen name="share/[id]" options={{ title: "Share", presentation: "modal" }} />
      </Stack>
    </>
  );
}
