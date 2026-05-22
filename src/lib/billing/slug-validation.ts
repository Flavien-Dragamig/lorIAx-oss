import { RESERVED_SLUGS } from "./plans";

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]{3,32}$/.test(slug);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug);
}
