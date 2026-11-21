import { checkToken, makeToken } from "../shared/auth";
if (!checkToken(makeToken("u1"))) throw new Error("token roundtrip failed");
