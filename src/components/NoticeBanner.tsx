// Notices (a page or workspace shared with you): a banner that drops in from the top with the
// chime. Tapping it opens the page.

import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createAudioPlayer } from "expo-audio";
import type { Notice } from "@lumen/shared/client";
import { lumen } from "../db/lumen";
import { Icon } from "./Icon";
import { useColors } from "../theme";

let chime: ReturnType<typeof createAudioPlayer> | undefined;
function playChime() {
  try {
    chime ??= createAudioPlayer(require("../../assets/sounds/notify.wav"));
    chime.seekTo(0);
    chime.play();
  } catch {}
}

export function NoticeBanner() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<Notice>();
  const y = useRef(new Animated.Value(-160)).current;

  useEffect(
    () =>
      lumen.onNotice((n) => {
        playChime();
        setNotice(n);
        y.setValue(-160);
        Animated.sequence([
          Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 9 }),
          Animated.delay(4200),
          Animated.timing(y, { toValue: -160, duration: 260, useNativeDriver: true }),
        ]).start(() => setNotice(undefined));
      }),
    [y],
  );

  if (!notice) return null;
  return (
    <Animated.View style={[styles.wrap, { top: insets.top + 8, transform: [{ translateY: y }] }]}>
      <Pressable
        onPress={() => {
          if (notice.pageId) router.push(`/page/${notice.pageId}`);
          setNotice(undefined);
        }}
        style={[styles.card, { backgroundColor: c.surface }]}
      >
        <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
          <Icon name="users" size={18} color={c.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>{notice.title}</Text>
          <Text style={{ color: c.muted, fontSize: 13.5 }} numberOfLines={2}>
            {notice.body}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12, zIndex: 100 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, padding: 14, elevation: 10 },
  icon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
});
