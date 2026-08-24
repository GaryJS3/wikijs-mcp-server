import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WikiJsClient } from '../services/client.js';
import {
  createPageToolDefinition,
  handleCreatePage,
  getPageToolDefinition,
  handleGetPage,
  listPagesToolDefinition,
  handleListPages,
  searchPagesToolDefinition,
  handleSearchPages,
  updatePageToolDefinition,
  handleUpdatePage,
  deletePageToolDefinition,
  handleDeletePage,
  movePageToolDefinition,
  handleMovePage,
  getTreeToolDefinition,
  handleGetTree,
  listTagsToolDefinition,
  handleListTags,
  searchTagsToolDefinition,
  handleSearchTags,
  pageHistoryToolDefinition,
  handlePageHistory,
  pageVersionToolDefinition,
  handlePageVersion,
  restorePageVersionToolDefinition,
  handleRestorePageVersion,
  patchPageToolDefinition,
  handlePatchPage,
} from '../tools/index.js';

export const SERVER_NAME = 'wikijs-mcp-server';
export const SERVER_VERSION = '2.1.0';

/** Create the common MCP server independently of the transport used to host it. */
export function createServer(wikiClient: WikiJsClient): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.tool(createPageToolDefinition.name, createPageToolDefinition.description, createPageToolDefinition.inputSchema.shape, async (args) => handleCreatePage(wikiClient, args));
  server.tool(getPageToolDefinition.name, getPageToolDefinition.description, getPageToolDefinition.inputSchema.shape, async (args) => handleGetPage(wikiClient, args));
  server.tool(listPagesToolDefinition.name, listPagesToolDefinition.description, listPagesToolDefinition.inputSchema.shape, async (args) => handleListPages(wikiClient, args));
  server.tool(searchPagesToolDefinition.name, searchPagesToolDefinition.description, searchPagesToolDefinition.inputSchema.shape, async (args) => handleSearchPages(wikiClient, args));
  server.tool(updatePageToolDefinition.name, updatePageToolDefinition.description, updatePageToolDefinition.inputSchema.shape, async (args) => handleUpdatePage(wikiClient, args));
  server.tool(deletePageToolDefinition.name, deletePageToolDefinition.description, deletePageToolDefinition.inputSchema.shape, async (args) => handleDeletePage(wikiClient, args));
  server.tool(movePageToolDefinition.name, movePageToolDefinition.description, movePageToolDefinition.inputSchema.shape, async (args) => handleMovePage(wikiClient, args));
  server.tool(getTreeToolDefinition.name, getTreeToolDefinition.description, getTreeToolDefinition.inputSchema.shape, async (args) => handleGetTree(wikiClient, args));
  server.tool(listTagsToolDefinition.name, listTagsToolDefinition.description, listTagsToolDefinition.inputSchema.shape, async (args) => handleListTags(wikiClient, args));
  server.tool(searchTagsToolDefinition.name, searchTagsToolDefinition.description, searchTagsToolDefinition.inputSchema.shape, async (args) => handleSearchTags(wikiClient, args));
  server.tool(pageHistoryToolDefinition.name, pageHistoryToolDefinition.description, pageHistoryToolDefinition.inputSchema.shape, async (args) => handlePageHistory(wikiClient, args));
  server.tool(pageVersionToolDefinition.name, pageVersionToolDefinition.description, pageVersionToolDefinition.inputSchema.shape, async (args) => handlePageVersion(wikiClient, args));
  server.tool(restorePageVersionToolDefinition.name, restorePageVersionToolDefinition.description, restorePageVersionToolDefinition.inputSchema.shape, async (args) => handleRestorePageVersion(wikiClient, args));
  server.tool(patchPageToolDefinition.name, patchPageToolDefinition.description, patchPageToolDefinition.inputSchema.shape, async (args) => handlePatchPage(wikiClient, args));

  return server;
}
