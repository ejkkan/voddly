export function normalizeImageUrl(
  raw: string | null | undefined,
  server?: string
): string | null {
  if (!raw) return null;
  let url = String(raw).trim();
  if (!url) return null;
  if (url.startsWith('@')) url = url.slice(1);
  try {
    const serverURL = server ? new URL(server) : null;
    // Absolute URL
    if (/^https?:\/\//i.test(url)) {
      const u = new URL(url);
      if (serverURL && u.hostname.toLowerCase() === 'ptv.is') {
        u.protocol = serverURL.protocol;
        u.host = serverURL.host;
        return u.toString();
      }
      return u.toString();
    }
    // Relative path
    if (serverURL) {
      const rel = url.startsWith('/') ? url : `/${url}`;
      return new URL(rel, serverURL).toString();
    }
    return null;
  } catch {
    return null;
  }
}
