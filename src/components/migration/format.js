export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

export function formatRunTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const PHASE_LABELS = {
  preflight: 'Inspect source & target',
  schema: 'Create tables & buckets',
  users: 'Migrate accounts',
  data: 'Copy records',
  media: 'Copy media files',
  reconcile: 'Reconcile',
};
