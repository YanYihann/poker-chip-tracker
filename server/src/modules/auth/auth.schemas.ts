import { z } from "zod";

const usernamePattern = /^[a-zA-Z0-9_]{2,24}$/;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  username: z
    .string()
    .min(2)
    .max(24)
    .regex(usernamePattern, "Username must be 2-24 chars: letters, numbers, underscore.")
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});
