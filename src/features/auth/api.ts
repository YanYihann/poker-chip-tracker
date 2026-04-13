import { getApiUrl, toNetworkError } from "@/lib/api-base-url";

type ApiError = {
  message?: string;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
};

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
};

export type ProfilePayload = {
  username: string;
  avatarUrl: string | null;
  totals: {
    sessions: number;
    hands: number;
    profit: string;
    loss: string;
  };
};

export type RecentSession = {
  sessionId: string;
  roomCode: string;
  startedAtIso: string;
  endedAtIso: string;
  totalHands: number;
  handsPlayed: number;
  startStack: string;
  endStack: string;
  profitLoss: string;
};

export type SessionDetail = {
  session: {
    id: string;
    roomCode: string;
    startedAtIso: string;
    endedAtIso: string;
    totalHands: number;
  };
  me: {
    userId: string;
    startStack: string;
    endStack: string;
    profitLoss: string;
    handsPlayed: number;
  };
  players: Array<{
    userId: string;
    username: string;
    startStack: string;
    endStack: string;
    profitLoss: string;
    handsPlayed: number;
  }>;
  hands: Array<{
    handNumber: number;
    potTotal: string;
    results: Array<{
      userId: string;
      username: string;
      amountWon: string;
      netChange: string;
    }>;
  }>;
};

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(getApiUrl(path), {
      method: options.method ?? "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch (error) {
    throw toNetworkError(error);
  }

  const payload = (await response.json().catch(() => null)) as ApiError | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "Request failed.");
  }

  return payload as T;
}

export async function registerAccount(input: {
  email: string;
  password: string;
  username: string;
}): Promise<AuthUser> {
  const result = await apiRequest<{ user: AuthUser }>("/api/auth/register", {
    method: "POST",
    body: input
  });

  return result.user;
}

export async function loginAccount(input: { email: string; password: string }): Promise<AuthUser> {
  const result = await apiRequest<{ user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: input
  });

  return result.user;
}

export async function logoutAccount(): Promise<void> {
  await apiRequest<{ ok: true }>("/api/auth/logout", {
    method: "POST"
  });
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const result = await apiRequest<{ user: AuthUser }>("/api/auth/me");
  return result.user;
}

export async function fetchProfile(): Promise<ProfilePayload> {
  const result = await apiRequest<{ profile: ProfilePayload }>("/api/profile");
  return result.profile;
}

export async function updateProfile(input: {
  username?: string;
  avatarUrl?: string | null;
}): Promise<{ username: string; avatarUrl: string | null }> {
  const result = await apiRequest<{ profile: { username: string; avatarUrl: string | null } }>(
    "/api/profile",
    {
      method: "PATCH",
      body: input
    }
  );
  return result.profile;
}

export async function fetchRecentSessions(): Promise<RecentSession[]> {
  const result = await apiRequest<{ sessions: RecentSession[] }>("/api/profile/sessions");
  return result.sessions;
}

export async function fetchSessionDetail(sessionId: string): Promise<SessionDetail> {
  const result = await apiRequest<{ session: SessionDetail }>(`/api/profile/sessions/${sessionId}`);
  return result.session;
}
