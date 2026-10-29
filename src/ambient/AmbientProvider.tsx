// Settings, time, weather and location turned into a SkyState and theme colors, like the
// desktop app (same shared engine), refreshed when the app comes back to the foreground.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState, useColorScheme } from "react-native";
import { computeSky, themeFor, type LumenSettings, type SavedLocation, type SkyState, type ThemeTokens, type Weather } from "@lumen/shared/ambient";
import { lumen } from "../db/lumen";
import { deviceLocation, timezonePlace } from "../lib/location";

interface Ambient {
  settings: LumenSettings;
  update: (patch: Partial<LumenSettings>) => Promise<void>;
  sky: SkyState;
  theme: ThemeTokens;
  weather: Weather | undefined;
  locateDevice: () => Promise<SavedLocation>;
  setLocation: (loc: SavedLocation) => Promise<void>;
  refreshWeather: () => Promise<void>;
}

const AmbientContext = createContext<Ambient | null>(null);

export const useAmbient = () => {
  const ctx = useContext(AmbientContext);
  if (!ctx) throw new Error("useAmbient outside AmbientProvider");
  return ctx;
};

function useMinute() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(Date.now());
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    const sub = AppState.addEventListener("change", (s) => s === "active" && setNow(Date.now()));
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
  return now;
}

export function AmbientProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(lumen.getSettings);
  const [weather, setWeather] = useState<Weather>();
  const now = useMinute();
  const system = useColorScheme();
  const dark = settings.theme === "dark" || (settings.theme === "system" && system === "dark");

  useEffect(() => lumen.onSettings(setSettings), []);

  const update = useCallback(async (patch: Partial<LumenSettings>) => {
    await lumen.updateSettings(patch);
  }, []);
  const refreshWeather = useCallback(async () => setWeather(await lumen.refreshWeather({ force: true })), []);
  const setLocation = useCallback(async (loc: SavedLocation) => {
    await lumen.updateSettings({ location: loc });
    setWeather(await lumen.refreshWeather({ force: true }));
  }, []);
  const locateDevice = useCallback(async () => {
    const loc = await deviceLocation();
    await setLocation(loc);
    return loc;
  }, [setLocation]);

  // First run: the phone's location, else the timezone's city.
  useEffect(() => {
    if (lumen.getSettings().location) return;
    deviceLocation()
      .catch(() => timezonePlace())
      .then((loc) => loc && setLocation(loc))
      .catch(console.error);
  }, [setLocation]);

  useEffect(() => {
    let alive = true;
    lumen.cachedWeather().then((w) => alive && w && setWeather((cur) => cur ?? w));
    const refresh = () => lumen.refreshWeather().then((w) => alive && w && setWeather(w), () => {});
    refresh();
    const timer = setInterval(refresh, 15 * 60_000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());
    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [settings.location, settings.liveWeather]);

  const sky = useMemo(
    () =>
      computeSky({
        now,
        location: settings.location,
        weather: settings.liveWeather ? weather : null,
        envTime: settings.envTime,
        envWeather: settings.envWeather,
      }),
    [now, settings.location, settings.liveWeather, settings.envTime, settings.envWeather, weather],
  );
  const theme = useMemo(() => themeFor(sky, dark), [sky, dark]);

  const value = useMemo(
    () => ({ settings, update, sky, theme, weather, locateDevice, setLocation, refreshWeather }),
    [settings, update, sky, theme, weather, locateDevice, setLocation, refreshWeather],
  );
  return <AmbientContext.Provider value={value}>{children}</AmbientContext.Provider>;
}
