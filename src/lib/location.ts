// Where the sky is: the phone's location (coarse is enough), named after a nearby city.

import * as Location from "expo-location";
import { searchPlaces, timezoneCity, type SavedLocation } from "@lumen/shared/ambient";

export async function deviceLocation(): Promise<SavedLocation> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") throw new Error("Location permission was not given");
  const pos =
    (await Location.getLastKnownPositionAsync({ maxAge: 30 * 60_000 })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
  const { latitude: lat, longitude: lon } = pos.coords;
  let label = "Current location";
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    label = place?.city ?? place?.subregion ?? place?.region ?? label;
  } catch {}
  return { lat, lon, label, source: "device" };
}

/** The timezone's city ("Africa/Lagos" -> Lagos), looked up once online. */
export async function timezonePlace(): Promise<SavedLocation | undefined> {
  const city = timezoneCity();
  if (!city) return undefined;
  const [place] = await searchPlaces(city).catch(() => []);
  return place ? { lat: place.lat, lon: place.lon, label: place.name, source: "timezone" } : undefined;
}
