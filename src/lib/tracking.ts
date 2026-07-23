function getAppUrl(): string {
  let url = process.env.APP_URL || "http://localhost:3000";
  if (url.endsWith("/")) url = url.slice(0, -1);
  return url;
}

/** True when tracking links would be reachable by external mail clients. */
export function isPublicTrackingBase(url: string = getAppUrl()): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !(
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local")
    );
  } catch {
    return false;
  }
}

export function getTrackingBaseUrl(): string {
  return getAppUrl();
}

export function personalize(
  text: string,
  recipient: { email: string; name?: string | null }
): string {
  if (!text) return "";
  let result = text;
  result = result.replace(/\{\{\s*name\s*\}\}/gi, recipient.name || recipient.email.split("@")[0]);
  result = result.replace(/\{\{\s*email\s*\}\}/gi, recipient.email);
  return result;
}

function buildClickUrl(trackingId: string, originalUrl: string): string {
  const appUrl = getAppUrl();
  return `${appUrl}/api/track/click/${trackingId}?u=${encodeURIComponent(originalUrl)}`;
}

function shouldTrackUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (/^(mailto:|tel:|sms:|javascript:|#)/i.test(trimmed)) return false;
  if (trimmed.includes("/api/track/")) return false;
  return /^https?:\/\//i.test(trimmed);
}

/**
 * Only allow http(s) absolute URLs for click redirects (blocks open-redirect abuse).
 */
export function sanitizeRedirectUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  try {
    const parsed = new URL(decoded);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function prepareTrackedBody(
  body: string,
  type: "HTML" | "TEXT",
  trackingId: string
): string {
  if (type === "HTML") {
    // Rewrite any href="http(s)://..." regardless of attribute order / quote style
    let trackedBody = body.replace(
      /<a\b([^>]*?)href\s*=\s*(["'])(.*?)\2([^>]*)>/gi,
      (match, before, quote, href, after) => {
        if (!shouldTrackUrl(href)) return match;
        const tracked = buildClickUrl(trackingId, href);
        return `<a${before}href=${quote}${tracked}${quote}${after}>`;
      }
    );

    // Also catch unquoted href=http...
    trackedBody = trackedBody.replace(
      /<a\b([^>]*?)href\s*=\s*(https?:\/\/[^\s>]+)([^>]*)>/gi,
      (match, before, href, after) => {
        if (!shouldTrackUrl(href)) return match;
        const tracked = buildClickUrl(trackingId, href);
        return `<a${before}href="${tracked}"${after}>`;
      }
    );

    // Email-client-friendly open pixel (avoid display:none — some clients strip it)
    const appUrl = getAppUrl();
    const pixelUrl = `${appUrl}/api/track/open/${trackingId}`;
    const pixelTag =
      `<img src="${pixelUrl}" width="1" height="1" border="0" ` +
      `alt="" style="height:1px!important;width:1px!important;border:0!important;` +
      `margin:0!important;padding:0!important;max-height:1px!important;max-width:1px!important;" />`;

    if (/<\/body>/i.test(trackedBody)) {
      trackedBody = trackedBody.replace(/<\/body>/i, `${pixelTag}</body>`);
    } else {
      trackedBody += pixelTag;
    }

    return trackedBody;
  }

  // TEXT: rewrite bare http(s) URLs; opens cannot be tracked without a pixel
  return body.replace(/(https?:\/\/[^\s<>"']+)/gi, (url) => {
    if (!shouldTrackUrl(url)) return url;
    return buildClickUrl(trackingId, url);
  });
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
