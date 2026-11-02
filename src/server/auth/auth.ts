import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/server/db";

export function resolveAuthSecret(
  env: {
    BETTER_AUTH_SECRET?: string;
    NODE_ENV?: string;
    NEXT_PHASE?: string;
  } = process.env
): string {
  const secret = env.BETTER_AUTH_SECRET;
  const isProduction = env.NODE_ENV === "production";
  const isBuildPhase = env.NEXT_PHASE === "phase-production-build";

  if (!secret) {
    if (isProduction && !isBuildPhase) {
      throw new Error(
        "FATAL: BETTER_AUTH_SECRET environment variable is strictly required in production runtime."
      );
    }
    return "default-secret-for-development-min-32-chars";
  }

  if (isProduction && secret === "default-secret-for-development-min-32-chars") {
    throw new Error(
      "FATAL: BETTER_AUTH_SECRET must not use the default development secret in production."
    );
  }

  return secret;
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: resolveAuthSecret(),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "RECEPTIONIST",
        input: false,
      },
      isActive: {
        type: "boolean",
        defaultValue: true,
        input: false,
      },
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/api/auth/sign-in": {
        window: 60,
        max: 10,
      },
    },
  },
});
