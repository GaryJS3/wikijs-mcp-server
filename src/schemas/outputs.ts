/**
 * Output schemas for Wiki.js MCP tools.
 *
 * Tool results retain their human-readable JSON text representation, but also
 * expose these shapes through MCP structuredContent for clients that support
 * outputSchema.
 */

import { z } from 'zod';

const apiResponseResultSchema = z.object({
  succeeded: z.boolean(),
  errorCode: z.number(),
  message: z.string(),
  slug: z.string().nullable().optional(),
}).passthrough();

const pageSummarySchema = z.object({
  id: z.number(),
  path: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  locale: z.string(),
  isPublished: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  updatedAt: z.string().nullable().optional(),
}).passthrough();

const pageSchema = pageSummarySchema.extend({
  content: z.string().nullable().optional(),
  contentType: z.string().nullable().optional(),
  editor: z.string().nullable().optional(),
  scriptCss: z.string().nullable().optional(),
  scriptJs: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
}).passthrough();

const pageTreeItemSchema = z.object({
  id: z.number(),
  path: z.string(),
  depth: z.number(),
  title: z.string(),
  isPrivate: z.boolean(),
  isFolder: z.boolean(),
  privateNS: z.string().nullable().optional(),
  parent: z.number().nullable().optional(),
  pageId: z.number().nullable().optional(),
  locale: z.string(),
}).passthrough();

const pageTagSchema = z.object({
  id: z.number(),
  tag: z.string(),
  title: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
}).passthrough();

const pageHistoryEntrySchema = z.object({
  versionId: z.number(),
  versionDate: z.string(),
  authorId: z.number(),
  authorName: z.string(),
  actionType: z.string(),
  valueBefore: z.string().nullable().optional(),
  valueAfter: z.string().nullable().optional(),
}).passthrough();

const pageVersionSchema = z.object({
  action: z.string().nullable().optional(),
  authorId: z.union([z.string(), z.number()]).nullable().optional(),
  authorName: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  contentType: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  versionDate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  editor: z.string().nullable().optional(),
  isPrivate: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  locale: z.string().nullable().optional(),
  pageId: z.number().optional(),
  path: z.string().nullable().optional(),
  publishEndDate: z.string().nullable().optional(),
  publishStartDate: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  title: z.string().nullable().optional(),
  versionId: z.number().optional(),
}).passthrough();

const successSchema = z.object({ success: z.literal(true) });

export const createPageOutputSchema = successSchema.extend({
  message: z.string(),
  page: z.object({ id: z.number(), path: z.string(), title: z.string() }),
});

export const getPageOutputSchema = successSchema.extend({ page: pageSchema });

export const listPagesOutputSchema = successSchema.extend({
    pages: z.array(pageSummarySchema),
    pagination: z.object({
      limit: z.number(),
      offset: z.number(),
      total_count: z.number(),
      has_more: z.boolean(),
      next_offset: z.number().optional(),
    }),
});

export const searchPagesOutputSchema = successSchema.extend({
    totalHits: z.number(),
    suggestions: z.array(z.string()),
    results: z.array(z.object({
      id: z.number(),
      title: z.string(),
      path: z.string(),
      description: z.string(),
      locale: z.string(),
    })),
});

export const updatePageOutputSchema = successSchema.extend({ message: z.string(), result: apiResponseResultSchema });

export const deletePageOutputSchema = successSchema.extend({ message: z.string(), result: apiResponseResultSchema });

export const movePageOutputSchema = successSchema.extend({
    message: z.string(),
    from: z.string(),
    to: z.string(),
    destinationLocale: z.string(),
    result: apiResponseResultSchema,
});

export const getTreeOutputSchema = successSchema.extend({
    tree: z.array(pageTreeItemSchema),
    count: z.number(),
    locale: z.string(),
    mode: z.enum(['FOLDERS', 'PAGES', 'ALL']),
});

export const listTagsOutputSchema = successSchema.extend({ tags: z.array(pageTagSchema), count: z.number() });

export const searchTagsOutputSchema = successSchema.extend({ query: z.string(), tags: z.array(z.string()), count: z.number() });

export const pageHistoryOutputSchema = successSchema.extend({
    id: z.number(),
    trail: z.array(pageHistoryEntrySchema),
    total: z.number(),
});

export const pageVersionOutputSchema = successSchema.extend({ version: pageVersionSchema });

export const restorePageVersionOutputSchema = successSchema.extend({
    pageId: z.number(),
    versionId: z.number(),
    dryRun: z.boolean(),
    applied: z.boolean(),
    version: pageVersionSchema.optional(),
    result: apiResponseResultSchema.optional(),
});

export const patchPageOutputSchema = successSchema.extend({
    pageId: z.number(),
    dryRun: z.boolean(),
    applied: z.boolean(),
    replacedCharacters: z.number(),
    originalContent: z.string().optional(),
    proposedContent: z.string().optional(),
    result: apiResponseResultSchema.optional(),
});

const assetSchema = z.object({ id:z.number(), filename:z.string(), mimeType:z.string().optional(), fileSize:z.number().optional(), folderPath:z.string().optional(), relativeUrl:z.string().optional(), absoluteUrl:z.string().optional(), markdown:z.string().optional(), html:z.string().optional() }).passthrough();
export const uploadAssetOutputSchema = assetSchema;
export const listAssetsOutputSchema = z.object({assets:z.array(z.object({id:z.number(),filename:z.string()}).passthrough()),total:z.number(),folderPath:z.string(),pagination:z.object({limit:z.number(),offset:z.number(),total_count:z.number(),has_more:z.boolean()})}).passthrough();
export const listAssetFoldersOutputSchema = z.object({folders:z.array(z.object({id:z.number(),slug:z.string(),path:z.string()}).passthrough()),count:z.number()});
export const createAssetFolderOutputSchema = z.object({id:z.number(),path:z.string()});
export const renameAssetOutputSchema = z.object({id:z.number(),filename:z.string()}).passthrough();
export const deleteAssetOutputSchema = z.object({id:z.number(),deleted:z.boolean()});
export const getPageCssOutputSchema = successSchema.extend({
  pageId: z.number(),
  css: z.string(),
});
export const updatePageCssOutputSchema = successSchema.extend({
  pageId: z.number(),
  dryRun: z.boolean(),
  applied: z.boolean(),
  previousCss: z.string(),
  proposedCss: z.string(),
  result: apiResponseResultSchema.optional(),
});
const insertAssetSuccessOutputSchema = successSchema.extend({
  pageId: z.number(),
  assetId: z.number().optional(),
  assetUrl: z.string(),
  insertedMarkup: z.string(),
  position: z.enum(['append', 'prepend', 'before', 'after', 'replace']),
  applied: z.boolean(),
  dryRun: z.boolean().optional(),
  preview: z.string().optional(),
  provisionalUrl: z.boolean().optional(),
  duplicate: z.boolean().optional(),
  verified: z.boolean().optional(),
});
const insertAssetErrorOutputSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  tool: z.string().optional(),
  pageId: z.number().optional(),
  assetId: z.number().optional(),
  assetUrl: z.string().optional(),
  insertedMarkup: z.string().optional(),
  position: z.enum(['append', 'prepend', 'before', 'after', 'replace']).optional(),
  applied: z.boolean().optional(),
  partialFailure: z.boolean().optional(),
  uploadedAssetId: z.number().optional(),
  retryWithAssetId: z.number().optional(),
});
export const insertAssetOutputSchema = z.union([insertAssetSuccessOutputSchema, insertAssetErrorOutputSchema]);
