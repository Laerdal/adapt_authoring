import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// node test environment (see vitest.config.ts) has no DOM, so fetch/alert/
// window are stubbed per test rather than relying on jsdom.
describe('redirectToLogin', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('collapses multiple concurrent callers into a single redirect', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ emailAuthBypassEnabled: false }),
    });
    const assign = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', { location: { assign } });

    const { redirectToLogin } = await import('./authRedirect');

    // Several call sites can all decide "not authenticated" around the same
    // time (see client.ts / AuthContext.tsx) - this is what that looks like.
    await Promise.all([redirectToLogin(), redirectToLogin(), redirectToLogin()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/classic');
  });

  it('does not alert on a later call that loses the race', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('window', { location: { assign: vi.fn() } });
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);

    const { redirectToLogin } = await import('./authRedirect');

    await redirectToLogin('Your session has expired. Please log in again.');
    await redirectToLogin('Your session has expired. Please log in again.');

    expect(alertMock).toHaveBeenCalledTimes(1);
  });
});
