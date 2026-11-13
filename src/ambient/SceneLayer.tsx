// The theme's drawings on the phone (see @lumen/shared/scenes): silhouettes along the bottom
// of the sky card, a piece hanging from its top, and the vignette in its corner. The same
// art as the desktop, drawn still: it changes with the light and the weather, not by itself.

import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { sceneBackdrop, sceneCorner, sceneLook, sceneOverhead, SCENE_CORNER, SCENE_OVERHEAD_HEIGHT, type SceneId, type SceneLook } from "@lumen/shared/scenes";
import { useAmbient } from "./AmbientProvider";

/** The moment as the drawings see it, steady between real changes. */
export function useSceneLook(): { scene: SceneId | null; look: SceneLook; key: string } {
  const { sky, theme, settings } = useAmbient();
  const live = sceneLook(sky, theme, false);
  const daylight = Math.round(live.daylight * 20) / 20;
  const key = `${live.dark}|${daylight}|${live.snow}|${live.rain}|${live.accent}`;
  const skyKey = live.sky.join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const look = useMemo(() => ({ ...live, daylight }), [key, skyKey]);
  return { scene: settings.scene, look, key };
}

/** Far silhouettes; goes under the rain and snow. */
export const SceneBackdropLayer = memo(function SceneBackdropLayer({ width, height }: { width: number; height: number }) {
  const { scene, look } = useSceneLook();
  const xml = useMemo(() => (scene ? sceneBackdrop(scene, look).svg : null), [scene, look]);
  if (!xml) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <SvgXml xml={xml} width={width} height={height} />
    </View>
  );
});

/** The overhead piece and the corner vignette; goes over the weather, under the clock. */
export const SceneFrontLayer = memo(function SceneFrontLayer({ width }: { width: number }) {
  const { scene, look, key } = useSceneLook();
  // Drawn a little smaller than on the desktop: the card is a few hundred points wide. The
  // art keeps its right end clear for the sun, so it is drawn wider than the card and cut off.
  const scale = 0.8;
  const artWidth = Math.round(width / scale) + 200;
  const cornerWidth = Math.min(width * 0.56, 230);
  const cornerHeight = (cornerWidth * SCENE_CORNER.height) / SCENE_CORNER.width;
  const art = useMemo(
    () => (scene ? { overhead: sceneOverhead(scene, look, artWidth).svg, corner: sceneCorner(scene, look).svg } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, key, artWidth],
  );
  if (!art) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={{ position: "absolute", left: 0, top: 0, width: artWidth * scale, height: SCENE_OVERHEAD_HEIGHT * scale }}>
        <SvgXml xml={art.overhead} width={artWidth * scale} height={SCENE_OVERHEAD_HEIGHT * scale} />
      </View>
      <View style={{ position: "absolute", right: 0, bottom: 0, width: cornerWidth, height: cornerHeight }}>
        <SvgXml xml={art.corner} width={cornerWidth} height={cornerHeight} />
      </View>
    </View>
  );
});

/** A small still picture of a theme, for the picker in Settings. */
export function ScenePreview({ scene, width }: { scene: SceneId; width: number }) {
  const { look, key } = useSceneLook();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const xml = useMemo(() => sceneCorner(scene, look).svg, [scene, key]);
  return <SvgXml xml={xml} width={width} height={(width * SCENE_CORNER.height) / SCENE_CORNER.width} />;
}
