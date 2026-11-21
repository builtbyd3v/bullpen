import { makeToken } from "../shared/auth";

export function LoginPage(): string {
  const token = makeToken("u1");
  return `<form data-token="${token}">Log in</form>`;
}
