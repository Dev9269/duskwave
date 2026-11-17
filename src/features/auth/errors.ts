export function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) {
    return 'That email and password combination did not work.';
  }
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'An account with this email already exists. Try signing in.';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Could not reach the server. Check your connection.';
  }
  return message;
}
