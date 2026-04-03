/**
 * Truncates an address/hash string in the middle.
 * e.g. "0x1234567890abcdef" → "0x1234…cdef"
 */
export function truncateMiddle(str: string, start = 6, end = 4): string {
  if (!str) return "";
  if (str.length <= start + end + 3) return str;
  return `${str.slice(0, start)}…${str.slice(-end)}`;
}

/**
 * Formats a number as a compact currency string.
 * e.g. 45000 → "$45,000"
 */
export function formatCurrency(value: number, symbol = "$"): string {
  return `${symbol}${value.toLocaleString("en-US")}`;
}

/**
 * Formats a percentage with a fixed number of decimal places.
 */
export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Returns a relative time string (e.g. "2 days ago") from an ISO date string.
 */
export function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
