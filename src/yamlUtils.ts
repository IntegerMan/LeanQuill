/**
 * Shared YAML scalar parsing utilities.
 * Handles JSON-escaped strings produced by JSON.stringify during serialization.
 */

/**
 * Strip outer quotes from a YAML scalar token and unescape the interior.
 * Handles both single-quoted YAML strings (with '' escape) and
 * double-quoted JSON-escaped strings (produced by JSON.stringify).
 */
export function stripYamlQuotes(s: string): string {
  const t = s.trim();
  if (t.startsWith('"') && t.endsWith('"')) {
    try {
      return JSON.parse(t);
    } catch {
      return t.slice(1, -1);
    }
  }
  if (t.startsWith("'") && t.endsWith("'")) {
    return t.slice(1, -1).replace(/''/g, "'");
  }
  return t;
}
