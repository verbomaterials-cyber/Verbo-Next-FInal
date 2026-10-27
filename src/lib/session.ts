import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

// Deduplicate layout/page checks only within a render. Every new request still
// checks the current password and active flag; revocation is never TTL-cached.
export const getAppSession = cache(() => getServerSession(authOptions));
