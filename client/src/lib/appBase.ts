const API_PREFIX = "/api";
const WS_PATH = "/ws";

export function getAppBasePath(): string {
  if (typeof window === "undefined") return "";

  const firstSegment = window.location.pathname.split("/").filter(Boolean)[0];
  if (!firstSegment) return "";

  return `/${firstSegment}`;
}

function joinBasePath(basePath: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!basePath || normalizedPath.startsWith(`${basePath}/`)) {
    return normalizedPath;
  }

  return `${basePath}${normalizedPath}`;
}

export function apiUrl(path: string): string {
  return joinBasePath(getAppBasePath(), path);
}

export function webSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${joinBasePath(getAppBasePath(), WS_PATH)}`;
}

export function apiPrefix(): string {
  return joinBasePath(getAppBasePath(), API_PREFIX);
}
