export interface TokenConfig {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
}

export function readTokenConfig(env: NodeJS.ProcessEnv = process.env): TokenConfig {
  return {
    clientId: env.IGDB_CLIENT_ID,
    clientSecret: env.IGDB_CLIENT_SECRET,
    accessToken: env.IGDB_ACCESS_TOKEN
  };
}

export function getAppCredentialStatus(config: TokenConfig, lastError?: string | null) {
  if (!config.clientId || (!config.clientSecret && !config.accessToken)) return { status: "missing" as const };
  if (lastError && /expired|invalid|401|403|rejected/i.test(lastError)) return { status: "expired-or-rejected" as const, message: lastError };
  if (lastError) return { status: "configured-invalid" as const, message: lastError };
  return { status: "ready" as const };
}

const TOKEN_TIMEOUT_MS = 10_000;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function isTimeoutError(error: unknown) {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function isTransientHttpStatus(status: number) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

export async function fetchWithTimeout(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutMessage: string
): Promise<Response> {
  const signal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(timeoutMs)
    : undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Race a JS timer as well as AbortSignal.timeout: Capacitor Android's native HTTP fetch
    // patch drops `options.signal`, so relying on AbortSignal alone never times out on Android.
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        const error = new Error(timeoutMessage);
        error.name = "TimeoutError";
        reject(error);
      }, timeoutMs);
    });
    return await Promise.race([
      fetcher(url, signal ? { ...init, signal } : init),
      timeoutPromise
    ]);
  } catch (error) {
    if (isTimeoutError(error)) {
      const timeoutError = new Error(timeoutMessage);
      timeoutError.name = "TimeoutError";
      throw timeoutError;
    }
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function refreshAccessToken(
  config: TokenConfig,
  fetcher: typeof fetch = fetch,
  timeoutMs = TOKEN_TIMEOUT_MS,
  retryDelayMs = 500
) {
  if (!config.clientId || !config.clientSecret) throw new Error("Missing IGDB client id or secret");
  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("client_secret", config.clientSecret);
  url.searchParams.set("grant_type", "client_credentials");
  const target = url.toString();

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetchWithTimeout(
        fetcher,
        target,
        { method: "POST" },
        timeoutMs,
        `IGDB token refresh timed out after ${timeoutMs} ms`
      );
      if (isTransientHttpStatus(response.status) && attempt < 2) {
        if (retryDelayMs > 0) await delay(retryDelayMs * (attempt + 1));
        continue;
      }
      if (!response.ok) throw new Error(`IGDB token refresh failed: ${response.status}`);
      const body = await response.json() as { access_token: string };
      return body.access_token;
    } catch (error) {
      if (isTimeoutError(error) || (error instanceof Error && error.message.startsWith("IGDB token refresh failed:"))) {
        throw error;
      }
      lastError = error;
      if (attempt < 2) {
        if (retryDelayMs > 0) await delay(retryDelayMs * (attempt + 1));
        continue;
      }
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Could not reach Twitch auth (id.twitch.tv): ${detail}`);
}
