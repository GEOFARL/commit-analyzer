export interface SupabaseAuthIdentity {
  id: string;
  email: string | null;
  githubId: string | null;
  username: string | null;
  avatarUrl: string | null;
}
