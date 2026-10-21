import { describe, expect, it, vi } from 'vitest';
import { WikiJsClient } from '../src/services/client.js';
import { handleGetPageCss, handleUpdatePageCss } from '../src/tools/page-css.js';

const page = {
  id: 7, path: 'equipment/server', title: 'Server', description: 'Specs',
  content: '# Server', tags: ['hardware'], locale: 'en', isPublished: true,
  editor: 'markdown', scriptCss: '.card { color: blue }',
  scriptJs: 'window.existing = true;', publishStartDate: '', publishEndDate: '',
};

const result = { succeeded: true, errorCode: 0, message: 'updated' };
function fakeClient(current = { ...page }) {
  return {
    getPageById: vi.fn(async () => current),
    getPageByPath: vi.fn(async () => current),
    updatePage: vi.fn(async (params: { scriptCss?: string }) => {
      if (params.scriptCss !== undefined) current.scriptCss = params.scriptCss;
      return result;
    }),
  } as unknown as WikiJsClient;
}
describe('page-scoped CSS tools', () => {
  it('reads existing page CSS by path', async () => {
    const client = fakeClient();
    const response = await handleGetPageCss(client, { path: 'equipment/server', locale: 'en' });
    expect(response.isError).toBeFalsy();
    expect(JSON.parse(response.content[0].text).css).toBe(page.scriptCss);
  });
  it('previews CSS without updating', async () => {
    const client = fakeClient();
    const response = await handleUpdatePageCss(client, { id: 7, locale: 'en', css: '.new {}', dryRun: true });
    expect(response.isError).toBeFalsy();
    expect(client.updatePage).not.toHaveBeenCalled();
  });
  it('rejects stale expected CSS', async () => {
    const client = fakeClient();
    const response = await handleUpdatePageCss(client, { id: 7, locale: 'en', css: '.new {}', expectedCss: '.stale {}', dryRun: false });
    expect(response.isError).toBe(true);
    expect(client.updatePage).not.toHaveBeenCalled();
  });
  it('updates CSS without supplying replacement content', async () => {
    const client = fakeClient();
    const response = await handleUpdatePageCss(client, { id: 7, locale: 'en', css: '.new {}', dryRun: false });
    expect(response.isError).toBeFalsy();
    expect(client.updatePage).toHaveBeenCalledWith(expect.objectContaining({ id: 7, scriptCss: '.new {}', expectedScriptCss: page.scriptCss }));
  });
  it('refuses to modify CSS when it cannot read the current stylesheet', async () => {
    const client = fakeClient({ ...page, scriptCss: undefined as unknown as string });
    const response = await handleUpdatePageCss(client, { id: 7, locale: 'en', css: '.new {}', dryRun: false });
    expect(response.isError).toBe(true);
    expect(client.updatePage).not.toHaveBeenCalled();
  });
});

describe('WikiJsClient preserves style and script', () => {
  it('includes the existing full content, CSS and JS in a metadata edit', async () => {
    const client = new WikiJsClient('https://wiki.example/graphql', 'test-token');
    vi.spyOn(client, 'getPageById').mockResolvedValue({ ...page, content: '# Full page' });
    const query = vi.spyOn(client, 'query').mockResolvedValue({ pages: { update: { responseResult: result } } });
    await client.updatePage({ id: 7, title: 'New title' });
    expect(query).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      content: '# Full page', title: 'New title',
      scriptCss: page.scriptCss, scriptJs: page.scriptJs,
    }));
  });
  it('rejects stale CSS before writing', async () => {
    const client = new WikiJsClient('https://wiki.example/graphql', 'test-token');
    vi.spyOn(client, 'getPageById').mockResolvedValue({ ...page });
    const query = vi.spyOn(client, 'query');
    await expect(client.updatePage({ id: 7, scriptCss: '.changed', expectedScriptCss: '.stale' })).rejects.toThrow('CSS changed');
    expect(query).not.toHaveBeenCalled();
  });
  it('rejects stale content before writing', async () => {
    const client = new WikiJsClient('https://wiki.example/graphql', 'test-token');
    vi.spyOn(client, 'getPageById').mockResolvedValue({ ...page, content: '# Newer content' });
    const query = vi.spyOn(client, 'query');
    await expect(client.updatePage({ id: 7, content: '# Replacement', expectedContent: '# Older content' })).rejects.toThrow('content changed');
    expect(query).not.toHaveBeenCalled();
  });
  it('rejects a stale page timestamp before writing', async () => {
    const client = new WikiJsClient('https://wiki.example/graphql', 'test-token');
    vi.spyOn(client, 'getPageById').mockResolvedValue({ ...page, updatedAt: '2026-10-20T10:01:00.000Z' });
    const query = vi.spyOn(client, 'query');
    await expect(client.updatePage({ id: 7, title: 'New title', expectedUpdatedAt: '2026-10-20T10:00:00.000Z' })).rejects.toThrow('Page changed');
    expect(query).not.toHaveBeenCalled();
  });
  it('fails closed when page source is unavailable', async () => {
    const client = new WikiJsClient('https://wiki.example/graphql', 'test-token');
    vi.spyOn(client, 'getPageById').mockResolvedValue({ ...page, content: undefined });
    await expect(client.updatePage({ id: 7, title: 'No' })).rejects.toThrow('unavailable');
  });
  it('fails closed when CSS or JavaScript cannot be read', async () => {
    const client = new WikiJsClient('https://wiki.example/graphql', 'test-token');
    vi.spyOn(client, 'getPageById').mockResolvedValue({ ...page, scriptCss: null });
    const query = vi.spyOn(client, 'query');
    await expect(client.updatePage({ id: 7, title: 'No' })).rejects.toThrow('CSS or JavaScript is unavailable');
    expect(query).not.toHaveBeenCalled();
  });
});
