/**
 * Wiki.js GraphQL API Client
 *
 * Provides methods to interact with the Wiki.js GraphQL API
 */

import { API_TIMEOUT, CHARACTER_LIMIT } from '../constants.js';
import type {
  WikiPage,
  WikiPageListItem,
  SearchResponse,
  CreatePageParams,
  UpdatePageParams,
  ApiResponseResult,
  PageTag,
  PageTreeItem,
  PageHistoryResult,
  PageVersion,
} from '../types.js';

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export class WikiJsClient {
  private apiUrl: string;
  private apiToken: string;

  private normalizePageTags(page: (Omit<WikiPage, 'tags'> & { tags?: Array<string | { tag: string }> }) | null): WikiPage | null {
    if (!page) return null;
    return {
      ...page,
      tags: page.tags?.map((tag) => typeof tag === 'string' ? tag : tag.tag) ?? [],
    };
  }

  constructor(apiUrl: string, apiToken: string) {
    this.apiUrl = apiUrl;
    this.apiToken = apiToken;
  }

  /**
   * Execute a GraphQL query
   */
  async query<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = (await response.json()) as GraphQLResponse<T>;

      if (result.errors) {
        // Log full error for debugging, return only messages to client
        console.error('GraphQL API errors:', JSON.stringify(result.errors));
        const messages = result.errors.map((e) => e.message).join('; ');
        throw new Error(`GraphQL request failed: ${messages}`);
      }

      if (!result.data) {
        throw new Error('No data returned from GraphQL API');
      }

      return result.data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      throw new Error(`Wiki.js API request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List all pages with optional filtering
   */
  async listPages(locale: string | null = null, limit: number = 100, offset: number = 0): Promise<{ pages: WikiPageListItem[]; total: number }> {
    const query = `
      query {
        pages {
          list {
            id
            path
            title
            description
            isPublished
            locale
            contentType
            createdAt
            updatedAt
            tags
          }
        }
      }
    `;

    const data = await this.query<{ pages: { list: WikiPageListItem[] } }>(query);
    let pages = data.pages.list;
    const total = pages.length;

    // Filter by locale if provided
    if (locale) {
      pages = pages.filter((p) => p.locale === locale);
    }

    // Apply pagination
    const paginatedPages = pages.slice(offset, offset + limit);

    return { pages: paginatedPages, total };
  }

  /**
   * Get a single page by ID
   */
  async getPageById(id: number, truncate = true): Promise<WikiPage | null> {
    const query = `
      query($id: Int!) {
        pages {
          single(id: $id) {
            id
            path
            title
            description
            content
            contentType
            isPublished
            locale
            createdAt
            updatedAt
            tags { tag }
          }
        }
      }
    `;

    const data = await this.query<{ pages: { single: (Omit<WikiPage, 'tags'> & { tags?: Array<{ tag: string }> }) | null } }>(query, { id });
    const page = this.normalizePageTags(data.pages.single);

    // Truncate content if needed
    if (truncate && page?.content && page.content.length > CHARACTER_LIMIT) {
      page.content =
        page.content.substring(0, CHARACTER_LIMIT) +
        `\n\n[Content truncated. Original length: ${page.content.length} chars. Use path-based access for full content.]`;
    }

    return page;
  }

  /**
   * Get a single page by path
   */
  async getPageByPath(path: string, locale: string = 'en', truncate = true): Promise<WikiPage | null> {
    const query = `
      query($path: String!, $locale: String!) {
        pages {
          singleByPath(path: $path, locale: $locale) {
            id
            path
            title
            description
            content
            contentType
            isPublished
            locale
            createdAt
            updatedAt
            tags { tag }
          }
        }
      }
    `;

    const data = await this.query<{ pages: { singleByPath: (Omit<WikiPage, 'tags'> & { tags?: Array<{ tag: string }> }) | null } }>(query, { path, locale });
    const page = this.normalizePageTags(data.pages.singleByPath);

    // Truncate content if needed
    if (truncate && page?.content && page.content.length > CHARACTER_LIMIT) {
      page.content =
        page.content.substring(0, CHARACTER_LIMIT) +
        `\n\n[Content truncated. Original length: ${page.content.length} chars]`;
    }

    return page;
  }

  /**
   * Search pages
   */
  async searchPages(searchQuery: string, locale: string | null = null): Promise<SearchResponse> {
    const query = `
      query($query: String!) {
        pages {
          search(query: $query) {
            results {
              id
              title
              path
              description
              locale
            }
            suggestions
            totalHits
          }
        }
      }
    `;

    const data = await this.query<{ pages: { search: SearchResponse } }>(query, { query: searchQuery });
    const results = data.pages.search;

    // Filter by locale if provided
    if (locale && results.results) {
      results.results = results.results.filter((r) => r.locale === locale);
      results.totalHits = results.results.length;
    }

    return results;
  }

  /** Get the navigable page tree. */
  async getPageTree(
    path: string | null = null,
    parent: number | null = null,
    mode: 'FOLDERS' | 'PAGES' | 'ALL' = 'ALL',
    locale = 'en',
    includeAncestors = false,
  ): Promise<PageTreeItem[]> {
    const query = `
      query($path: String, $parent: Int, $mode: PageTreeMode!, $locale: String!, $includeAncestors: Boolean) {
        pages {
          tree(path: $path, parent: $parent, mode: $mode, locale: $locale, includeAncestors: $includeAncestors) {
            id
            path
            depth
            title
            isPrivate
            isFolder
            privateNS
            parent
            pageId
            locale
          }
        }
      }
    `;
    const data = await this.query<{ pages: { tree: PageTreeItem[] | null } }>(query, {
      path,
      parent,
      mode,
      locale,
      includeAncestors,
    });
    return data.pages.tree ?? [];
  }

  /** List tags defined by pages. */
  async listTags(): Promise<PageTag[]> {
    const data = await this.query<{ pages: { tags: PageTag[] } }>(`
      query {
        pages {
          tags { id tag title createdAt updatedAt }
        }
      }
    `);
    return data.pages.tags;
  }

  /** Search page tags. */
  async searchTags(searchQuery: string): Promise<string[]> {
    const data = await this.query<{ pages: { searchTags: string[] } }>(`
      query($query: String!) {
        pages { searchTags(query: $query) }
      }
    `, { query: searchQuery });
    return data.pages.searchTags;
  }

  /** List the revision trail for a page. */
  async getPageHistory(id: number, offsetPage = 0, offsetSize = 20): Promise<PageHistoryResult> {
    const data = await this.query<{ pages: { history: PageHistoryResult | null } }>(`
      query($id: Int!, $offsetPage: Int, $offsetSize: Int) {
        pages {
          history(id: $id, offsetPage: $offsetPage, offsetSize: $offsetSize) {
            trail { versionId versionDate authorId authorName actionType valueBefore valueAfter }
            total
          }
        }
      }
    `, { id, offsetPage, offsetSize });
    if (!data.pages.history) throw new Error(`Page history not found for ID: ${id}`);
    return { trail: data.pages.history.trail ?? [], total: data.pages.history.total };
  }

  /** Retrieve one immutable page revision. */
  async getPageVersion(pageId: number, versionId: number): Promise<PageVersion | null> {
    const data = await this.query<{ pages: { version: PageVersion | null } }>(`
      query($pageId: Int!, $versionId: Int!) {
        pages {
          version(pageId: $pageId, versionId: $versionId) {
            action authorId authorName content contentType createdAt versionDate description editor
            isPrivate isPublished locale pageId path publishEndDate publishStartDate tags title versionId
          }
        }
      }
    `, { pageId, versionId });
    return data.pages.version;
  }

  /** Restore one page revision. Callers must perform their own confirmation. */
  async restorePageVersion(pageId: number, versionId: number): Promise<ApiResponseResult> {
    const data = await this.query<{ pages: { restore: { responseResult: ApiResponseResult } } }>(`
      mutation($pageId: Int!, $versionId: Int!) {
        pages {
          restore(pageId: $pageId, versionId: $versionId) {
            responseResult { succeeded errorCode message }
          }
        }
      }
    `, { pageId, versionId });
    const result = data.pages.restore.responseResult;
    if (!result.succeeded) throw new Error(`Failed to restore page version: ${result.message}`);
    return result;
  }

  /**
   * Create a new page
   */
  async createPage(params: CreatePageParams): Promise<WikiPage> {
    const query = `
      mutation(
        $content: String!
        $description: String!
        $editor: String!
        $isPublished: Boolean!
        $isPrivate: Boolean!
        $locale: String!
        $path: String!
        $tags: [String]!
        $title: String!
      ) {
        pages {
          create(
            content: $content
            description: $description
            editor: $editor
            isPublished: $isPublished
            isPrivate: $isPrivate
            locale: $locale
            path: $path
            tags: $tags
            title: $title
          ) {
            responseResult {
              succeeded
              errorCode
              slug
              message
            }
            page {
              id
              path
              title
            }
          }
        }
      }
    `;

    const data = await this.query<{
      pages: {
        create: {
          responseResult: ApiResponseResult;
          page: WikiPage;
        };
      };
    }>(query, params as unknown as Record<string, unknown>);

    if (!data.pages.create.responseResult.succeeded) {
      throw new Error(`Failed to create page: ${data.pages.create.responseResult.message}`);
    }

    return data.pages.create.page;
  }

  /**
   * Update an existing page
   *
   * Uses a static parameterized mutation with all optional fields.
   * Wiki.js ignores null values for optional parameters.
   */
  async updatePage(params: UpdatePageParams): Promise<ApiResponseResult> {
    const query = `
      mutation(
        $id: Int!
        $content: String
        $title: String
        $description: String
        $isPublished: Boolean
        $tags: [String]
      ) {
        pages {
          update(
            id: $id
            content: $content
            title: $title
            description: $description
            isPublished: $isPublished
            tags: $tags
          ) {
            responseResult {
              succeeded
              errorCode
              message
            }
          }
        }
      }
    `;

    const variables: Record<string, unknown> = {
      id: params.id,
      content: params.content ?? null,
      title: params.title ?? null,
      description: params.description ?? null,
      isPublished: params.isPublished ?? null,
      tags: params.tags ?? null,
    };

    const data = await this.query<{
      pages: {
        update: {
          responseResult: ApiResponseResult;
        };
      };
    }>(query, variables);

    if (!data.pages.update.responseResult.succeeded) {
      throw new Error(`Failed to update page: ${data.pages.update.responseResult.message}`);
    }

    return data.pages.update.responseResult;
  }

  /**
   * Delete a page
   */
  async deletePage(id: number): Promise<ApiResponseResult> {
    const query = `
      mutation($id: Int!) {
        pages {
          delete(id: $id) {
            responseResult {
              succeeded
              errorCode
              message
            }
          }
        }
      }
    `;

    const data = await this.query<{
      pages: {
        delete: {
          responseResult: ApiResponseResult;
        };
      };
    }>(query, { id });

    if (!data.pages.delete.responseResult.succeeded) {
      throw new Error(`Failed to delete page: ${data.pages.delete.responseResult.message}`);
    }

    return data.pages.delete.responseResult;
  }

  /**
   * Move a page to a new path
   */
  async movePage(id: number, destinationPath: string, destinationLocale: string = 'en'): Promise<ApiResponseResult> {
    const query = `
      mutation($id: Int!, $destinationPath: String!, $destinationLocale: String!) {
        pages {
          move(
            id: $id
            destinationPath: $destinationPath
            destinationLocale: $destinationLocale
          ) {
            responseResult {
              succeeded
              errorCode
              message
            }
          }
        }
      }
    `;

    const data = await this.query<{
      pages: {
        move: {
          responseResult: ApiResponseResult;
        };
      };
    }>(query, { id, destinationPath, destinationLocale });

    if (!data.pages.move.responseResult.succeeded) {
      throw new Error(`Failed to move page: ${data.pages.move.responseResult.message}`);
    }

    return data.pages.move.responseResult;
  }

  /**
   * Get all pages (for fetching tags when updating)
   */
  async getAllPages(): Promise<WikiPageListItem[]> {
    const { pages } = await this.listPages(null, 10000, 0);
    return pages;
  }
}
