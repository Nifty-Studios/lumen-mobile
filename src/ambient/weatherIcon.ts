import type { IconName } from "@lumen/shared/icons";

export function weatherIcon(precip: string, storm: boolean, fog: number, clouds: number, day: boolean): IconName {
  if (storm) return "cloud-lightning";
  if (precip === "snow") return "cloud-snow";
  if (precip === "rain") return "cloud-rain";
  if (precip === "drizzle") return "cloud-drizzle";
  if (fog) return "cloud-fog";
  if (clouds > 0.75) return "cloudy";
  if (clouds > 0.35) return day ? "cloud-sun" : "cloud-moon";
  return day ? "sun" : "moon";
}
