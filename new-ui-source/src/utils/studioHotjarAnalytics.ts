interface StudioHotjarConfig {
  enabled?: boolean;
  tagId?: string;
  requireConsent?: boolean;
}

type AnalyticsWindow = Window & {
  _uxa?: unknown[][];
  CS_CONF?: { implementations?: { triggers?: { name?: string }[] }[] };
};

let configPromise: Promise<StudioHotjarConfig | null> | undefined;
let lastTrackedPath: string | undefined;
let automaticPageviews: boolean | undefined;
const SCRIPT_ID = 'adapt-studio-contentsquare';
const SETTINGS_VIEWS = new Set([
  'overview', 'structure', 'theme', 'menu', 'navigation', 'completion', 'learner-experience',
  'tracking', 'accessibility', 'technical-settings', 'cdn-deployment', 'translation',
  'storyboarding', 'publish', 'export-pdf',
]);
let viewTimer: ReturnType<typeof createStudioViewTimer> | undefined;

export function createStudioViewTimer(now: () => number, send: (name: string, seconds?: number) => void) {
  let currentView: string | undefined;
  let active = false;
  let startedAt = now();
  let elapsed = 0;
  function accumulate() {
    const timestamp = now();
    if (active && currentView) elapsed += Math.max(0, timestamp - startedAt);
    startedAt = timestamp;
  }
  function flush() {
    accumulate();
    if (currentView) send(currentView, Math.round(elapsed / 1000));
    currentView = undefined;
    elapsed = 0;
  }
  return {
    navigate(view: string) {
      if (view === currentView) return;
      flush();
      currentView = view;
      startedAt = now();
      send(view);
    },
    setActive(value: boolean) {
      accumulate();
      active = value;
    },
    flush,
  };
}

