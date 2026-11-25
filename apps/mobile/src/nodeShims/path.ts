// The browser stand-in for node:path (POSIX separators only).
export const sep = "/";
export const join = (...parts: string[]) => parts.filter(Boolean).join("/").replace(/\/+/g, "/");
export const resolve = join;
export const dirname = (path: string) => path.replace(/\/[^/]*$/, "") || "/";
export const basename = (path: string, ext = "") => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return ext && name.endsWith(ext) ? name.slice(0, -ext.length) : name;
};
export const extname = (path: string) => {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot) : "";
};
export const isAbsolute = (path: string) => path.startsWith("/");
export default { sep, join, resolve, dirname, basename, extname, isAbsolute };
