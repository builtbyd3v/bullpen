import { checkToken } from "../shared/auth";
import type { Session } from "../shared/auth";

export function isLoggedIn(s: Session | null): boolean {
  return s !== null && checkToken(s.token);
}
