// Keeps every visitor on the latest deployed version of the site.
//
// * A tab opened before a deployment still references the previous build's files; when one of
//   them is gone (lazy page chunk), the page reloads once to pick up the new build.
// * A tab left open (home-screen app, long session) checks for a new deployment when it comes
//   back to the foreground and every few minutes, and offers to update (no forced reload, so
//   nothing being typed is lost).

const RELOAD_KEY = 'app_chunk_reload_at';

const currentEntry = () =>
  document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.getAttribute('src') ?? null;

export function installChunkReload() {
  window.addEventListener('vite:preloadError', (event) => {
    let last = 0;
    try { last = Number(sessionStorage.getItem(RELOAD_KEY) || 0); } catch { /* storage blocked */ }
    if (Date.now() - last < 30_000) return; // already reloaded just now: let the error show
    event.preventDefault();
    try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* storage blocked */ }
    window.location.reload();
  });
}

export async function isNewVersionAvailable(): Promise<boolean> {
  const mine = currentEntry();
  if (!mine || !import.meta.env.PROD) return false;
  try {
    const res = await fetch(`/?v=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'text/html' } });
    if (!res.ok) return false;
    const html = await res.text();
    const latest = html.match(/<script[^>]+type="module"[^>]+src="([^"]*\/assets\/[^"]+)"/)?.[1]
      ?? html.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/)?.[1];
    return !!latest && latest !== mine;
  } catch {
    return false;
  }
}
