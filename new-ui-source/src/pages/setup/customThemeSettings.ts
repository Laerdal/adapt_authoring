const LINKED_PROPERTIES: Record<string, string[]> = {
  '_global::_primaryBrandColor': ['_progress::progress', '_global::link', '_nav::nav'],
  '_progress::progress': ['_nav::nav-progress', '_menu::menu-item-progress'],
};

export function updateCustomThemeSetting(settings: Record<string, string>, key: string, value: string, defaultValue = '') {
  const next = { ...settings, [key]: value || defaultValue };
  const visited = new Set<string>();
  const queue = [key];
  while (queue.length) {
    const source = queue.shift();
    if (!source || visited.has(source)) continue;
    visited.add(source);
    for (const linked of LINKED_PROPERTIES[source] ?? []) {
      next[linked] = next[source];
      queue.push(linked);
    }
  }
  return next;
}
