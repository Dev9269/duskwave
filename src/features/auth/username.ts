import { z } from 'zod';

export const usernameSchema = z
  .string()
  .regex(/^[a-z0-9_]{3,20}$/, 'Use 3-20 lowercase letters, numbers, or underscores.');

export function validateUsername(value: string): string | null {
  const result = usernameSchema.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? 'Invalid username.');
}

export function suggestUsername(input: string): string {
  const raw = input.includes('@') ? input.split('@')[0] : input;
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);

  return cleaned.length >= 3 ? cleaned : 'listener';
}
