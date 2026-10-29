// Hermes has no Web Crypto; @lumen/shared's uuidv7 needs crypto.getRandomValues.
import { getRandomValues } from "expo-crypto";

const g = globalThis as { crypto?: Partial<Crypto> };
g.crypto ??= {};
g.crypto.getRandomValues ??= getRandomValues as Crypto["getRandomValues"];
