import { z } from "zod";

const usernamePattern = /^[\p{L}\p{N}_]+$/u;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  username: z
    .string()
    .min(2)
    .max(24)
    .regex(usernamePattern, "Username must be 2-24 chars: letters (including Chinese), numbers, underscore.")
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});
