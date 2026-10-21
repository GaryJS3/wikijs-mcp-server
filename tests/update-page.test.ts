/**
 * Tests for wikijs_update_page Tool
 *
 * Tests the auto-fetch content behavior when only metadata is updated.
 * See: Ticket 897857 - Auto-fetch content bei Metadaten-Updates
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleUpdatePage } from '../src/tools/update-page.js';
import type { WikiJsClient } from '../src/services/client.js';

// Mock client factory
function createMockClient(overrides: Partial<WikiJsClient> = {}): WikiJsClient {
  return {
    getPageById: vi.fn().mockResolvedValue({
      id: 42,
      path: 'test/page',
      title: 'Test Page',
      content: '# Existing Content\n\nThis is the existing content.',
      locale: 'en',
      isPublished: false,
      tags: ['existing-tag'],
    }),
    getPageByPath: vi.fn().mockResolvedValue({
      id: 42,
      path: 'test/page',
      title: 'Test Page',
      content: '# Existing Content\n\nThis is the existing content.',
      locale: 'en',
      isPublished: false,
      tags: ['existing-tag'],
    }),
    getAllPages: vi.fn().mockResolvedValue([
      { id: 42, path: 'test/page', title: 'Test Page', tags: ['existing-tag'] },
    ]),
    updatePage: vi.fn().mockResolvedValue({
      succeeded: true,
      errorCode: 0,
      message: 'Page updated successfully',
    }),
    ...overrides,
  } as unknown as WikiJsClient;
}

describe('handleUpdatePage', () => {
  let mockClient: WikiJsClient;

  beforeEach(() => {
    mockClient = createMockClient();
    vi.clearAllMocks();
  });

  describe('Auto-fetch content on metadata-only updates', () => {
    it('should auto-fetch content when only isPublished is changed', async () => {
      const result = await handleUpdatePage(mockClient, {
        id: 42,
        isPublished: true,
      });

      expect(result.isError).toBeFalsy();

      // Verify getPageById was called to fetch existing content
      expect(mockClient.getPageById).toHaveBeenCalledWith(42, false);

      // Verify updatePage was called with the fetched content
      expect(mockClient.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 42,
          content: '# Existing Content\n\nThis is the existing content.',
          isPublished: true,
        })
      );
    });

    it('should auto-fetch content when only title is changed', async () => {
      const result = await handleUpdatePage(mockClient, {
        id: 42,
        title: 'New Title',
      });

      expect(result.isError).toBeFalsy();

      // Verify getPageById was called
      expect(mockClient.getPageById).toHaveBeenCalledWith(42, false);

      // Verify updatePage was called with fetched content
      expect(mockClient.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 42,
          content: '# Existing Content\n\nThis is the existing content.',
          title: 'New Title',
        })
      );
    });

    it('should auto-fetch content when only description is changed', async () => {
      const result = await handleUpdatePage(mockClient, {
        id: 42,
        description: 'New description',
      });

      expect(result.isError).toBeFalsy();

      expect(mockClient.getPageById).toHaveBeenCalledWith(42, false);

      expect(mockClient.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 42,
          content: '# Existing Content\n\nThis is the existing content.',
          description: 'New description',
        })
      );
    });

    it('should NOT fetch content when content is explicitly provided', async () => {
      const result = await handleUpdatePage(mockClient, {
        id: 42,
        content: '# New Content',
        isPublished: true,
      });

      expect(result.isError).toBeFalsy();

      // getPageById should NOT be called for content fetch
      // (it may be called for ID resolution, but not for content)
      expect(mockClient.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 42,
          content: '# New Content',
          isPublished: true,
        })
      );
    });
  });

  describe('Path-based page resolution with content auto-fetch', () => {
    it('should resolve page by path and auto-fetch content', async () => {
      const result = await handleUpdatePage(mockClient, {
        path: 'test/page',
        locale: 'en',
        isPublished: true,
      });

      expect(result.isError).toBeFalsy();

      // Verify path resolution
      expect(mockClient.getPageByPath).toHaveBeenCalledWith('test/page', 'en', false);

      // Verify updatePage was called with fetched content
      expect(mockClient.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 42,
          content: '# Existing Content\n\nThis is the existing content.',
          isPublished: true,
        })
      );
    });
  });

  describe('Tags preservation (existing behavior)', () => {
    it('should preserve existing tags when not provided', async () => {
      const result = await handleUpdatePage(mockClient, {
        id: 42,
        content: '# Updated Content',
      });

      expect(result.isError).toBeFalsy();

      // getAllPages is called for tag preservation
      expect(mockClient.getAllPages).toHaveBeenCalled();

      expect(mockClient.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['existing-tag'],
        })
      );
    });

    it('should use provided tags when explicitly set', async () => {
      const result = await handleUpdatePage(mockClient, {
        id: 42,
        content: '# Updated Content',
        tags: ['new-tag'],
      });

      expect(result.isError).toBeFalsy();

      // getAllPages should NOT be called when tags are provided
      expect(mockClient.getAllPages).not.toHaveBeenCalled();

      expect(mockClient.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['new-tag'],
        })
      );
    });
  });

  describe('Auto-fetch title and description on partial updates', () => {
    it('should auto-fetch title when only content is updated', async () => {
      const result = await handleUpdatePage(mockClient, {
        id: 42,
        content: '# New Content',
      });

      expect(result.isError).toBeFalsy();

      // title should be fetched from existing page, not sent as null
      expect(mockClient.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 42,
          content: '# New Content',
          title: 'Test Page',
        })
      );
    });

    it('should auto-fetch description when only content is updated', async () => {
      // Ensure mock returns description
      mockClient = createMockClient({
        getPageById: vi.fn().mockResolvedValue({
          id: 42,
          path: 'test/page',
          title: 'Test Page',
          description: 'Existing description',
          content: '# Existing Content',
          locale: 'en',
          isPublished: false,
          tags: ['existing-tag'],
        }),
      });

      const result = await handleUpdatePage(mockClient, {
        id: 42,
        content: '# New Content',
      });

      expect(result.isError).toBeFalsy();

      // description should be fetched from existing page, not sent as null
      expect(mockClient.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 42,
          content: '# New Content',
          description: 'Existing description',
        })
      );
    });

    it('should NOT override title when explicitly provided', async () => {
      const result = await handleUpdatePage(mockClient, {
        id: 42,
        title: 'Custom Title',
        content: '# New Content',
      });

      expect(result.isError).toBeFalsy();

      expect(mockClient.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Custom Title',
        })
      );
    });

    it('should NOT override description when explicitly provided', async () => {
      const result = await handleUpdatePage(mockClient, {
        id: 42,
        description: 'Custom desc',
        content: '# New Content',
      });

      expect(result.isError).toBeFalsy();

      expect(mockClient.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Custom desc',
        })
      );
    });

    it('should auto-fetch both title and description via path resolution', async () => {
      mockClient = createMockClient({
        getPageByPath: vi.fn().mockResolvedValue({
          id: 42,
          path: 'test/page',
          title: 'Path Page Title',
          description: 'Path page description',
          content: '# Path Content',
          locale: 'en',
          isPublished: true,
          tags: ['tag1'],
        }),
      });

      const result = await handleUpdatePage(mockClient, {
        path: 'test/page',
        locale: 'en',
        isPublished: false,
      });

      expect(result.isError).toBeFalsy();

      expect(mockClient.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 42,
          title: 'Path Page Title',
          description: 'Path page description',
          content: '# Path Content',
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should return error when page not found by ID', async () => {
      mockClient = createMockClient({
        getPageById: vi.fn().mockResolvedValue(null),
      });

      const result = await handleUpdatePage(mockClient, {
        id: 999,
        isPublished: true,
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });

    it('should return error when page not found by path', async () => {
      mockClient = createMockClient({
        getPageByPath: vi.fn().mockResolvedValue(null),
      });

      const result = await handleUpdatePage(mockClient, {
        path: 'nonexistent/page',
        isPublished: true,
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });

    it('should return error when neither id nor path provided', async () => {
      const result = await handleUpdatePage(mockClient, {
        isPublished: true,
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toContain('id');
    });
  });
});
