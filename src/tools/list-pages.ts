/**
 * wikijs_list_pages Tool
 *
 * Lists all pages in Wiki.js with optional filtering and pagination
 */

import { z } from 'zod';
import type { WikiJsClient } from '../services/client.js';
import { listPagesSchema, type ListPagesInput } from '../schemas/index.js';
import { handleToolError, successResponse } from '../services/error-handler.js';
import { DEFAULT_PAGE_LIMIT } from '../constants.js';

export const listPagesToolDefinition = {
  name: 'wikijs_list_pages',
  description: `List all pages in Wiki.js with optional filtering and pagination.

This tool returns a paginated list of all pages. Use the offset parameter to navigate through large result sets.

Args:
  - locale (string, optional): Filter by locale (e.g., "en", "de")
  - limit (number): Max pages to return, default 50, max 200
  - offset (number): Skip N pages for pagination, default 0

Returns:
  - pages: Array of page summaries (id, path, title, description, locale, tags, updatedAt)
  - pagination: { limit, offset, total_count, has_more, next_offset }

Use pagination.has_more and pagination.next_offset to fetch more results.

Examples:
  - List all: (no params, returns first 50)
  - Filter by locale: locale="de"
  - Paginate: offset=50, limit=50 (get pages 51-100)`,
  inputSchema: listPagesSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

export async function handleListPages(
  client: WikiJsClient,
  args: z.infer<typeof listPagesSchema>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    // Validate input with Zod
    const validated: ListPagesInput = listPagesSchema.parse(args);

    const limit = validated.limit ?? DEFAULT_PAGE_LIMIT;
    const offset = validated.offset ?? 0;

    const { pages, total } = await client.listPages(validated.locale ?? null, limit, offset);

    const pageList = pages.map((p) => ({
      id: p.id,
      path: p.path,
      title: p.title,
      description: p.description,
      locale: p.locale,
      isPublished: p.isPublished,
      tags: p.tags || [],
      updatedAt: p.updatedAt,
    }));

    const hasMore = offset + pageList.length < total;

    return successResponse({
      pages: pageList,
      pagination: {
        limit,
        offset,
        total_count: total,
        has_more: hasMore,
        ...(hasMore ? { next_offset: offset + pageList.length } : {}),
      },
    });
  } catch (error) {
    return handleToolError(error, 'wikijs_list_pages');
  }
}
