import { describe, expect, it, vi } from 'vitest';
import { handleGetTree } from '../src/tools/get-tree.js';
import { handleSearchTags } from '../src/tools/tags.js';
import { handlePageHistory, handlePageVersion, handleRestorePageVersion } from '../src/tools/history.js';
import { handlePatchPage } from '../src/tools/patch-page.js';
import type { WikiJsClient } from '../src/services/client.js';

function client(overrides: Partial<WikiJsClient> = {}): WikiJsClient {
  return {
    getPageTree: vi.fn().mockResolvedValue([{ id: 1, path: 'docs', depth: 0, title: 'Docs', isFolder: true, isPrivate: false, parent: null, pageId: null, locale: 'en' }]),
    searchTags: vi.fn().mockResolvedValue(['docker', 'docker-compose']),
    getPageHistory: vi.fn().mockResolvedValue({ total: 1, trail: [{ versionId: 7, versionDate: '2026-08-23', authorId: 1, authorName: 'Test', actionType: 'update' }] }),
    getPageVersion: vi.fn().mockResolvedValue({ pageId: 42, versionId: 7, title: 'Test', content: 'old', tags: [], action: 'update' }),
    restorePageVersion: vi.fn().mockResolvedValue({ succeeded: true, errorCode: 0, message: 'restored' }),
    getPageById: vi.fn().mockResolvedValue({ id: 42, path: 'test/page', title: 'Test', description: 'Desc', content: 'before\nneedle\nafter', isPublished: true, locale: 'en', tags: ['docs'] }),
    updatePage: vi.fn().mockResolvedValue({ succeeded: true, errorCode: 0, message: 'ok' }),
    ...overrides,
  } as unknown as WikiJsClient;
}

describe('navigation and history tools', () => {
  it('returns a page tree', async () => {
    const wiki = client();
    const result = await handleGetTree(wiki, { locale: 'en', mode: 'ALL', includeAncestors: false });
    expect(result.isError).toBeFalsy();
    expect(wiki.getPageTree).toHaveBeenCalledWith(null, null, 'ALL', 'en', false);
  });

  it('searches tags and reads revisions', async () => {
    const wiki = client();
    expect((await handleSearchTags(wiki, { query: 'docker' })).isError).toBeFalsy();
    expect((await handlePageHistory(wiki, { id: 42, offsetPage: 0, offsetSize: 20 })).isError).toBeFalsy();
    expect((await handlePageVersion(wiki, { pageId: 42, versionId: 7 })).isError).toBeFalsy();
    expect((await handleRestorePageVersion(wiki, { pageId: 42, versionId: 7, confirm: true })).isError).toBeFalsy();
    expect(wiki.restorePageVersion).not.toHaveBeenCalled();
  });
});

describe('wikijs_patch_page', () => {
  it('replaces exactly one occurrence and preserves page metadata', async () => {
    const wiki = client();
    const result = await handlePatchPage(wiki, { id: 42, locale: 'en', expectedOldText: 'needle', replacement: 'updated', dryRun: false });
    expect(result.isError).toBeFalsy();
    expect(wiki.updatePage).toHaveBeenCalledWith(expect.objectContaining({ id: 42, content: 'before\nupdated\nafter', title: 'Test', tags: ['docs'] }));
  });

  it('does not mutate when the expected text is absent or ambiguous', async () => {
    const wiki = client({ getPageById: vi.fn().mockResolvedValue({ id: 42, title: 'Test', description: 'Desc', content: 'needle and needle', isPublished: true, locale: 'en', tags: [] }) });
    const ambiguous = await handlePatchPage(wiki, { id: 42, locale: 'en', expectedOldText: 'needle', replacement: 'updated', dryRun: false });
    expect(ambiguous.isError).toBe(true);
    expect(wiki.updatePage).not.toHaveBeenCalled();

    const absent = await handlePatchPage(client(), { id: 42, locale: 'en', expectedOldText: 'missing', replacement: 'updated', dryRun: false });
    expect(absent.isError).toBe(true);
  });

  it('previews without mutating by default', async () => {
    const wiki = client();
    const result = await handlePatchPage(wiki, { id: 42, locale: 'en', expectedOldText: 'needle', replacement: 'updated' });
    expect(result.isError).toBeFalsy();
    expect(wiki.updatePage).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain('proposedContent');
  });
});
