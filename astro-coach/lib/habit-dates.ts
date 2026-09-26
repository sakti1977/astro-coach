/** YYYY-MM-DD in the user's own timezone. toISOString() is UTC, which moved
 * "today" to yesterday or tomorrow around midnight for anyone not on UTC. */
export function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Consecutive days done, ending today — or ending yesterday if today isn't
 * ticked yet, so an unbroken streak doesn't read as 0 all morning. */
export function computeStreak(dates: string[], now: Date = new Date()): number {
  const done = new Set(dates);
  const d = new Date(now);
  if (!done.has(localDate(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (done.has(localDate(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
