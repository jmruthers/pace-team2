export function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (iso == null || iso.trim() === '') {
    return '';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function datetimeLocalToIso(local: string): string | null {
  const trimmed = local.trim();
  if (trimmed === '') {
    return null;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toISOString();
}

export function parseMaxSubmissionsInput(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') {
    return null;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return Math.floor(n);
}
