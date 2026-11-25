import type { FastifyInstance } from "fastify";
import { CREDENTIAL_KEYS, API_TOKEN_HEADER } from "../../../shared/constants";
import type { ReleaseAlert } from "../../../shared/types";
import { openDatabase, type TrackerDatabase } from "../../backend/src/database/db";
import { runMigrations } from "../../backend/src/database/migrations";
import { createFileDiagnosticLogger } from "../../backend/src/diagnostics/logger";
import { createBackendApp } from "../../backend/src/server";
import { configureProcessCipher } from "../../backend/src/settings/secretCipher";
import { createSettingsStore } from "../../backend/src/settings/settingsStore";
import { seedOverrides } from "../../backend/src/sync/overrides";
import { resolveBackendRuntimeLayout, type resolveDesktopRuntimeLayout } from "../../runtime/src/layout";
import { APP_ORIGIN, APP_SCHEME } from "./appProtocol";

// Runs the desktop backend directly inside Electron's main process instead of spawning a second
// Node/V8 utilityProcess (~44 MB Private / ~83 MB WS saved). In packaged mode requests flow through
// Fastify's in-memory `inject()` via app://renderer with zero TCP socket; in dev mode it listens on
// loopback so Vite's cross-origin dev server can still reach it.

export interface InProcessBackend {
  apiBaseUrl: string;
  handleAppRequest(request: Request): Promise<Response>;
  takeAlerts(): Promise<ReleaseAlert[]>;
  stop(): Promise<void>;
}

const APP_HOST = new URL(APP_ORIGIN).host;

export async function startInProcessBackend({
  layout,
  apiToken,
  credentialKey,
  packaged,
  listen = !packaged,
  autoSync = true
}: {
  layout: ReturnType<typeof resolveDesktopRuntimeLayout>;
  apiToken?: string;
  credentialKey?: string;
  packaged: boolean;
  listen?: boolean;
  autoSync?: boolean;
}): Promise<InProcessBackend> {
  // Align process.env with the resolved desktop layout so runtime/layout helpers see the same paths.
  Object.assign(process.env, layout.backendEnv);
  if (packaged) {
    for (const key of CREDENTIAL_KEYS) delete process.env[key];
  }

  const backendLayout = resolveBackendRuntimeLayout();
  const logger = createFileDiagnosticLogger(backendLayout.logDir);
  const db: TrackerDatabase = openDatabase(backendLayout.dbPath);
  let app: FastifyInstance | null = null;

  try {
    runMigrations(db);
    configureProcessCipher(credentialKey || undefined);
    const sealed = createSettingsStore(db).encryptStoredCredentials();
    if (sealed > 0) logger.log("credentials.encrypted_legacy_values", { count: sealed });
    await seedOverrides(db, backendLayout.seedOverridesPath).catch(error => {
      if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
        logger.log("backend.seed_overrides_failed", {
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });

    app = createBackendApp({ db, autoSync, apiToken, logger });
    let apiBaseUrl = APP_ORIGIN;
    if (listen) {
      const address = await app.listen({ host: "127.0.0.1", port: 0 });
      const port = Number(new URL(address).port);
      apiBaseUrl = `http://127.0.0.1:${port}`;
    } else {
      await app.ready();
    }

    const fastify = app;
    let stopped = false;

    return {
      apiBaseUrl,
      handleAppRequest: request => dispatchAppRequest(fastify, request),
      async takeAlerts() {
        const res = await fastify.inject({
          method: "POST",
          url: "/api/alerts/take",
          headers: {
            host: "127.0.0.1",
            ...(apiToken ? { [API_TOKEN_HEADER]: apiToken } : {})
          }
        });
        if (res.statusCode < 200 || res.statusCode >= 300) {
          throw new Error(`backend answered ${res.statusCode}`);
        }
        return (JSON.parse(res.payload) as { items: ReleaseAlert[] }).items;
      },
      async stop() {
        if (stopped) return;
        stopped = true;
        try {
          await fastify.close();
        } finally {
          db.close();
        }
      }
    };
  } catch (error) {
    try {
      await app?.close();
    } catch {
      // Ignore cleanup errors on startup failure.
    }
    try {
      db.close();
    } catch {
      // Ignore cleanup errors on startup failure.
    }
    throw error;
  }
}

// Translates an Electron app://renderer Request into an in-memory Fastify inject call.
export async function dispatchAppRequest(app: Pick<FastifyInstance, "inject">, request: Request): Promise<Response> {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (url.protocol !== `${APP_SCHEME}:` || url.host !== APP_HOST) {
    return new Response("Not found", { status: 404 });
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "origin" || lower === "referer") return;
    headers[lower] = value;
  });
  headers.host = "127.0.0.1";

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const payload = hasBody ? Buffer.from(await request.arrayBuffer()) : undefined;

  const injected = await app.inject({
    method: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS",
    url: `${url.pathname}${url.search}`,
    headers,
    ...(payload && payload.length > 0 ? { payload } : {})
  });

  const responseHeaders = new Headers();
  for (const [key, value] of Object.entries(injected.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) responseHeaders.append(key, String(item));
    } else {
      responseHeaders.set(key, String(value));
    }
  }

  const body = injected.statusCode === 204 || injected.statusCode === 304 ? null : new Uint8Array(injected.rawPayload);
  return new Response(body, { status: injected.statusCode, headers: responseHeaders });
}
