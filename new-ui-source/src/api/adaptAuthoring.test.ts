import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('./client', () => ({ apiClient: { get: mockGet } }));

const schema = {
  text: {
    properties: { body: { type: 'string', default: 'Body' } },
    _extensions: { properties: { _test: { type: 'object' } } },
  },
  course: {
    _globals: { properties: { title: { type: 'string', default: 'Global title' } } },
  },
  article: {
    themeSettings: { properties: { _life: { name: 'life', properties: {} } } },
    menuSettings: { properties: { _menu: { name: 'menu', properties: {} } } },
  },
};

beforeEach(() => {
  vi.resetModules();
  mockGet.mockReset();
});

describe('merged schema requests', () => {
  it('shares an in-flight request across consumers and retains the successful cache', async () => {
    let resolveSchema!: (value: typeof schema) => void;
    mockGet.mockReturnValue(new Promise<typeof schema>((resolve) => { resolveSchema = resolve; }));
    const api = await import('./adaptAuthoring');

    const results = Promise.all([
      api.getMergedContentSchema('text'),
      api.getExtensionSchemasByLevel(),
      api.getThemeSettingsSchemaByLevel(),
      api.getMenuSettingsSchemaByLevel(),
      api.getComponentExtensionSchema('text'),
      api.getGlobalsDefaults(),
    ]);

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/api/content/schema');
    resolveSchema(schema);
    const [text, extensions, themes, menus, componentExtensions, globals] = await results;

    expect(text).toEqual(schema.text);
    expect(extensions.article).toEqual({});
    expect(themes.article).toEqual(schema.article.themeSettings.properties);
    expect(menus.article).toEqual(schema.article.menuSettings.properties);
    expect(componentExtensions).toEqual(schema.text._extensions.properties);
    expect(globals).toEqual({ title: 'Global title' });
    expect(await api.getMergedContentSchema('text')).toEqual(schema.text);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('preserves consumer failure handling and retries after a failed shared request', async () => {
    mockGet.mockRejectedValueOnce(new Error('Schema unavailable')).mockResolvedValue(schema);
    const api = await import('./adaptAuthoring');

    const results = await Promise.allSettled([
      api.getMergedContentSchema('text'),
      api.getThemeSettingsSchemaByLevel(),
      api.getExtensionSchemasByLevel(),
    ]);

    expect(results[0]).toEqual({ status: 'fulfilled', value: null });
    expect(results[1].status).toBe('rejected');
    expect(results[2].status).toBe('rejected');
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(await api.getMergedContentSchema('text')).toEqual(schema.text);
    expect(await api.getThemeSettingsSchemaByLevel()).toMatchObject({ article: schema.article.themeSettings.properties });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});