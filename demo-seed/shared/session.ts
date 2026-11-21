import type { Session } from "./auth";

export function isExpired(_s: Session, ageSeconds: number): boolean {
  return ageSeconds > 3600;
}
