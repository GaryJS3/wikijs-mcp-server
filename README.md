# Wiki.js MCP Server

**Model Context Protocol Server for Wiki.js integration** - Create and manage wiki pages directly from your AI assistant.

> **Using this from Claude Code?** Use [wikijs-plugin](https://github.com/markus-michalski/wikijs-plugin)
> instead — it combines this server (ported to Python) with a `docs-wiki` skill into a single
> plugin installable via the Claude Code marketplace mechanism, no manual clone/build/config
> steps. Config moves from this repo's `.env` to `~/.wikijs-plugin/.env` (set up via
> `/wikijs-plugin:setup`); the runtime changes from Node.js 18+ to Python 3.11+; tool names
> (`wikijs_create_page`, ...) are unchanged. This repo continues to receive fixes and remains
> the way to run the server directly (see Quick Start below) for any MCP client other than
> Claude Code.
>
> **Migrating an existing install:** copy `~/.claude/mcp-servers/wikijs/.env` to
> `~/.wikijs-plugin/.env` (same keys, same values — no new API token needed), then remove the
> old `wikijs` entry from `~/.claude.json` so the tools aren't registered twice.

## v2.0.0 - Major Refactoring

This version includes a complete rewrite following MCP Best Practices:

- **TypeScript** - Full type safety with strict mode
- **Modern SDK** - Uses MCP SDK v1.24+ with `McpServer.tool()` API
- **Zod Validation** - Runtime input validation for all tools
- **Service-Prefixed Tools** - All tools use `wikijs_` prefix for namespace clarity
- **Tool Annotations** - Proper `readOnlyHint`, `destructiveHint`, etc.
- **Pagination Support** - List operations return `has_more`, `next_offset`, `total_count`
- **Character Limits** - Large content is truncated with clear notices

## Documentation

**[Complete Documentation & FAQ](https://faq.markus-michalski.net/en/mcp/wikijs)**

The comprehensive guide includes:
- Installation instructions
- Configuration examples
- All 7 MCP tools with parameters
- GraphQL API integration details
- Troubleshooting guide

## Quick Start

For any MCP client other than Claude Code (see the note above for Claude Code):

```bash
# 1. Clone repository
git clone https://github.com/markus-michalski/wikijs-mcp-server.git
cd wikijs-mcp-server

# 2. Install dependencies
npm install

# 3. Build TypeScript
npm run build

# 4. Configure environment
cp .env.example .env
# Edit .env with your Wiki.js API credentials

# 5. Point your MCP client's config at dist/index.js and restart it
```

## Requirements

- **Node.js 18+**
- **Wiki.js instance** (v2.x or v3.x)
- **Wiki.js API Token** with page management permissions

## Available Tools

| Tool | Description | Annotations |
|------|-------------|-------------|
| `wikijs_create_page` | Create new wiki pages with Markdown or HTML | `destructiveHint: false` |
| `wikijs_update_page` | Update existing pages (content, title, tags) | `idempotentHint: true` |
| `wikijs_get_page` | Retrieve full page content and metadata | `readOnlyHint: true` |
| `wikijs_list_pages` | List pages with pagination and filtering | `readOnlyHint: true` |
| `wikijs_search_pages` | Full-text search across wiki pages | `readOnlyHint: true` |
| `wikijs_delete_page` | Permanently delete pages | `destructiveHint: true` |
| `wikijs_move_page` | Move pages to new paths | `destructiveHint: false` |

## Development

```bash
# Development with hot-reload
npm run dev

# Build for production
npm run build

# Type checking
npm run typecheck
```

## Project Structure

```
wikijs-mcp-server/
├── src/
│   ├── index.ts           # Main server entry point
│   ├── constants.ts       # Shared constants (CHARACTER_LIMIT, etc.)
│   ├── types.ts           # TypeScript type definitions
│   ├── schemas/           # Zod validation schemas
│   ├── services/          # API client and error handling
│   └── tools/             # Tool implementations
├── dist/                  # Compiled JavaScript
├── evaluation.xml         # MCP evaluation test questions
└── package.json
```

## License

MIT License - See [LICENSE](./LICENSE) for details

## Author

**Markus Michalski**
- Website: [markus-michalski.net](https://markus-michalski.net)
- GitHub: [@markus-michalski](https://github.com/markus-michalski)

## Links

- **[Full Documentation](https://faq.markus-michalski.net/en/mcp/wikijs)** (English)
- **[Vollstaendige Dokumentation](https://faq.markus-michalski.net/de/mcp/wikijs)** (Deutsch)
- [Changelog](./CHANGELOG.md)
