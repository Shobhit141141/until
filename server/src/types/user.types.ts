export type UpdateUserProfile = {
  username?: string;
  pfpUrl?: string;
};

export type UserDoc = {
  walletAddress: string;
  username?: string | null;
  pfp?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserResponse = {
  walletAddress: string;
  username: string | null;
  pfpUrl: string | null;
  createdAt: string;
  updatedAt: string;
};
