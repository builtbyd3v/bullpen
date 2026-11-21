import { checkToken } from "../shared/auth";
import type { User } from "../shared/types";

const users: User[] = [{ id: "u1", name: "Ada" }];

export function listUsers(token: string): User[] {
  if (!checkToken(token)) throw new Error("unauthorized");
  return users;
}
