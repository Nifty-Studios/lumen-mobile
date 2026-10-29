// A small living sky for the top of the home screen: gradient, stars, the moon in its real
// phase, a breathing sun, drifting clouds, and rain or snow. All motion runs on the native
// thread (Animated + useNativeDriver), and stops in "still" motion mode.

import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from "react-native-svg";
import { moonLitPath, type Motion } from "@lumen/shared/ambient";
import { useAmbient } from "./AmbientProvider";

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function useLoop(duration: number, motion: Motion, { reverse = false } = {}) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (motion === "still") return;
    const timing = Animated.timing(value, {
      toValue: 1,
      duration: duration * (motion === "calm" ? 1.8 : 1),
      easing: reverse ? Easing.inOut(Easing.sin) : Easing.linear,
      useNativeDriver: true,
    });
    const anim = reverse ? Animated.loop(Animated.sequence([timing, Animated.timing(value, { toValue: 0, duration: duration * (motion === "calm" ? 1.8 : 1), easing: Easing.inOut(Easing.sin), useNativeDriver: true })])) : Animated.loop(timing);
    anim.start();
    return () => anim.stop();
  }, [duration, motion, reverse, value]);
  return value;
}

/** Interpolates a 0..1 loop from `from` to `to`, shifted by `phase` so loops start mid-way. */
function phased(t: Animated.Value, phase: number, from: number, to: number) {
  const p = Math.min(0.99, Math.max(0.01, phase));
  const at = (k: number) => from + (to - from) * k;
  return t.interpolate({ inputRange: [0, 1 - p, 1 - p + 0.0001, 1], outputRange: [at(p), to, from, at(p)] });
}

/** `bodyTop` is where the sun and moon sit: below the screen's top controls, beside the clock. */
export function SkyCard({ height, bodyTop, children }: { height: number; bodyTop: number; children?: ReactNode }) {
  const { sky, theme, settings } = useAmbient();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const motion = settings.motion;

  return (
    <View style={{ height, overflow: "hidden" }} onLayout={onLayout}>
      <LinearGradient colors={[theme.skyTop, theme.skyMid, theme.skyBottom]} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
      {width > 0 && (
        <>
          {sky.stars > 0.05 && <Stars width={width} height={height} opacity={sky.stars} motion={motion} />}
          {sky.moon.visible > 0.05 && <Moon x={width - 78} y={bodyTop} phase={sky.moon.phase} opacity={sky.moon.visible * (1 - sky.sun.dim * 0.85)} />}
          {sky.sun.visible > 0.05 && <Sun x={width - 80} y={bodyTop + (1 - Math.min(1, Math.max(0, sky.altitude / 60))) * 30} color={sky.sun.color} opacity={sky.sun.visible * (theme.dark ? 0.8 : 1)} dim={sky.sun.dim} motion={motion} />}
          <Clouds width={width} height={height} cover={sky.clouds} wind={sky.wind} light={sky.cloudLight} shade={sky.cloudShade} motion={motion} />
          {sky.precip !== "none" && <Precip width={width} height={height} snow={sky.precip === "snow"} intensity={sky.intensity} wind={sky.wind} motion={motion} />}
        </>
      )}
      <View style={StyleSheet.absoluteFill}>{children}</View>
    </View>
  );
}

const Stars = memo(function Stars({ width, height, opacity, motion }: { width: number; height: number; opacity: number; motion: Motion }) {
  const stars = useMemo(() => {
    const r = rng(11);
    return Array.from({ length: 46 }, () => ({ x: r() * width, y: r() * height * 0.85, size: 1 + r() * r() * 2.2, o: 0.4 + r() * 0.6 }));
  }, [width, height]);
  const twinkle = useLoop(4200, motion, { reverse: true });
  return (
    <View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {stars.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: s.size,
            backgroundColor: "#fffdf2",
            opacity: i % 3 ? s.o : twinkle.interpolate({ inputRange: [0, 1], outputRange: [s.o, 0.15] }),
          }}
        />
      ))}
    </View>
  );
});

function Moon({ x, y, phase, opacity }: { x: number; y: number; phase: number; opacity: number }) {
  return (
    <View style={{ position: "absolute", left: x - 60, top: y - 60, width: 120, height: 120, opacity }} pointerEvents="none">
      <Svg width={120} height={120} viewBox="-3 -3 6 6">
        <Defs>
          <RadialGradient id="moonGlow" cx="0" cy="0" r="3" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#dfe3ff" stopOpacity={0.28} />
            <Stop offset="1" stopColor="#dfe3ff" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle r={3} fill="url(#moonGlow)" />
        <Circle r={0.95} fill="rgba(210,220,255,0.08)" />
        <G scale={0.95}>
          <Path d={moonLitPath(phase)} fill="#f4f1e6" />
        </G>
      </Svg>
    </View>
  );
}

