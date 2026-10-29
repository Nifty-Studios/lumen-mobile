// The Remotion animations (lumen-motion repo, rendered into assets/motion): the welcome that
// plays once on first launch, and the mark shown while Lumen starts.

import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VideoView, useVideoPlayer } from "expo-video";

export function WelcomeVideo({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(require("../../assets/motion/welcome-portrait.mp4"), (p) => {
    p.muted = true;
    p.play();
  });
  useEffect(() => {
    const sub = player.addListener("playToEnd", onDone);
    return () => sub.remove();
  }, [player, onDone]);
  return (
    <View style={{ flex: 1, backgroundColor: "#060816" }}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <Pressable onPress={onDone} style={[styles.skip, { bottom: insets.bottom + 24 }]}>
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>Skip</Text>
      </Pressable>
    </View>
  );
}

export function LoadingMark() {
  const player = useVideoPlayer(require("../../assets/motion/loading.mp4"), (p) => {
    p.muted = true;
    p.loop = true;
    p.play();
  });
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0b0c1a" }}>
      <VideoView player={player} style={{ width: 132, height: 132, borderRadius: 66 }} contentFit="cover" nativeControls={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  skip: { position: "absolute", right: 20, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)" },
});
