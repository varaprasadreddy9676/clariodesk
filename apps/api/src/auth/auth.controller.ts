import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { z } from "zod";
import { loginSchema } from "@clariodesk/schemas";
import { ZodValidationPipe } from "../common/zod.pipe.js";
import { AuthService, type AuthResult } from "./auth.service.js";

const registerSchema = z.object({
  workspaceName: z.string().min(1).max(200),
  workspaceSlug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "lowercase letters, digits and hyphens only"),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(200),
});

@UseGuards(ThrottlerGuard)
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(
    @Body(new ZodValidationPipe(registerSchema))
    body: z.infer<typeof registerSchema>,
  ): Promise<AuthResult> {
    return this.auth.registerWorkspace(body);
  }

  @Post("login")
  login(
    @Body(new ZodValidationPipe(loginSchema))
    body: {
      email: string;
      password: string;
    },
  ): Promise<AuthResult> {
    return this.auth.login(body.email, body.password);
  }
}
