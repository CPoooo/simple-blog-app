import { z } from "zod";

// bcrypt silently ignores input past 72 bytes, so reject it rather than truncate.
const password = z
  .string({ error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .refine((p) => new TextEncoder().encode(p).length <= 72, "Password is too long");

const email = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email"));

export const registerSchema = z.object({
  username: z
    .string({ error: "Username is required" })
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-z0-9_]+$/, "Use only letters, numbers, and underscores"),
  email,
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string({ error: "Password is required" }).min(1, "Password is required").max(200),
});

export type AuthFormState =
  | {
      errors?: Partial<Record<"username" | "email" | "password", string[]>>;
      message?: string;
      // Echoed back so the form keeps what the user typed (never the password).
      values?: { username?: string; email?: string };
    }
  | undefined;
