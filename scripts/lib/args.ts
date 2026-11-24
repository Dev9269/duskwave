export function parsePositiveInt(raw: string | undefined, flag: string): number {
  const value = raw?.trim() ?? '';
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${flag} expects a positive integer.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${flag} expects a positive integer.`);
  }

  return parsed;
}