function Sun({ x, y, color, opacity, dim, motion }: { x: number; y: number; color: string; opacity: number; dim: number; motion: Motion }) {
  const breathe = useLoop(6500, motion, { reverse: true });
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  return (
    <Animated.View style={{ position: "absolute", left: x - 90, top: y - 90, width: 180, height: 180, opacity, transform: [{ scale }] }} pointerEvents="none">
      <Svg width={180} height={180} viewBox="-90 -90 180 180">
        <Defs>
          <RadialGradient id="halo" cx="0" cy="0" r="90" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={color} stopOpacity={0.55} />
            <Stop offset="0.35" stopColor={color} stopOpacity={0.16} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="core" cx="0" cy="0" r="26" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#fffdf3" />
            <Stop offset="0.55" stopColor="#fff4d6" />
            <Stop offset="1" stopColor={color} />
          </RadialGradient>
        </Defs>
        <Circle r={90} fill="url(#halo)" opacity={0.6 + 0.4 * (1 - dim)} />
        <Circle r={24} fill="url(#core)" opacity={1 - dim * 0.8} />
      </Svg>
    </Animated.View>
  );
}

const Cloud = memo(function Cloud(props: { width: number; top: number; size: number; duration: number; phase: number; light: string; shade: string; seed: number; opacity: number; motion: Motion }) {
  const { width, top, size, duration, phase, light, shade, seed, opacity, motion } = props;
  const t = useLoop(duration, motion);
  const translateX = phased(t, phase, -size * 1.1, width + size * 0.1);
  const puffs = useMemo(() => {
    const r = rng(seed);
    const n = 4 + Math.floor(r() * 3);
    return Array.from({ length: n }, (_, i) => {
      const k = (i + 0.5) / n;
      // Sized to stay inside the 200x100 canvas: a puff past its edge is cut off flat.
      return { cx: 20 + k * 160, cy: 78 - Math.sin(k * Math.PI) * (10 + r() * 12), r: 16 + Math.sin(k * Math.PI) * (10 + r() * 10) };
    });
  }, [seed]);
  return (
    <Animated.View style={{ position: "absolute", top, left: 0, width: size, height: size / 2, opacity, transform: [{ translateX }] }} pointerEvents="none">
      <Svg width={size} height={size / 2} viewBox="0 0 200 100">
        <Defs>
          <RadialGradient id={`puff${seed}`} cx="50%" cy="45%" r="50%">
            <Stop offset="0" stopColor={light} stopOpacity={0.95} />
            <Stop offset="0.6" stopColor={light} stopOpacity={0.7} />
            <Stop offset="1" stopColor={shade} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={100} cy={84} rx={92} ry={16} fill={`url(#puff${seed})`} />
        {puffs.map((p, i) => (
          <Circle key={i} cx={p.cx} cy={p.cy} r={p.r * 1.3} fill={`url(#puff${seed})`} />
        ))}
      </Svg>
    </Animated.View>
  );
});

function Clouds(props: { width: number; height: number; cover: number; wind: number; light: string; shade: string; motion: Motion }) {
  const { width, height, cover, wind, light, shade, motion } = props;
  const count = cover < 0.05 ? 0 : Math.round(1 + cover * 6);
  const specs = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: count }, (_, i) => {
      const depth = r();
      const duration = (70_000 + (1 - depth) * 50_000) / (0.7 + wind * 1.5);
      return { top: r() * height * 0.62 - 10, size: 120 + depth * 150, duration, seed: 7 + i * 13, opacity: (0.5 + depth * 0.45) * (0.6 + cover * 0.4), phase: r() };
    });
  }, [count, height, wind, cover]);
  return (
    <>
      {specs.map((c) => (
        <Cloud key={c.seed} width={width} top={c.top} size={c.size} duration={c.duration} phase={c.phase} light={light} shade={shade} seed={c.seed} opacity={c.opacity} motion={motion} />
      ))}
    </>
  );
}

const Drop = memo(function Drop({ x, height, snow, slant, duration, phase, motion }: { x: number; height: number; snow: boolean; slant: number; duration: number; phase: number; motion: Motion }) {
  const t = useLoop(duration, motion);
  const translateY = phased(t, phase, -20, height + 20);
  const translateX = phased(t, phase, 0, slant * height);
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x,
        top: 0,
        width: snow ? 3 : 1.3,
        height: snow ? 3 : 13,
        borderRadius: 2,
        backgroundColor: snow ? "rgba(255,255,255,0.85)" : "rgba(225,235,255,0.45)",
        transform: [{ translateY }, { translateX }, { rotate: snow ? "0deg" : `${Math.atan(slant) * -57}deg` }],
      }}
    />
  );
});

function Precip({ width, height, snow, intensity, wind, motion }: { width: number; height: number; snow: boolean; intensity: number; wind: number; motion: Motion }) {
  const drops = useMemo(() => {
    const r = rng(23);
    const n = Math.round((snow ? 26 : 42) * (0.4 + intensity * 0.8) * (motion === "full" ? 1 : 0.6));
    return Array.from({ length: n }, () => ({ x: r() * (width + 60) - 30, duration: snow ? 5200 + r() * 3000 : 650 + r() * 350, phase: r() }));
  }, [width, snow, intensity, motion]);
  const slant = (snow ? 0.1 : 0.22) * (0.3 + wind);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {drops.map((d, i) => (
        <Drop key={i} x={d.x} height={height} snow={snow} slant={slant} duration={d.duration} phase={d.phase} motion={motion} />
      ))}
    </View>
  );
}
