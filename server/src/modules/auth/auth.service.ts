import bcrypt from "bcryptjs";

import { prisma } from "../../lib/prisma.js";

const PASSWORD_ROUNDS = 12;

function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sanitizeUsername(username: string): string {
  return username.trim();
}

export async function registerUser(input: {
  email: string;
  password: string;
  username: string;
}): Promise<{ id: string; email: string; username: string; avatarUrl: string | null }> {
  const email = sanitizeEmail(input.email);
  const username = sanitizeUsername(input.username);
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (existing) {
    throw new Error("EMAIL_EXISTS");
  }

  const existingProfile = await prisma.profile.findUnique({
    where: { username },
    select: { userId: true }
  });

  if (existingProfile) {
    throw new Error("USERNAME_EXISTS");
  }

  const passwordHash = await bcrypt.hash(input.password, PASSWORD_ROUNDS);
  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      profile: {
        create: {
          username
        }
      }
    },
    select: {
      id: true,
      email: true,
      profile: {
        select: {
          username: true,
          avatarUrl: true
        }
      }
    }
  });

  return {
    id: created.id,
    email: created.email,
    username: created.profile?.username ?? username,
    avatarUrl: created.profile?.avatarUrl ?? null
  };
}

export async function verifyUserLogin(input: {
  email: string;
  password: string;
}): Promise<{ id: string; email: string; username: string; avatarUrl: string | null }> {
  const email = sanitizeEmail(input.email);
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      profile: {
        select: {
          username: true,
          avatarUrl: true
        }
      }
    }
  });

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const ok = await bcrypt.compare(input.password, user.passwordHash);

  if (!ok) {
    throw new Error("INVALID_CREDENTIALS");
  }

  return {
    id: user.id,
    email: user.email,
    username: user.profile?.username ?? "",
    avatarUrl: user.profile?.avatarUrl ?? null
  };
}

export async function getAuthenticatedUser(userId: string): Promise<{
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
} | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      profile: {
        select: {
          username: true,
          avatarUrl: true
        }
      }
    }
  });

  if (!user || !user.profile) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    username: user.profile.username,
    avatarUrl: user.profile.avatarUrl
  };
}
