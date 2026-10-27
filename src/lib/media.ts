import audioManifest from "@/generated/audio-manifest.json";
const audio: Record<string, string> = audioManifest;

/** Exact local asset matches only; user URLs and answer content stay intact. */
export function optimizedMedia<T>(value: T): T {
  if (typeof value === "string") return (audio[value] ?? value) as T;
  if (Array.isArray(value)) return value.map(optimizedMedia) as T;
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, optimizedMedia(item)]),
  ) as T;
  return value;
}
