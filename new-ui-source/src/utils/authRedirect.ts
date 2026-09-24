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

export async function redirectToLogin(): Promise<void> {
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
