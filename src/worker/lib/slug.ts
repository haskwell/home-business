export const RESERVED_BUSINESS_SLUGS = [
  "api",
  "track",
  "login",
  "signup",
  "dashboard",
  "admin",
  "assets",
  "business",
  "menu",
  "orders",
  "users",
  "public",
  "auth",
  "health",
] as const;

const reservedSlugs = new Set<string>(RESERVED_BUSINESS_SLUGS);

export function isValidBusinessSlug(slug: string) {
  return (
    /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug) &&
    !reservedSlugs.has(slug)
  );
}

export function suggestBusinessSlug(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}
