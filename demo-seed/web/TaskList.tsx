import type { Task } from "../shared/types";

export function TaskList(tasks: Task[]): string {
  return tasks.map((t) => `<li>${t.title}</li>`).join("");
}
