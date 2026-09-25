# Desktop shell

This directory contains the privileged Electron main process. It owns window creation, process lifecycle, backend-child startup, crash reporting, preload exposure, and native file-picker IPC.

- `main.ts` — application entry and window creation.
- `backendProcess.ts` — resolves and starts the backend child.
- `desktopLifecycle.ts` — lifecycle and fatal-process handling.
- `preload.ts` — the narrow renderer bridge.
- `*Ipc.ts` — native IPC adapters for the wallpaper picker and `saveImageIpc.ts` (Save as image).

Keep domain and presentation logic outside this process; call backend/runtime seams instead.
