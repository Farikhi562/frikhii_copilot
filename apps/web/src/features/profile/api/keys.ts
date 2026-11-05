export const profileKeys = {
  detail: (userId: string) => ["profile", userId] as const,
  preferences: (userId: string) => ["preferences", userId] as const,
};