export function trackStudioView(): void {
  if (!viewTimer) return;
  const path = getStudioAnalyticsPath(window.location.pathname);
  if (!path) return;
  const panel = document.querySelector('[data-studio-settings-view]')?.getAttribute('data-studio-settings-view');
  const view = path.endsWith('/setup') && panel && SETTINGS_VIEWS.has(panel)
    ? 'settings_' + panel.replace(/-/g, '_')
    : path.replace(/^\//, '').replace(/\//g, '_') || 'dashboard';
  viewTimer.navigate(view);
}

const CONTROL_ACTIONS: Record<string, string> = {
  'My Courses': 'dashboard_open', 'Shared with Me': 'shared_open', 'Asset Management': 'assets_open',
  'Template Management': 'templates_open', 'User Management': 'users_open', 'Plugin Management': 'plugins_open',
  'Create New Course': 'course_create_open', 'Create': 'create_confirm', 'Next': 'flow_next',
  'Import Course': 'course_import_open', 'Import': 'import_confirm', 'Duplicate Course': 'course_duplicate_click',
  'Copy ID to Clipboard': 'course_id_copy', 'Edit course details': 'course_details_open',
  'Delete course': 'course_delete_open', 'Delete': 'delete_confirm', 'Copy': 'structure_copy_click',
  'Paste': 'structure_paste_click', "Yes, I'm sure": 'delete_confirm', 'Save': 'save_click', 'Save Changes': 'save_click',
  'Save changes': 'save_click', 'Discard': 'discard_click', 'Cancel': 'cancel_click',
  'Course Settings': 'settings_open', 'Editor': 'editor_open', 'Storyboard': 'storyboard_open',
  'Preview': 'preview_open', 'Quick Edit': 'quick_edit_toggle', 'Publish': 'publish_click',
  'Export': 'export_open', 'Export Source': 'export_source_click', 'Export PDF': 'export_pdf_click',
  'Recently Modified': 'sort_recent', 'Alphabetical A\u2013Z': 'sort_ascending', 'Alphabetical Z\u2013A': 'sort_descending',
  'Search by tag': 'filter_tags_open', 'Grid view': 'view_grid', 'List view': 'view_list',
  'Image': 'filter_image', 'Audio': 'filter_audio', 'Video': 'filter_video', 'Other': 'filter_other',
  'Upload Asset': 'asset_upload_open',
  'Switch to desktop preview': 'emulator_desktop', 'Switch to tablet preview': 'emulator_tablet',
  'Switch to mobile preview': 'emulator_mobile', 'Open fullscreen preview': 'emulator_fullscreen',
  'Profile menu': 'profile_toggle', 'Switch to Classic': 'classic_exit', 'Log Out': 'logout_click',
};

function installStudioInteractionTracking() {
  if (viewTimer) return;
  const sendCommand = (command: unknown[]) => {
    try {
      (window as AnalyticsWindow)._uxa?.push(command);
    } catch {
      return;
    }
  };
  viewTimer = createStudioViewTimer(() => performance.now(), (view, seconds) => {
    sendCommand(['trackPageEvent', 'studio_view_' + view + (seconds === undefined ? '_entered' : '_left')]);
    if (seconds !== undefined) sendCommand(['trackDynamicVariable', { key: 'studio_foreground_seconds_' + view, value: seconds }]);
  });
  const updateActivity = () => viewTimer?.setActive(document.visibilityState === 'visible' && document.hasFocus());
  document.addEventListener('visibilitychange', updateActivity);
  window.addEventListener('focus', updateActivity);
  window.addEventListener('blur', updateActivity);
  window.addEventListener('pagehide', () => viewTimer?.flush());
  window.addEventListener('pageshow', () => { updateActivity(); trackStudioView(); });
  document.addEventListener('click', event => {
    const element = (event.target as Element | null)?.closest?.('button, a, [role="button"]');
    if (!element || !getStudioAnalyticsPath(window.location.pathname)) return;
    const visibleLabel = (element as HTMLElement).innerText || element.textContent || '';
    const candidates = [element.getAttribute('aria-label'), element.getAttribute('title'), visibleLabel.replace(/\s+/g, ' ').trim()];
    const action = candidates.map(label => label ? CONTROL_ACTIONS[label] : undefined).find(Boolean) || 'control_click';
    sendCommand(['trackPageEvent', 'studio_' + action]);
  }, true);
  document.addEventListener('change', event => {
    const element = event.target as Element | null;
    if (!element?.matches('input, textarea, select') || !getStudioAnalyticsPath(window.location.pathname)) return;
    sendCommand(['trackPageEvent', element.getAttribute('placeholder') === 'Search by name'
      ? 'studio_filter_search_changed' : 'studio_field_changed']);
  }, true);
  updateActivity();
  trackStudioView();
}

export type StudioWorkflow = 'course_create' | 'course_duplicate' | 'course_delete' | 'course_details_save' |
  'course_import' | 'course_import_check' | 'theme_apply' | 'menu_apply' | 'structure_create' | 'structure_save' |
  'structure_delete' | 'structure_copy' | 'structure_paste' | 'course_config_save' |
  'asset_save' | 'asset_delete' | 'user_save' | 'user_delete' | 'plugin_save' |
  'publish' | 'export' | 'export_pdf_handoff' | 'quick_edit' | 'emulator' | 'filter' | 'view_mode';

export function getStudioApiOperation(endpoint: string, method: string): StudioWorkflow | null {
  const path = endpoint.split('?')[0];
  const verb = method.toUpperCase();
  if (verb === 'GET' && /^\/api\/duplicatecourse\/[^/]+\/?$/.test(path)) return 'course_duplicate';
  if (verb === 'POST') {
    if (path === '/api/courses') return 'course_create';
    if (path === '/api/user') return 'user_save';
    if (/^\/api\/duplicatecourse\/[^/]+\/?$/.test(path)) return 'course_duplicate';
    if (path === '/api/content/clipboard/copy') return 'structure_copy';
    if (path === '/api/content/clipboard/paste') return 'structure_paste';
    if (/^\/api\/theme\/[^/]+\/makeitso\/[^/]+$/.test(path)) return 'theme_apply';
    if (/^\/api\/menu\/[^/]+\/makeitso\/[^/]+$/.test(path)) return 'menu_apply';
    if (/^\/api\/content\/(contentobject|article|block|component)$/.test(path)) return 'structure_create';
  }
  if (verb === 'DELETE') {
    if (/^\/api\/content\/course\/[^/]+$/.test(path)) return 'course_delete';
    if (/^\/api\/content\/(contentobject|article|block|component)\/[^/]+$/.test(path)) return 'structure_delete';
    if (/^\/api\/asset\/[^/]+$/.test(path)) return 'asset_delete';
    if (/^\/api\/user\/[^/]+$/.test(path)) return 'user_delete';
  }
  if (verb === 'PUT' || verb === 'PATCH') {
    if (/^\/api\/asset\/(trash|restore)\/[^/]+$/.test(path)) return 'asset_save';
    if (/^\/api\/content\/course\/[^/]+$/.test(path)) return 'course_details_save';
    if (/^\/api\/content\/config\/[^/]+$/.test(path)) return 'course_config_save';
    if (/^\/api\/content\/(contentobject|article|block|component)\/[^/]+$/.test(path)) return 'structure_save';
    if (/^\/api\/asset\/[^/]+$/.test(path)) return 'asset_save';
    if (/^\/api\/user\/[^/]+$/.test(path)) return 'user_save';
    if (/^\/api\/(componenttype|extensiontype|themetype|menutype)\/[^/]+$/.test(path)) return 'plugin_save';
  }
  return null;
}

export function trackStudioWorkflow(workflow: StudioWorkflow, phase: 'started' | 'succeeded' | 'failed' | 'opened' | 'cancelled'): void {
  try {
    if (window.self !== window.top || !getStudioAnalyticsPath(window.location.pathname) ||
      !document.getElementById(SCRIPT_ID)) return;
    (window as AnalyticsWindow)._uxa?.push(['trackPageEvent', 'studio_' + workflow + '_' + phase]);
  } catch {
    return;
  }
}

export function getStudioAnalyticsPath(pathname: string): string | null {
  const path = pathname.replace(/\/$/, '') || '/';
  if (['/', '/dashboard', '/shared', '/users', '/plugins', '/assets', '/templates'].includes(path)) {
    return path;
  }
  if (path === '/course/new' || path === '/course/new/setup') return path;
  const courseRoute = path.match(/^\/course\/[^/]+(\/(?:setup|storyboard|preview))?$/);
  return courseRoute ? '/course/course' + (courseRoute[1] || '/editor') : null;
}

async function getConfig(): Promise<StudioHotjarConfig | null> {
  if (!configPromise) {
    configPromise = fetch('/config/studio-hotjar-analytics.json', {
      credentials: 'same-origin',
      cache: 'no-store',
    }).then(async (response) => response.ok ? await response.json() : null)
      .catch(() => null);
  }
  const config = await configPromise;
  if (!config) configPromise = undefined;
  return config;
}

export async function trackStudioPage(isCurrent: () => boolean): Promise<void> {
  try {
    if (window.self !== window.top || !isCurrent()) return;
    const config = await getConfig();
    const path = getStudioAnalyticsPath(window.location.pathname);
    if (!isCurrent() || !path || config?.enabled !== true || config.requireConsent !== false ||
      typeof config.tagId !== 'string' || !/^[a-f0-9]{13}$/.test(config.tagId)) return;
    if (lastTrackedPath === path) return;

    const analyticsWindow = window as AnalyticsWindow;
    analyticsWindow._uxa = analyticsWindow._uxa || [];
    const queue = analyticsWindow._uxa;
    queue.push(['setCustomVariable', 1, 'studio_instance', window.location.hostname, 2]);
    queue.push(['setQuery', '']);
    queue.push(['hidePageTitle']);
    queue.push(['referrer:removeQueryString']);
    queue.push(['referrer:maskUrl', window.location.origin + '/course/:course_id']);

    if (!document.getElementById(SCRIPT_ID)) {
      queue.push(['setPIISelectors', {
        PIISelectors: ['input, textarea, select, [contenteditable], .ck-content, [data-cs-mask]'],
      }]);
      queue.push(['setPath', path, { lifespan: 'onNextPageviewOnly' }]);
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = 'https://t.contentsquare.net/uxa/' + config.tagId + '.js';
      script.onload = () => {
        automaticPageviews = analyticsWindow.CS_CONF?.implementations?.some(implementation =>
          implementation.triggers?.some(trigger => trigger.name === 'HistoryChange')) === true;
      };
      script.onerror = () => {
        script.remove();
        lastTrackedPath = undefined;
        automaticPageviews = undefined;
        console.warn('Studio analytics could not load. Studio remains available.');
      };
      document.head.appendChild(script);
    } else if (automaticPageviews === undefined) {
      queue.push(['setPath', path, { lifespan: 'onNextPageviewOnly' }]);
    } else if (!automaticPageviews) {
      queue.push(['trackPageview', path]);
    }
    lastTrackedPath = path;
    installStudioInteractionTracking();
    trackStudioView();
  } catch {
    console.warn('Studio analytics is unavailable. Studio remains available.');
  }
}