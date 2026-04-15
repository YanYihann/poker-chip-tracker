import { z } from "zod";

const usernamePattern = /^[\p{L}\p{N}_]+$/u;
const avatarDataUrlPattern = /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/;

export const updateProfileSchema = z
  .object({
    username: z
      .string()
      .min(2)
      .max(24)
      .regex(usernamePattern, "Username must be 2-24 chars: letters (including Chinese), numbers, underscore.")
      .optional(),
    avatarUrl: z
      .string()
      .max(2_000_000)
      .regex(avatarDataUrlPattern, "Avatar must be an image data URL.")
      .nullable()
      .optional()
  })
  .refine((value) => value.username !== undefined || value.avatarUrl !== undefined, {
    message: "At least one profile field must be provided."
  });

export const sessionIdParamSchema = z.object({
  sessionId: z.string().uuid()
});
