import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { API_TOKEN_HEADER } from "../../shared/constants";
import { resolveDesktopRuntimeLayout } from "../../apps/runtime/src/layout";
import { APP_ORIGIN } from "../../apps/desktop/src/appProtocol";
import { startInProcessBackend, type InProcessBackend } from "../../apps/desktop/src/inProcessBackend";

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
  delete process.env.GRT_DATA_DIR;
  delete process.env.GRT_ASSET_ROOT;
  delete process.env.GRT_LOG_DIR;
});

describe("in-process desktop backend", () => {
  test("serves app://renderer API requests in memory without opening a TCP port, enforces token, and takes alerts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "grt-inproc-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    const layout = resolveDesktopRuntimeLayout({ root: process.cwd(), userData: dir });
    const apiToken = "secret-launch-token";

    const backend: InProcessBackend = await startInProcessBackend({
      layout,
      apiToken,
      packaged: true,
      listen: false,
      autoSync: false
    });
    cleanups.push(() => backend.stop());

    expect(backend.apiBaseUrl).toBe(APP_ORIGIN);

    // Rejects unknown app:// host.
    const badHost = await backend.handleAppRequest(new Request("app://other/api/releases"));
    expect(badHost.status).toBe(404);

    // Enforces per-launch API token.
    const unauthorized = await backend.handleAppRequest(new Request(`${APP_ORIGIN}/api/releases`));
    expect(unauthorized.status).toBe(401);

    // Answers authorized API calls directly through Fastify inject.
    const authorized = await backend.handleAppRequest(
      new Request(`${APP_ORIGIN}/api/releases`, { headers: { [API_TOKEN_HEADER]: apiToken } })
    );
    expect(authorized.status).toBe(200);
    expect(await authorized.json()).toEqual({ items: [], total: 0, truncated: false });

    // POST body + alerts work in-process too.
    const alerts = await backend.takeAlerts();
    expect(alerts).toEqual([]);
  });
});
