import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const shim = (name: string) => fileURLToPath(new URL(`./src/nodeShims/${name}.ts`, import.meta.url));

// Builds the Android preview's web bundle: the desktop renderer plus the backend's stores and actions,
// with node: modules swapped for browser stand-ins.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "node:crypto": shim("crypto"),
      "node:fs": shim("fs"),
      "node:path": shim("path"),
      "node:os": shim("os")
    }
  },
  define: {
    "process.env": "{}",
    "process.platform": JSON.stringify("android")
  },
  optimizeDeps: { exclude: ["@sqlite.org/sqlite-wasm"] },
  build: {
    outDir: "../../dist/mobile",
    emptyOutDir: true,
    target: "es2022"
  }
});
