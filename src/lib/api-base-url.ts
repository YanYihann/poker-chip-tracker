const DEFAULT_API_PORT = process.env.NEXT_PUBLIC_API_PORT?.trim() || "4001";
const ENV_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveApiBaseUrl(): string {
  if (ENV_API_BASE_URL) {
    return trimTrailingSlash(ENV_API_BASE_URL);
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${window.location.hostname}:${DEFAULT_API_PORT}`;
  }

  return `http://localhost:${DEFAULT_API_PORT}`;
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl();
}

export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

export function toNetworkError(error: unknown): Error {
  if (error instanceof TypeError) {
    return new Error(
      `Unable to reach API server (${getApiBaseUrl()}). Start backend on port ${DEFAULT_API_PORT} or set NEXT_PUBLIC_API_BASE_URL.`
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Request failed.");
}
