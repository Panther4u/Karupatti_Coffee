/**
 * Shared date utilities — IST timezone handling.
 * India Standard Time is UTC+5:30.
 */

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

/** Get today's date in IST as YYYY-MM-DD string */
export function getISTToday() {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET);
  return ist.toISOString().split("T")[0];
}

/** Format a date string for display (e.g. "26 Mar 2026") */
export function formatDateDisplay(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00+05:30");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
