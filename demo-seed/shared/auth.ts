// Shared auth helpers. Both api/ and web/ import this file.
export type Session = { userId: string; token: string };

export function makeToken(userId: string): string {
  return `demo-${userId}`;
}

export function checkToken(token: string): boolean {
  return token.startsWith("demo-");
}
