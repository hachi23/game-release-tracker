import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";

// Where the Android app keeps the library: one SQLite file, tracker.db, in the app's private data folder
// (other apps can't read it). The database runs in memory; after a write the bytes are saved here, a
// moment later so a burst of writes saves once. In a desktop browser (development, tests) the bytes go
// to IndexedDB instead.

export interface LibraryStore {
  load(): Promise<Uint8Array | null>;
  save(bytes: Uint8Array): Promise<void>;
}

const FILE = "tracker.db";
const TEMP = "tracker.db.saving";

export function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(text: string) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const deviceFileStore: LibraryStore = {
  async load() {
    try {
      const { data } = await Filesystem.readFile({ path: FILE, directory: Directory.Data });
      return typeof data === "string" ? fromBase64(data) : new Uint8Array(await data.arrayBuffer());
    } catch {
      return null;
    }
  },
  // Written beside the library, then renamed over it, so a crash mid-save keeps the last good copy.
  async save(bytes) {
    await Filesystem.writeFile({ path: TEMP, directory: Directory.Data, data: toBase64(bytes) });
    await Filesystem.rename({ from: TEMP, to: FILE, directory: Directory.Data, toDirectory: Directory.Data });
  }
};

export const browserStore: LibraryStore = {
  async load() {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const request = db.transaction("files").objectStore("files").get(FILE);
      request.onsuccess = () => resolve((request.result as Uint8Array | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  },
  async save(bytes) {
    const db = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put(bytes, FILE);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("game-release-tracker", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const defaultLibraryStore = () => (Capacitor.isNativePlatform() ? deviceFileStore : browserStore);

// Saves after writes settle; flush() saves now (the app is going to the background).
export function createLibrarySaver(store: LibraryStore, exportBytes: () => Uint8Array, delayMs = 400, onError: (error: unknown) => void = console.error) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;
  let saving: Promise<void> = Promise.resolve();
  let stopped = false;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!dirty || stopped) return saving;
    dirty = false;
    const bytes = exportBytes();
    saving = saving.then(() => store.save(bytes)).catch(onError);
    return saving;
  };

  return {
    changed() {
      if (stopped) return;
      dirty = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), delayMs);
    },
    flush,
    // After an import has saved a new library: the open one must never be saved over it again.
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    }
  };
}

// A copy of the library for backup or for the desktop app: on Android it goes to Documents, in a
// browser it downloads. Returns where it went.
export async function exportLibraryCopy(bytes: Uint8Array, today = new Date()): Promise<string> {
  const name = `game-release-tracker-${today.toISOString().slice(0, 10)}.db`;
  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({ path: name, directory: Directory.Documents, data: toBase64(bytes) });
    return `Documents/${name}`;
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/x-sqlite3" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}
