import { IGDB_REQUESTS_PER_SECOND } from "../../../../shared/constants";
import { fetchWithTimeout, refreshAccessToken, type TokenConfig } from "./token";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// Resolved per call so tests that stub the global fetch still reach a long-lived client.
const globalFetch: typeof fetch = (input, init) => globalThis.fetch(input, init);
// A hung IGDB request would otherwise leave sync, search or a Randomizer spin waiting forever.
const IGDB_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_DELAY_MS = 500;
const TRANSIENT_STATUSES = new Set([429, 502, 503, 504]);

function isTimeoutError(error: unknown) {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function isNetworkFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /unable to resolve host|no address associated|failed to fetch|network|enotfound|econnreset|eai_again|etimedout|socket|connection/i.test(message);
}

export class IgdbClient {
  private nextSlotAt = 0;
  private token: Promise<string | undefined> | undefined;

  constructor(
    private readonly config: TokenConfig,
    private readonly fetcher: typeof fetch = globalFetch,
    private readonly timeoutMs = IGDB_REQUEST_TIMEOUT_MS,
    private readonly retryDelayMs = DEFAULT_RETRY_DELAY_MS
  ) {}

  query<T>(endpoint: string, body: string): Promise<T[]> {
    return this.request<T[]>(endpoint, body);
  }

  // Any IGDB response shape: `games/count` answers with one `{ count }` object, not an array.
  async request<T>(endpoint: string, body: string): Promise<T> {
    const clientId = this.config.clientId;
    const initialToken = await this.getToken();
    if (!clientId || !initialToken) throw new Error("IGDB credentials missing");
    let token = initialToken;
    let refreshedToken = false;
    let lastStatus: number | null = null;
    let lastTransportError: unknown = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      await this.rateLimit();
      let response: Response;
      try {
        response = await this.send(endpoint, clientId, token, body);
      } catch (error) {
        // Timeouts fail fast without retrying; transient transport/DNS blips (common on mobile
        // networks / VPN / Android radio handoffs) retry with backoff before failing the run.
        if (isTimeoutError(error)) throw error;
        lastTransportError = error;
        if (attempt < 2) {
          if (this.retryDelayMs > 0) await delay(this.retryDelayMs * (attempt + 1));
          continue;
        }
        break;
      }

      if (TRANSIENT_STATUSES.has(response.status)) {
        lastStatus = response.status;
        if (attempt < 2) {
          if (this.retryDelayMs > 0) await delay(this.retryDelayMs * (attempt + 1));
          continue;
        }
        break;
      }
      if ((response.status === 401 || response.status === 403) && this.config.clientSecret && !refreshedToken) {
        refreshedToken = true;
        const refreshed = await this.getToken(true);
        if (!refreshed) throw new Error("IGDB credentials missing");
        token = refreshed;
        continue;
      }
      if (!response.ok) throw new Error(`IGDB ${endpoint} failed: ${response.status}`);
      return await response.json() as T;
    }

    if (lastStatus === 429) throw new Error("IGDB rate limit retry exhausted");
    if (lastStatus !== null) throw new Error(`IGDB ${endpoint} failed: ${lastStatus}`);
    if (lastTransportError !== null) {
      const detail = lastTransportError instanceof Error ? lastTransportError.message : String(lastTransportError);
      if (isNetworkFailure(lastTransportError)) {
        throw new Error(`Could not reach IGDB (api.igdb.com). Check your internet connection or VPN/DNS and try again. (${detail})`);
      }
      throw lastTransportError instanceof Error ? lastTransportError : new Error(detail);
    }
    throw new Error("IGDB rate limit retry exhausted");
  }

  private send(endpoint: string, clientId: string, token: string, body: string) {
    return fetchWithTimeout(
      this.fetcher,
      `https://api.igdb.com/v4/${endpoint}`,
      {
        method: "POST",
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        },
        body
      },
      this.timeoutMs,
      `IGDB ${endpoint} timed out after ${this.timeoutMs} ms`
    );
  }

  // Concurrent callers share one token request.
  private getToken(forceRefresh = false) {
    if (this.token && !forceRefresh) return this.token;
    this.token = this.config.clientSecret
      ? refreshAccessToken(this.config, this.fetcher, this.timeoutMs, this.retryDelayMs)
      : Promise.resolve(this.config.accessToken);
    this.token.catch(() => { this.token = undefined; });
    return this.token;
  }

  // Slots are reserved synchronously, so concurrent callers are spaced out instead of racing.
  private async rateLimit() {
    const minGap = Math.ceil(1000 / IGDB_REQUESTS_PER_SECOND);
    const now = Date.now();
    const slot = Math.max(now, this.nextSlotAt);
    this.nextSlotAt = slot + minGap;
    if (slot > now) await delay(slot - now);
  }
}
