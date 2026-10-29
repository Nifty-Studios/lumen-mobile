// Where the sky is: the phone's location (coarse is enough), named after a nearby city.

import * as Location from "expo-location";
import { searchPlaces, timezoneCity, type SavedLocation } from "@lumen/shared/ambient";

// Some phones never answer a position request (no fix indoors, no network provider), so every
// step has a deadline instead of leaving the sky waiting forever.
function within<T>(promise: Promise<T>, ms: number, what: string) {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${what} took too long`)), ms))]);
}

export async function deviceLocation(): Promise<SavedLocation> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") throw new Error("Location permission was not given");
  const pos =
    (await Location.getLastKnownPositionAsync({ maxAge: 30 * 60_000 })) ??
    (await within(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 25_000, "Finding your location"));
  const { latitude: lat, longitude: lon } = pos.coords;
  const label = (await placeName(lat, lon).catch(() => undefined)) ?? UNNAMED;
  return { lat, lon, label, source: "device" };
}

/** The label of a device location found while offline; named properly once the phone is online. */
export const UNNAMED = "Current location";

/** A nearby city's name (the phone's geocoder, which needs the internet). */
export async function placeName(lat: number, lon: number): Promise<string | undefined> {
  const [place] = await within(Location.reverseGeocodeAsync({ latitude: lat, longitude: lon }), 6_000, "Naming your location");
  return place?.city ?? place?.subregion ?? place?.region ?? undefined;
}

/** The timezone's city ("Africa/Lagos" -> Lagos), looked up once online. */
export async function timezonePlace(): Promise<SavedLocation | undefined> {
  const city = timezoneCity();
  if (!city) return undefined;
  const [place] = await searchPlaces(city).catch(() => []);
  return place ? { lat: place.lat, lon: place.lon, label: place.name, source: "timezone" } : undefined;
}
