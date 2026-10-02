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
    const local = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!local || process.env.NEXT_PUBLIC_API_TRANSPORT === "polling") return window.location.origin;
    return `http://${window.location.hostname}:${DEFAULT_API_PORT}`;
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
      "暂时无法连接服务，请检查网络后重试。"
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Request failed.");
}
