/** Small fetch helpers shared by the source and target adapters. */

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** Strips anything that looks like a credential from a message we may surface. */
export function redact(text) {
  if (!text) return text;
  return String(text)
    .replace(/eyJ[A-Za-z0-9._-]{10,}/g, '[redacted-token]')
    .replace(/sbp_[A-Za-z0-9]+/g, '[redacted-token]')
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, '[redacted-key]');
}

export async function request(url, options = {}) {
  const { timeoutMs = 60_000, retries = 2, ...init } = options;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  const error = new Error(`Request failed: ${redact(lastError?.message || 'network error')}`);
  error.network = true;
  throw error;
}

export async function readBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function expectOk(response, what) {
  if (response.ok) return readBody(response);
  const body = await readBody(response);
  const detail =
    typeof body === 'string'
      ? body
      : body?.message || body?.error_description || body?.error || JSON.stringify(body);
  throw new HttpError(
    response.status,
    `${what} failed (${response.status}): ${redact(detail).slice(0, 400)}`,
  );
}
