const NON_ALPHANUM = /[^a-z0-9]+/g;
const EDGE_HYPHENS = /^-+|-+$/g;

export function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(NON_ALPHANUM, "-")
    .replace(EDGE_HYPHENS, "");

  return normalized.length > 0 ? normalized : "service";
}
