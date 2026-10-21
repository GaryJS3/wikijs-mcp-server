import { describe, expect, it, vi } from 'vitest';
import { WikiJsClient } from '../src/services/client.js';
import { handleGetTree } from '../src/tools/get-tree.js';
import type { PageTreeItem } from '../src/types.js';

const tree: PageTreeItem[] = [
  { id: 1, path: 'docs', depth: 1, title: 'Docs', isPrivate: false, isFolder: true, pageId: null, locale: 'en' },
  { id: 2, path: 'projects', depth: 1, title: 'Projects', isPrivate: false, isFolder: true, pageId: 42, locale: 'en' },
  { id: 3, path: 'home', depth: 1, title: 'Home', isPrivate: false, isFolder: false, pageId: 1, locale: 'en' },
];

function mockWikiTree(nodes: PageTreeItem[] | null = tree) {
  const client = new WikiJsClient('https://wiki.example.com/graphql', 'token');
  const query = vi.spyOn(client, 'query').mockResolvedValue({ pages: { tree: nodes } });
  return { client, query };
}

describe('Wiki.js PAGES tree compatibility', () => {
  it('uses ALL mode and filters by non-null pageId (including folder nodes with pages)', async () => {
    const { client, query } = mockWikiTree();
    const result = await handleGetTree(client, { mode: 'PAGES', locale: 'en', includeAncestors: false });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      success: true,
      mode: 'PAGES',
      count: 2,
      tree: [tree[1], tree[2]],
    });
    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(expect.any(String), {
      path: null,
      parent: null,
      mode: 'ALL',
      locale: 'en',
      includeAncestors: false,
    });
  });

  it('preserves path, parent, locale, and includeAncestors when emulating PAGES', async () => {
    const { client, query } = mockWikiTree();

    await client.getPageTree('projects', 12, 'PAGES', 'de', true);

    expect(query).toHaveBeenCalledWith(expect.any(String), {
      path: 'projects',
      parent: 12,
      mode: 'ALL',
      locale: 'de',
      includeAncestors: true,
    });
  });

  it.each(['ALL', 'FOLDERS'] as const)('passes through %s mode and its results unchanged', async (mode) => {
    const { client, query } = mockWikiTree();

    expect(await client.getPageTree(null, null, mode, 'en', false)).toEqual(tree);
    expect(query).toHaveBeenCalledWith(expect.any(String), {
      path: null,
      parent: null,
      mode,
      locale: 'en',
      includeAncestors: false,
    });
  });

  it('returns an empty list when Wiki.js returns a null tree', async () => {
    const { client } = mockWikiTree(null);

    expect(await client.getPageTree(null, null, 'PAGES')).toEqual([]);
  });
});
