import type { FastifyInstance } from "fastify";
import type { TrackerDatabase } from "../../../backend/src/database/db";
import { runWrite } from "../../../backend/src/database/writeQueue";
import type { DiagnosticLogger } from "../../../backend/src/diagnostics/logger";
import { createIgdbGateway, type IgdbGateway } from "../../../backend/src/igdb/gateway";
import { registerAdminRoutes } from "../../../backend/src/routes/adminRoutes";
import { registerAlertRoutes } from "../../../backend/src/routes/alertRoutes";
import { registerCompletedRoutes } from "../../../backend/src/routes/completedRoutes";
import { registerDemoRoutes } from "../../../backend/src/routes/demoRoutes";
import { registerDiagnosticRoutes } from "../../../backend/src/routes/diagnosticRoutes";
import { registerPreferencesRoutes } from "../../../backend/src/routes/preferencesRoutes";
import { registerRandomizerRoutes } from "../../../backend/src/routes/randomizerRoutes";
import { registerReleaseRoutes } from "../../../backend/src/routes/releaseRoutes";
import { registerSettingsRoutes } from "../../../backend/src/routes/settingsRoutes";
import { registerSyncRoutes } from "../../../backend/src/routes/syncRoutes";
import { registerYearInReviewRoutes } from "../../../backend/src/routes/yearInReviewRoutes";
import { createSettingsStore } from "../../../backend/src/settings/settingsStore";
import { failInterruptedSyncRuns } from "../../../backend/src/sync/syncStatus";

// The Android app's backend: the desktop backend's own route modules, registered on a small in-page
// router instead of Fastify, and called through the same ApiClient as the desktop renderer. Routes that
// serve files from disk (artwork files, cover cache, wallpaper, the built frontend) are not registered;
// a call to one answers 404 with a plain message.

type Handler = (request: InAppRequest, reply: InAppReply) => unknown;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  staticSegments: number;
  handler: Handler;
}

interface InAppRequest {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  headers: Record<string, string>;
}

interface InAppReply {
  statusCode: number;
  sent: boolean;
  payload: unknown;
  code(status: number): InAppReply;
  status(status: number): InAppReply;
  header(name: string, value: string): InAppReply;
  type(contentType: string): InAppReply;
  send(payload?: unknown): InAppReply;
}

export const NOT_ON_ANDROID = "This isn't available in the Android app yet.";
const SAFE_SERVER_ERROR = "Something went wrong. Check the diagnostics log for details.";

function compile(method: string, path: string, handler: Handler): Route {
  const keys: string[] = [];
  const segments = path.split("/");
  const source = segments
    .map(segment => {
      if (!segment.startsWith(":")) return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      keys.push(segment.slice(1));
      return "([^/]+)";
    })
    .join("/");
  return { method, pattern: new RegExp(`^${source}$`), keys, staticSegments: segments.length - keys.length, handler };
}

function createReply(): InAppReply {
  const reply: InAppReply = {
    statusCode: 200,
    sent: false,
    payload: undefined,
    code(status) {
      reply.statusCode = status;
      return reply;
    },
    status(status) {
      return reply.code(status);
    },
    header() {
      return reply;
    },
    type() {
      return reply;
    },
    send(payload) {
      reply.payload = payload;
      reply.sent = true;
      return reply;
    }
  };
  return reply;
}

function json(status: number, payload: unknown) {
  return new Response(payload === undefined ? null : JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

export interface InAppBackendOptions {
  db: TrackerDatabase;
  igdb?: IgdbGateway;
  logger?: DiagnosticLogger;
  today?: () => Date;
}

export function createInAppBackend({
  db,
  igdb = createIgdbGateway({ readConfig: () => createSettingsStore(db).igdbTokenConfig() }),
  logger = { log: (event, details) => console.info("[backend]", event, details) },
  today = () => new Date()
}: InAppBackendOptions) {
  const routes: Route[] = [];
  const add = (method: string) => (path: string, handler: Handler) => {
    routes.push(compile(method, path, handler));
  };
  // The part of FastifyInstance the route modules use.
  const app = {
    get: add("GET"),
    post: add("POST"),
    put: add("PUT"),
    patch: add("PATCH"),
    delete: add("DELETE"),
    addHook: () => undefined
  } as unknown as FastifyInstance;

  const context = { app, db, logger, igdb };
  registerReleaseRoutes(context);
  registerCompletedRoutes(context);
  registerRandomizerRoutes(context);
  registerYearInReviewRoutes(context, { today });
  registerDemoRoutes(context, { today });
  registerSyncRoutes(context);
  registerAlertRoutes(context, { today });
  registerSettingsRoutes(context);
  registerPreferencesRoutes(context);
  registerDiagnosticRoutes(context);
  registerAdminRoutes(context);
  // Fastify prefers a static segment over a parameter: "/api/releases/manual" before "/api/releases/:id".
  routes.sort((a, b) => b.staticSegments - a.staticSegments);

  void runWrite(db, () => failInterruptedSyncRuns(db));

  async function handle(method: string, url: URL, body: unknown): Promise<Response> {
    for (const route of routes) {
      if (route.method !== method) continue;
      const match = route.pattern.exec(url.pathname);
      if (!match) continue;
      const params = Object.fromEntries(route.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]));
      const request: InAppRequest = { params, query: Object.fromEntries(url.searchParams), body, headers: {} };
      const reply = createReply();
      try {
        const result = await route.handler(request, reply);
        return json(reply.statusCode, reply.sent || result === reply ? reply.payload : result);
      } catch (error) {
        const statusCode = (error as { statusCode?: unknown }).statusCode;
        const status = typeof statusCode === "number" && statusCode >= 400 && statusCode < 500 ? statusCode : 500;
        const message = error instanceof Error ? error.message : String(error);
        logger.log("http.error", { method, url: url.pathname, statusCode: status, message });
        return json(status, { error: status >= 500 ? SAFE_SERVER_ERROR : message });
      }
    }
    return json(404, { error: NOT_ON_ANDROID });
  }

  // A fetch for createApiClient: requests never leave the page.
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "http://in-app.local");
    const text = typeof init?.body === "string" ? init.body : undefined;
    return handle((init?.method ?? "GET").toUpperCase(), url, text ? JSON.parse(text) : undefined);
  };

  return { fetch: fetcher, routeCount: () => routes.length };
}
