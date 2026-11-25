import { useCallback, useState } from "react";

// Optional custom desk wallpaper stored locally on the phone (resized via canvas so it stays crisp
// on mobile screens while fitting comfortably inside localStorage).

const KEY = "academy.wallpaper";
const MAX_DIMENSION = 1280;

function readWallpaper(): string | null {
  try {
    const saved = localStorage.getItem(KEY);
    return saved && saved.startsWith("data:image/") ? saved : null;
  } catch {
    return null;
  }
}

async function compressImageFile(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image")));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unsupported image format"));
    image.src = dataUrl;
  });
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function useWallpaper() {
  const [wallpaper, setWallpaper] = useState<string | null>(readWallpaper);

  const setWallpaperFromFile = useCallback(async (file: File) => {
    const compressed = await compressImageFile(file);
    try {
      localStorage.setItem(KEY, compressed);
    } catch {
      throw new Error("Image is too large to save on this device. Try a smaller photo.");
    }
    setWallpaper(compressed);
  }, []);

  const clearWallpaper = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Ignore storage failures.
    }
    setWallpaper(null);
  }, []);

  return { wallpaper, setWallpaperFromFile, clearWallpaper };
}
