// Where to send a user who isn't logged in - mirrors the classic UI's own
// shouldUseExternalAuth()/redirectToExternalAuth() (frontend/src/modules/
// user/index.js): if SSO is configured, go there; otherwise fall back to the
// classic UI's own login form at /classic. New UI has no login page of its
// own (see AuthContext.tsx), so this is the only way back in either way.
//
// Deliberately a plain fetch, not apiClient - /config/config.json is public
// (in permissions.js's ignoreRoutes) and never 401/403s, so there's no risk
// of this itself triggering another redirect and looping.
interface PublicConfig {
  emailAuthBypassEnabled?: boolean;
  externalAuthUrl?: string;
}

// Several independent call sites can all decide "not authenticated" around
// the same time on a single page load (the initial auth check plus whatever
// else was fetching data in parallel) - each would otherwise run its own
// fetch("/config/config.json") + window.location.assign, and the resulting
// flurry of navigations gets throttled by Chrome ("Throttling navigation to
// prevent the browser from hanging"), leaving the page looking stuck instead
// of redirecting. This guard collapses all of that into a single redirect.
let redirecting = false;

export async function redirectToLogin(alertMessage?: string): Promise<void> {
  if (redirecting) return;
  redirecting = true;

  if (alertMessage) {
    alert(alertMessage);
  }

  let target = "/classic";
  try {
    const res = await fetch("/config/config.json", { credentials: "same-origin" });
    if (res.ok) {
      const cfg: PublicConfig = await res.json();
      const externalUrl = cfg.externalAuthUrl?.trim();
      if (cfg.emailAuthBypassEnabled === true && externalUrl) {
        target = externalUrl;
      }
    }
  } catch {
    // Config fetch failed - fall back to /classic rather than leaving the
    // user stuck with no way back in.
  }
  window.location.assign(target);
}
