const SHORT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});

const LONG = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

export function formatDateShort(iso: string): string {
  return SHORT.format(new Date(iso));
}

export function formatDateLong(iso: string): string {
  return LONG.format(new Date(iso));
}

export function isoDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}
