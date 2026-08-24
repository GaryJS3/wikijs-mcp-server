/**
 * Tool exports for Wiki.js MCP Server
 */

export { createPageToolDefinition, handleCreatePage } from './create-page.js';
export { getPageToolDefinition, handleGetPage } from './get-page.js';
export { listPagesToolDefinition, handleListPages } from './list-pages.js';
export { searchPagesToolDefinition, handleSearchPages } from './search-pages.js';
export { updatePageToolDefinition, handleUpdatePage } from './update-page.js';
export { deletePageToolDefinition, handleDeletePage } from './delete-page.js';
export { movePageToolDefinition, handleMovePage } from './move-page.js';
export { getTreeToolDefinition, handleGetTree } from './get-tree.js';
export { listTagsToolDefinition, handleListTags, searchTagsToolDefinition, handleSearchTags } from './tags.js';
export { pageHistoryToolDefinition, handlePageHistory, pageVersionToolDefinition, handlePageVersion, restorePageVersionToolDefinition, handleRestorePageVersion } from './history.js';
export { patchPageToolDefinition, handlePatchPage } from './patch-page.js';
