import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { useCallback, useEffect, useState, type CSSProperties } from "react";

export type DetailBgTint = "40" | "60" | "70";

export interface CoverPalette {
  primary: string;
  secondary: string;
  frame: string;
}

const DEFAULT_PALETTE: CoverPalette = {
  primary: "188, 172, 148",
  secondary: "174, 156, 134",
  frame: "126, 108, 86"
};

const TINT_KEY = "academy.detailTint";
const MAX_PALETTE_CACHE = 60;
const paletteCache = new Map<string, CoverPalette>();

function cachePalette(key: string, value: CoverPalette) {
  if (paletteCache.size >= MAX_PALETTE_CACHE) {
    const oldest = paletteCache.keys().next().value;
    if (oldest !== undefined) paletteCache.delete(oldest);
  }
  paletteCache.set(key, value);
}

// Downshift IGDB detail covers to t_cover_small before sampling 24x32 palette pixels (30x less RAM & bandwidth).
function smallSampleUrl(url: string): string {
  return url.replace(/\/t_(?:cover_big_2x|cover_big|1080p)\//, "/t_cover_small/");
}

export function useDetailTint(): [DetailBgTint, (tint: DetailBgTint) => void] {
  const [tint, setTintState] = useState<DetailBgTint>(() => {
    try {
      const saved = localStorage.getItem(TINT_KEY);
      return saved === "60" || saved === "70" ? saved : "40";
    } catch {
      return "40";
    }
  });

  const setTint = useCallback((next: DetailBgTint) => {
    try {
      localStorage.setItem(TINT_KEY, next);
    } catch {
      // Non-fatal if storage is unavailable.
    }
    setTintState(next);
  }, []);

  return [tint, setTint];
}

export function coverTintStyle(palette: CoverPalette): CSSProperties {
  return {
    "--cover-a": palette.primary,
    "--cover-b": palette.secondary,
    "--cover-frame": palette.frame
  } as CSSProperties;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
  ];
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function softenColor(r: number, g: number, b: number, targetLightness: number, maxSat: number): string {
  const [h, s, l] = rgbToHsl(r, g, b);
  const tunedS = s < 0.06 ? s : clamp(s * 0.92, 0.22, maxSat);
  const tunedL = clamp(l * 0.45 + targetLightness * 0.55, targetLightness - 0.14, targetLightness + 0.14);
  const [or, og, ob] = hslToRgb(h, tunedS, tunedL);
  return `${or}, ${og}, ${ob}`;
}

function sampleCoverPalette(img: HTMLImageElement): CoverPalette {
  const width = 24;
  const height = 32;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return DEFAULT_PALETTE;
  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const buckets = Array.from({ length: 12 }, () => ({ r: 0, g: 0, b: 0, weight: 0 }));
  let avgR = 0;
  let avgG = 0;
  let avgB = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    avgR += r;
    avgG += g;
    avgB += b;
    count += 1;

    const [h, s, l] = rgbToHsl(r, g, b);
    if (l < 0.09 || l > 0.92 || s < 0.1) continue;
    const sector = Math.floor(h * 12) % 12;
    const weight = (0.4 + s) * (1 - Math.abs(l - 0.5));
    buckets[sector].r += r * weight;
    buckets[sector].g += g * weight;
    buckets[sector].b += b * weight;
    buckets[sector].weight += weight;
  }

  if (count === 0) return DEFAULT_PALETTE;

  const ranked = buckets
    .map((bucket, index) => ({ ...bucket, index }))
    .filter(bucket => bucket.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  if (ranked.length === 0) {
    const mr = avgR / count;
    const mg = avgG / count;
    const mb = avgB / count;
    return {
      primary: softenColor(mr, mg, mb, 0.54, 0.25),
      secondary: softenColor(mr, mg, mb, 0.62, 0.2),
      frame: softenColor(mr, mg, mb, 0.36, 0.28)
    };
  }

  const first = ranked[0];
  const r1 = first.r / first.weight;
  const g1 = first.g / first.weight;
  const b1 = first.b / first.weight;

  const second = ranked.find(bucket => {
    const dist = Math.abs(bucket.index - first.index);
    return Math.min(dist, 12 - dist) >= 2 && bucket.weight >= first.weight * 0.18;
  });

  let r2 = r1;
  let g2 = g1;
  let b2 = b1;
  if (second) {
    r2 = second.r / second.weight;
    g2 = second.g / second.weight;
    b2 = second.b / second.weight;
  } else {
    const [h, s, l] = rgbToHsl(r1, g1, b1);
    const [sr, sg, sb] = hslToRgb((h + 0.08) % 1, s * 0.85, clamp(l + 0.08, 0.2, 0.8));
    r2 = sr;
    g2 = sg;
    b2 = sb;
  }

  return {
    primary: softenColor(r1, g1, b1, 0.5, 0.72),
    secondary: softenColor(r2, g2, b2, 0.56, 0.62),
    frame: softenColor(r1, g1, b1, 0.34, 0.5)
  };
}

function loadImagePalette(src: string, crossOrigin?: string): Promise<CoverPalette> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => {
      try {
        resolve(sampleCoverPalette(img));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

async function fetchNativeCoverPalette(url: string): Promise<CoverPalette> {
  const response = await CapacitorHttp.get({ url, responseType: "blob" });
  if (response.status < 200 || response.status >= 300 || typeof response.data !== "string") {
    throw new Error("Native image fetch failed");
  }
  const mime = response.headers?.["content-type"] || response.headers?.["Content-Type"] || "image/jpeg";
  return loadImagePalette(`data:${mime};base64,${response.data}`);
}

export function useCoverPalette(coverSrc?: string | null): CoverPalette {
  const sampleSrc = coverSrc ? smallSampleUrl(coverSrc) : null;
  const [palette, setPalette] = useState<CoverPalette>(() => (sampleSrc ? paletteCache.get(sampleSrc) : undefined) ?? DEFAULT_PALETTE);

  useEffect(() => {
    if (!sampleSrc || typeof Image === "undefined" || typeof document === "undefined") {
      setPalette(DEFAULT_PALETTE);
      return;
    }
    const cached = paletteCache.get(sampleSrc);
    if (cached) {
      setPalette(cached);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const extracted = await loadImagePalette(sampleSrc, "anonymous");
        if (!cancelled) {
          cachePalette(sampleSrc, extracted);
          setPalette(extracted);
        }
      } catch {
        if (!cancelled && Capacitor.isNativePlatform() && /^https?:\/\//i.test(sampleSrc)) {
          try {
            const extracted = await fetchNativeCoverPalette(sampleSrc);
            if (!cancelled) {
              cachePalette(sampleSrc, extracted);
              setPalette(extracted);
            }
            return;
          } catch {
            // Fall through to default palette.
          }
        }
        if (!cancelled) setPalette(DEFAULT_PALETTE);
      }
    })();

    return () => { cancelled = true; };
  }, [sampleSrc]);

  return palette;
}
