import { makeToken } from "../shared/auth";

export function login(userId: string): string {
  return makeToken(userId);
}
