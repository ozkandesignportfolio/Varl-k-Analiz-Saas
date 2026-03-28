const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const isRetriableStatus = (status: number) => status === 408 || status === 409 || status === 429 || status >= 500;

const isAbortLikeError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 12_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: {
    timeoutMs?: number;
    retries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  } = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const retries = Math.max(0, Math.floor(options.retries ?? 1));
  const baseDelayMs = Math.max(50, Math.floor(options.baseDelayMs ?? 350));
  const maxDelayMs = Math.max(baseDelayMs, Math.floor(options.maxDelayMs ?? 2_000));

  let lastError: unknown = null;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(input, init, timeoutMs);
      if (!isRetriableStatus(response.status) || attempt === retries) {
        return response;
      }
      lastResponse = response;
    } catch (error) {
      lastError = error;
      if (!isAbortLikeError(error) && !(error instanceof TypeError) && attempt === retries) {
        throw error;
      }
      if (attempt === retries) {
        throw error;
      }
    }

    const exponentialBackoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
    const jitter = Math.floor(Math.random() * Math.max(25, Math.floor(exponentialBackoff * 0.2)));
    await sleep(exponentialBackoff + jitter);
  }

  if (lastResponse) {
    return lastResponse;
  }
  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("fetchWithRetry failed unexpectedly.");
}
