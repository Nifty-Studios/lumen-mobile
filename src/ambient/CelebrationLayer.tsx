// Special days on the phone's sky card: fireworks, rising hearts, drifting petals, bats and
// embers, snow and fairy lights, confetti and balloons. Every particle is an Animated loop on
// the native thread (like SkyCard's clouds and rain), still in "still" motion mode.

import { memo, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import type { Celebration } from "@lumen/shared/calendar";
import type { Motion } from "@lumen/shared/ambient";

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function useLoop(duration: number, motion: Motion, delay = 0) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (motion === "still") {
      value.setValue(0.5);
      return;
    }
    const d = duration * (motion === "calm" ? 1.6 : 1);
    const anim = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(value, { toValue: 1, duration: d, easing: Easing.linear, useNativeDriver: true }), Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true })]));
    anim.start();
    return () => anim.stop();
  }, [duration, motion, delay, value]);
  return value;
}

/** A loop that starts part-way through (so particles don't all begin together). */
function phased(t: Animated.Value, phase: number, from: number, to: number) {
  const p = Math.min(0.99, Math.max(0.01, phase));
  const at = (k: number) => from + (to - from) * k;
  return t.interpolate({ inputRange: [0, 1 - p, 1 - p + 0.0001, 1], outputRange: [at(p), to, from, at(p)] });
}

const HEART = "M0 4 C-11 -4 -5 -11 0 -5 C5 -11 11 -4 0 4 Z";
const BAT = "M0 0 Q-5 -6 -11 -3 Q-8 1 -5 1 Q-2 0 0 3 Q2 0 5 1 Q8 1 11 -3 Q5 -6 0 0 Z";
const COLORS = {
  hearts: ["#ff5c8a", "#ff8fb1", "#ff3d6e", "#ffb3c8"],
  petals: ["#ffd1e8", "#e8d4ff", "#fff1a8", "#c9f2d4"],
  confetti: ["#ff5c8a", "#ffd36b", "#5cc8ff", "#8be37a", "#b69cff", "#ff9a5c"],
  fireworks: ["#ffd36b", "#ff7ab6", "#7ad7ff", "#b69cff", "#9dffb0"],
  bulbs: ["#ff4d4d", "#ffd24d", "#4dd77a", "#5ab8ff", "#ff8ad8"],
};

interface Drift {
  x: number;
  size: number;
  duration: number;
  phase: number;
  color: string;
  sway: number;
  spin: number;
}

