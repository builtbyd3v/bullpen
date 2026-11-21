import { checkToken } from "../shared/auth";
import type { Task } from "../shared/types";

const tasks: Task[] = [];

export function listTasks(token: string): Task[] {
  if (!checkToken(token)) throw new Error("unauthorized");
  return tasks;
}
