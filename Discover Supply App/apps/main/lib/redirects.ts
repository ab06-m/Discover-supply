export function safeInternalPath(
  value: string | null | undefined,
  fallback = "/",
) {
  const path = value?.trim();

  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    /^[a-z][a-z0-9+.-]*:/i.test(path)
  ) {
    return fallback;
  }

  return path;
}
