export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0';
  if (value < 1000) return String(Math.floor(value));
  if (value < 1_000_000) {
    const thousands = value / 1000;
    return `${thousands >= 100 ? Math.floor(thousands) : thousands.toFixed(1).replace(/\.0$/, '')}K`;
  }
  const millions = value / 1_000_000;
  return `${millions >= 100 ? Math.floor(millions) : millions.toFixed(1).replace(/\.0$/, '')}M`;
}

export function formatMinutes(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return '0 min';
  if (totalMinutes < 60) return `${Math.floor(totalMinutes)} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}
