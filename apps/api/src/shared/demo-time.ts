// Waktu relatif (UTC) untuk contoh Swagger dan skrip demo; sama dengan cara data seed dibuat.
export function utcAt(dayOffset: number, hour: number, minute = 0, from: Date = new Date()): string {
  const d = new Date(from.getTime());
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}
