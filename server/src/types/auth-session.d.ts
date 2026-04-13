declare global {
  namespace Express {
    interface Request {
      authSession: {
        userId: string;
        tokenId: string;
        tokenHash: string;
      } | null;
    }
  }
}

export {};
