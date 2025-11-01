import { format, formatDistanceToNow } from "date-fns";

export function formatDate(date: string | Date) {
  const parsed = typeof date === "string" ? new Date(date) : date;
  return format(parsed, "PPpp");
}

export function formatRelative(date: string | Date) {
  const parsed = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(parsed, { addSuffix: true });
}
