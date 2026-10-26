import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.');
}

// Dashboard admins have no Supabase login: their server session token (see adminSession.ts)
// is sent with every request so the database policies can check their sections.
// The token is only ever sent to this project's own database API (/rest/v1): Storage and Auth
// do not use it, and an extra header there can make the browser reject the request (CORS),
// which broke candidate photo uploads for members on a device where an admin had signed in.
const ADMIN_TOKEN_KEY = 'admin_session_token';
const requestUrl = (input: RequestInfo | URL) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
const withAdminToken: typeof fetch = (input, init) => {
  if (!requestUrl(input).includes('/rest/v1/')) return fetch(input, init);
  let token: string | null = null;
  try { token = localStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem('mahaja_students_token'); } catch { token = null; }
  if (!token) return fetch(input, init);
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  headers.set('x-admin-token', token);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseKey ?? '',
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    global: { fetch: withAdminToken },
  }
);
