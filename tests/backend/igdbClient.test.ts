import { describe, expect, test, vi } from "vitest";
import { IgdbClient } from "../../apps/backend/src/igdb/client";

describe("IGDB client authentication", () => {
  test("refreshes with client secret instead of using stale static token", async () => {
    const calls: Array<{ url: string; body?: BodyInit | null; auth?: string | null }> = [];
    const fetcher = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body, auth: init?.headers ? new Headers(init.headers).get("Authorization") : null });
      if (String(url).includes("oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "fresh-token" }), { status: 200 });
      }
      return new Response(JSON.stringify([{ id: 1, name: "Atlus" }]), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new IgdbClient({ clientId: "client", clientSecret: "secret", accessToken: "stale-token" }, fetcher);

    await client.query("companies", "fields id,name; limit 1;");

    expect(calls[0].url).toContain("oauth2/token");
    expect(calls[1].auth).toBe("Bearer fresh-token");
  });

  test("retries once with refreshed token after 401", async () => {
    let gameCalls = 0;
    const fetcher = vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes("oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "retry-token" }), { status: 200 });
      }
      gameCalls++;
      if (gameCalls === 1) return new Response("nope", { status: 401 });
      return new Response(JSON.stringify([{ id: 1, name: "Atlus" }]), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new IgdbClient({ clientId: "client", clientSecret: "secret" }, fetcher);

    await expect(client.query("companies", "fields id,name; limit 1;")).resolves.toHaveLength(1);
    expect(gameCalls).toBe(2);
  });

  test("a hung request fails with a timeout error instead of retrying", async () => {
    let gameCalls = 0;
    const fetcher = vi.fn((_url: string | URL, init?: RequestInit) => {
      gameCalls++;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    }) as unknown as typeof fetch;

    const client = new IgdbClient({ clientId: "client", accessToken: "static" }, fetcher, 20);

    await expect(client.query("games", "fields id; limit 1;")).rejects.toThrow("IGDB games timed out after 20 ms");
    expect(gameCalls).toBe(1);
  });

  test("enforces timeout even when the underlying fetcher ignores AbortSignal (Capacitor Android seam)", async () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => undefined)) as unknown as typeof fetch;
    const client = new IgdbClient({ clientId: "client", accessToken: "static" }, fetcher, 25, 0);

    await expect(client.query("games", "fields id; limit 1;")).rejects.toThrow("IGDB games timed out after 25 ms");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("retries transient Android DNS/network failures and succeeds when connectivity recovers", async () => {
    let attempts = 0;
    const fetcher = vi.fn(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Unable to resolve host "api.igdb.com": No address associated with hostname');
      }
      return new Response(JSON.stringify([{ id: 42, name: "Recovered Game" }]), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new IgdbClient({ clientId: "client", accessToken: "static" }, fetcher, 500, 1);

    await expect(client.query("games", "fields id,name; limit 1;")).resolves.toEqual([{ id: 42, name: "Recovered Game" }]);
    expect(attempts).toBe(3);
  });

  test("reports a clear connectivity error when DNS failures persist across retries", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('Unable to resolve host "api.igdb.com": No address associated with hostname');
    }) as unknown as typeof fetch;

    const client = new IgdbClient({ clientId: "client", accessToken: "static" }, fetcher, 500, 1);

    await expect(client.query("games", "fields id; limit 1;")).rejects.toThrow(/Could not reach IGDB.*Unable to resolve host/);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  test("still refreshes an expired token on 401 even after an earlier 429 retry", async () => {
    let tokenCalls = 0;
    let gameCalls = 0;
    const fetcher = vi.fn(async (url: string | URL) => {
      if (String(url).includes("oauth2/token")) {
        tokenCalls++;
        return new Response(JSON.stringify({ access_token: `tok-${tokenCalls}` }), { status: 200 });
      }
      gameCalls++;
      if (gameCalls === 1) return new Response("slow down", { status: 429 });
      if (gameCalls === 2) return new Response("expired", { status: 401 });
      return new Response(JSON.stringify([{ id: 7, name: "After Refresh" }]), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new IgdbClient({ clientId: "client", clientSecret: "secret" }, fetcher, 500, 1);

    await expect(client.query("games", "fields id,name; limit 1;")).resolves.toEqual([{ id: 7, name: "After Refresh" }]);
    expect(tokenCalls).toBe(2);
    expect(gameCalls).toBe(3);
  });
});
