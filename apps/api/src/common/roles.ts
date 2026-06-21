import { ForbiddenException } from "@nestjs/common";
import type { AuthUser } from "./auth-context.js";

/** Guard helper for admin-only operations (TDD §12.1). */
export function assertAdmin(user: AuthUser): void {
  if (user.role !== "admin") {
    throw new ForbiddenException("Admin role required");
  }
}
