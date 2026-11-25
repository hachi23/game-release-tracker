export function toNumberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export function nullable(value: unknown): string | null {
  return value === null || value === undefined || value === "" ? null : String(value);
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  if (value === "[]" && Array.isArray(fallback)) return [] as unknown as T;
  if (value === "{}" && fallback !== null && typeof fallback === "object" && !Array.isArray(fallback)) return {} as unknown as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
