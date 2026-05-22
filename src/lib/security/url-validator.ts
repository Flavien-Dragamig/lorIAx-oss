/**
 * SSRF protection — blocks requests to private/internal network ranges.
 * Validates that a URL does not point to localhost, private IPs, or metadata endpoints.
 */

const PRIVATE_IP_RANGES = [
  /^127\./, // loopback
  /^10\./, // class A private
  /^172\.(1[6-9]|2\d|3[01])\./, // class B private
  /^192\.168\./, // class C private
  /^169\.254\./, // link-local (cloud metadata!)
  /^0\./, // "this" network
  /^::1$/, // IPv6 loopback
  /^fc00:/, // IPv6 unique local
  /^fe80:/, // IPv6 link-local
];

// IPv6-mapped IPv4 prefix: ::ffff:x.x.x.x — resolves to IPv4 internally
const IPV6_MAPPED_IPV4_PREFIX = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i;

const BLOCKED_HOSTNAMES = ["localhost", "metadata.google.internal"];

/**
 * Simple IPv4 check using regex (avoids Node.js net module).
 */
function isIPv4(hostname: string): boolean {
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  return ipv4Pattern.test(hostname);
}

/**
 * Check if a URL points to a private/internal network address.
 * Blocks: loopback, private ranges, link-local, cloud metadata, .local hostnames.
 */
export function isPrivateUrl(url: URL): boolean {
  const hostname = url.hostname;

  // Direct IP check (IPv4)
  if (isIPv4(hostname)) {
    return PRIVATE_IP_RANGES.some((r) => r.test(hostname));
  }

  // IPv6-mapped IPv4 (::ffff:127.0.0.1 resolves to 127.0.0.1 internally)
  const mappedMatch = IPV6_MAPPED_IPV4_PREFIX.exec(hostname);
  if (mappedMatch) {
    const ipv4Part = mappedMatch[1];
    return PRIVATE_IP_RANGES.some((r) => r.test(ipv4Part));
  }

  // Pure IPv6 ranges
  if (PRIVATE_IP_RANGES.some((r) => r.test(hostname))) {
    return true;
  }

  // Hostname-based checks
  if (BLOCKED_HOSTNAMES.includes(hostname.toLowerCase())) {
    return true;
  }

  // Block .local and .internal TLDs (mDNS, internal DNS)
  if (
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".localhost")
  ) {
    return true;
  }

  return false;
}

/**
 * Validate a URL for external fetch: must be http(s) and not target a private network.
 * Returns an error message if invalid, or null if the URL is safe.
 */
export function validateExternalUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "URL invalide";
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return "Protocole non supporté";
  }

  if (isPrivateUrl(parsed)) {
    return "Les URL pointant vers des adresses privées ou locales ne sont pas autorisées";
  }

  return null;
}
