// The browser stand-in for node:fs. The Android preview keeps everything in SQLite; file-backed features
// (local artwork, wallpaper, cover cache, migration backups) are not ported yet, so they find no files.
const unavailable = (name: string) => () => {
  throw new Error(`node:fs ${name} is not available in the Android preview`);
};
export const existsSync = () => false;
export const mkdirSync = unavailable("mkdirSync");
export const readdirSync = () => [];
export const readFileSync = unavailable("readFileSync");
export const writeFileSync = unavailable("writeFileSync");
export const rmSync = () => undefined;
export const statSync = unavailable("statSync");
export const renameSync = unavailable("renameSync");
export const copyFileSync = unavailable("copyFileSync");
export const promises = {};
export default { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, statSync, renameSync, copyFileSync, promises };
