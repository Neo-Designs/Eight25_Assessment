import { apiFetch, apiPost } from './api';

interface TokenResponse {
  access_token: string;
  token_type: string;
}

interface UserData {
  id: number;
  email: string;
}

export async function authenticateAndFetchUser(
  endpoint: '/api/auth/login' | '/api/auth/register',
  credentials: { email: string; password: string },
): Promise<{ access_token: string; user: UserData }> {
  const { access_token } = await apiPost<TokenResponse>(endpoint, credentials);

  const user = await apiFetch<UserData>('/api/auth/me', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  return { access_token, user };
}
