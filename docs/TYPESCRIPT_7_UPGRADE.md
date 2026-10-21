# TypeScript 7 upgrade plan

Status: planned, not started. Current compiler: `typescript` 5.9.3.

## Why

TypeScript 7 (July 2026) is Microsoft's compiler ported to Go. It type-checks about 8–12× faster and installs as the normal `typescript` package. In this repo only `tsc` gets faster: Vite, esbuild and Vitest strip types without it, so the packaged app, its size and its boot time do not change. The gain is shorter `npm run typecheck` and `npm run build` runs, locally and in CI.

The Rust ports announced in October 2026 (tsc-rs, tsrs) are out of scope until they are stable.

## Where `tsc` runs today

| Command | What runs | Config |
|---|---|---|
| `npm run typecheck` (CI: `checks` job) | `tsc --noEmit -p tsconfig.json` | ES modules, `moduleResolution: "Bundler"`, includes tests |
| `npm run build` (first step) | `tsc -p tsconfig.build.json` | overrides to `module: "CommonJS"`, `moduleResolution: "Node"`, excludes tests |

The build step's emitted JavaScript is not shipped. `scripts/bundle.mjs` writes over `main.js`, `preload.js` and `child.js` with esbuild bundles, and `build.files` packages only those three files plus `dist/frontend/**`. So that `tsc` run is only a type check with a second module setup.

## Known blocker

`tsconfig.build.json` sets `moduleResolution: "Node"` (node10). TypeScript 6 deprecated it and TypeScript 7 removes it, so the build step will fail as it is.

## Steps

Each step is its own commit so a failure can be reverted on its own.

### 1. Stop the build emitting files nobody ships

- Change the `build` script's first step to `tsc --noEmit -p tsconfig.build.json`, or drop it, since `npm run typecheck` already checks the same sources in CI.
- If kept, change `tsconfig.build.json` to `moduleResolution: "Bundler"` (or delete the file and its overrides).
- Check: `npm run build`, then `npx electron-builder --linux dir` and `xvfb-run -a npm run smoke`, to confirm the three bundled scripts and the renderer still package and boot.

This removes the blocker while still on 5.9.3, so the version jump in the next steps changes only one thing.

### 2. Go through TypeScript 6 first

TypeScript 6 is the bridge release: it warns about everything TypeScript 7 removes.

- `npm install -D typescript@6`
- Run `npm run typecheck` and fix each deprecation warning instead of silencing it.
- Settings to check against the TS 6 release notes, because defaults changed:
  - `types`: if it now defaults to none, add `"types": ["node"]` (and anything else the tests need) to `tsconfig.json`.
  - `rootDir`: set it explicitly if any emit path moves.
  - `esModuleInterop` / `allowSyntheticDefaultImports`: already `true`, nothing to do.
  - `target` / `lib`: ES2022 is still supported.
- Check: the full required checks from `AGENTS.md` (`npm rebuild better-sqlite3`, `npm test`, `npm run typecheck`, `npm run build`).

### 3. Move to TypeScript 7

- `npm install -D typescript@7`
- Run `npm run typecheck` and `npm run build`. TypeScript 7 aims to give the same errors as 6; any new error is a real difference to read, not suppress.
- Time both before and after (`time npm run typecheck`) and note the numbers in the commit message.
- Make sure no tool in the toolchain loads the `typescript` package as a library (TypeScript 7 does not ship the old JavaScript API yet). Today Vite, esbuild, Vitest and tsx do not. If one does, keep that tool on a pinned TypeScript 6 alongside.
- Check: the full required checks, then `npm run dist` and `npm run smoke` (or the Linux `xvfb-run` variant) as the final packaging check.

### 4. Editor and CI

- VS Code: use the workspace TypeScript version (`"typescript.tsdk": "node_modules/typescript/lib"`) so the editor and CI agree. The TypeScript 7 language server is what makes the editor faster.
- CI needs no workflow change: `npm ci` installs the new compiler, and `npm run typecheck` and `npm run build` keep the same names.

### 5. Docs

- Update the TypeScript version wherever `docs/DOCUMENTATION.md` mentions it.
- Add a `CHANGELOG.md` entry ("faster type checking; no change for users").
- If step 1 changed the build script, update the README command list.

## Rollback

Each step is one commit. To roll back, revert the commit and `npm install`. Step 1 is worth keeping even if 2 or 3 is rolled back.

## Done when

- `typescript` is on 7.x in `package.json` and `package-lock.json`.
- `npm test`, `npm run typecheck`, `npm run build` and the packaged smoke test pass, and CI is green.
- Before/after typecheck times are recorded.