/** One particle moving from `from` to `to` (y), swaying sideways, optionally spinning. */
const Drifter = memo(function Drifter({ d, from, to, motion, children }: { d: Drift; from: number; to: number; motion: Motion; children: ReactNode }) {
  const t = useLoop(d.duration, motion);
  const sway = useLoop(d.duration / 3, motion);
  const translateY = phased(t, d.phase, from, to);
  const translateX = sway.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-d.sway, d.sway, -d.sway] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${d.spin}deg`] });
  return <Animated.View style={{ position: "absolute", left: d.x, top: 0, transform: [{ translateY }, { translateX }, { rotate }] }}>{children}</Animated.View>;
});

function drifts(seed: number, n: number, width: number, colors: string[], o: { size: [number, number]; duration: [number, number]; sway: number; spin: number }): Drift[] {
  const r = rng(seed);
  return Array.from({ length: n }, () => ({
    x: r() * width,
    size: o.size[0] + r() * (o.size[1] - o.size[0]),
    duration: o.duration[0] + r() * (o.duration[1] - o.duration[0]),
    phase: r(),
    color: colors[Math.floor(r() * colors.length)]!,
    sway: o.sway * (0.4 + r()),
    spin: (r() - 0.5) * o.spin,
  }));
}

const Burst = memo(function Burst({ x, y, color, delay, motion }: { x: number; y: number; color: string; delay: number; motion: Motion }) {
  const t = useLoop(1700, motion, delay);
  const sparks = 14;
  return (
    <>
      {Array.from({ length: sparks }, (_, i) => {
        const a = (i / sparks) * Math.PI * 2;
        const dist = 34 + (i % 3) * 8;
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 3.2,
              height: 3.2,
              borderRadius: 2,
              backgroundColor: i % 4 ? color : "#ffffff",
              opacity: t.interpolate({ inputRange: [0, 0.08, 0.7, 1], outputRange: [0, 1, 0.6, 0] }),
              transform: [
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * dist] }) },
                // Out, then a little fall.
                { translateY: t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, Math.sin(a) * dist * 0.85, Math.sin(a) * dist + 16] }) },
              ],
            }}
          />
        );
      })}
    </>
  );
});

const Bat = memo(function Bat({ y, duration, phase, reverse, motion, size }: { y: number; duration: number; phase: number; reverse: boolean; motion: Motion; size: number }) {
  const t = useLoop(duration, motion);
  const flap = useLoop(380, motion);
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 0,
        top: y,
        transform: [
          { translateX: phased(t, phase, reverse ? 460 : -40, reverse ? -40 : 460) },
          { translateY: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -10, 0, 10, 0] }) },
          { scaleY: flap.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.35, 1] }) },
        ],
      }}
    >
      <Svg width={size * 2.2} height={size} viewBox="-12 -7 24 11">
        <Path d={BAT} fill="rgba(12,6,20,0.85)" />
      </Svg>
    </Animated.View>
  );
});

const Bulb = memo(function Bulb({ x, y, color, i, motion }: { x: number; y: number; color: string; i: number; motion: Motion }) {
  const t = useLoop(2200 + (i % 5) * 300, motion, (i % 7) * 180);
  return (
    <Animated.View style={{ position: "absolute", left: x - 9, top: y - 9, width: 18, height: 18, alignItems: "center", justifyContent: "center", opacity: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 1, 0.55] }) }}>
      <View style={{ position: "absolute", width: 18, height: 18, borderRadius: 9, backgroundColor: color, opacity: 0.28 }} />
      <View style={{ width: 6, height: 8.5, borderRadius: 4, backgroundColor: color }} />
    </Animated.View>
  );
});

export function CelebrationLayer({ celebration, width, height, motion }: { celebration: Celebration; width: number; height: number; motion: Motion }) {
  const effect = celebration.effect;
  const calm = motion !== "full";
  const k = calm ? 0.55 : 1;

  const content = useMemo(() => {
    switch (effect) {
      case "hearts":
        return drifts(31, Math.round(14 * k), width, COLORS.hearts, { size: [8, 17], duration: [7000, 11000], sway: 10, spin: 30 }).map((d, i) => (
          <Drifter key={i} d={d} from={height + 20} to={-30} motion={motion}>
            <Svg width={d.size * 2} height={d.size * 1.6} viewBox="-12 -12 24 18">
              <Path d={HEART} fill={d.color} opacity={0.8} />
            </Svg>
          </Drifter>
        ));
      case "petals":
        return drifts(17, Math.round(16 * k), width, COLORS.petals, { size: [5, 9], duration: [6500, 10000], sway: 18, spin: 540 }).map((d, i) => (
          <Drifter key={i} d={d} from={-20} to={height + 20} motion={motion}>
            <View style={{ width: d.size * 2, height: d.size * 1.1, borderRadius: d.size, backgroundColor: d.color, opacity: 0.9 }} />
          </Drifter>
        ));
      case "snow-lights": {
        const flakes = drifts(9, Math.round(30 * k), width, ["#ffffff"], { size: [1.5, 3.5], duration: [5000, 9000], sway: 10, spin: 0 }).map((d, i) => (
          <Drifter key={`f${i}`} d={d} from={-10} to={height + 10} motion={motion}>
            <View style={{ width: d.size * 2, height: d.size * 2, borderRadius: d.size, backgroundColor: "rgba(255,255,255,0.9)" }} />
          </Drifter>
        ));
        const span = width / 2;
        const sag = (x: number) => 6 + Math.sin(((x % span) / span) * Math.PI) * 22;
        const wire = Array.from({ length: 41 }, (_, i) => (i / 40) * width).map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)} ${sag(x).toFixed(1)}`).join(" ");
        const bulbs = Array.from({ length: Math.floor(width / 34) }, (_, i) => 16 + i * 34).map((x, i) => <Bulb key={`b${i}`} x={x} y={sag(x) + 5} color={COLORS.bulbs[i % COLORS.bulbs.length]!} i={i} motion={motion} />);
        return [
          ...flakes,
          <Svg key="wire" width={width} height={40} style={{ position: "absolute", top: 0, left: 0 }}>
            <Path d={wire} stroke="rgba(25,45,35,0.7)" strokeWidth={1.2} fill="none" />
          </Svg>,
          ...bulbs,
        ];
      }
      case "bats": {
        const r = rng(5);
        const bats = Array.from({ length: calm ? 2 : 4 }, (_, i) => <Bat key={`bat${i}`} y={20 + r() * height * 0.45} duration={9000 + r() * 6000} phase={r()} reverse={i % 2 === 1} motion={motion} size={10 + r() * 8} />);
        const embers = drifts(13, Math.round(14 * k), width, ["#ff9b3d", "#ffcf6b", "#ff6a2a"], { size: [1.2, 2.4], duration: [6000, 9000], sway: 8, spin: 0 }).map((d, i) => (
          <Drifter key={`e${i}`} d={d} from={height + 10} to={-10} motion={motion}>
            <View style={{ width: d.size * 2, height: d.size * 2, borderRadius: d.size, backgroundColor: d.color, opacity: 0.85 }} />
          </Drifter>
        ));
        return [...embers, ...bats];
      }
      case "fireworks": {
        const r = rng(3);
        return Array.from({ length: calm ? 3 : 5 }, (_, i) => (
          <Burst key={i} x={width * (0.12 + r() * 0.62)} y={height * (0.12 + r() * 0.35)} color={COLORS.fireworks[i % COLORS.fireworks.length]!} delay={i * 650} motion={motion} />
        ));
      }
      case "confetti":
      case "confetti-balloons": {
        const bits = drifts(21, Math.round(26 * k), width, COLORS.confetti, { size: [3, 5], duration: [3600, 6000], sway: 12, spin: 900 }).map((d, i) => (
          <Drifter key={`c${i}`} d={d} from={-12} to={height + 12} motion={motion}>
            <View style={{ width: d.size * 2, height: d.size, borderRadius: 1, backgroundColor: d.color }} />
          </Drifter>
        ));
        if (effect === "confetti") return bits;
        const balloons = drifts(44, calm ? 2 : 4, width - 40, COLORS.confetti, { size: [14, 20], duration: [9000, 13000], sway: 10, spin: 0 }).map((d, i) => (
          <Drifter key={`b${i}`} d={d} from={height + 40} to={-70} motion={motion}>
            <Svg width={d.size * 2} height={d.size * 4.2} viewBox={`${-d.size} ${-d.size * 1.2} ${d.size * 2} ${d.size * 4.2}`}>
              <Path d={`M0 ${d.size * 1.2} Q 6 ${d.size * 2} 0 ${d.size * 3}`} stroke="rgba(255,255,255,0.5)" strokeWidth={1} fill="none" />
              <Ellipse cx={0} cy={0} rx={d.size} ry={d.size * 1.2} fill={d.color} />
              <Circle cx={-d.size * 0.35} cy={-d.size * 0.45} r={d.size * 0.22} fill="rgba(255,255,255,0.55)" />
            </Svg>
          </Drifter>
        ));
        return [...bits, ...balloons];
      }
    }
  }, [effect, width, height, motion, k, calm]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {content}
    </View>
  );
}
