# Wiki.js MCP Server

Model Context Protocol server for managing Wiki.js pages through its GraphQL API. The Wiki.js tools work over local stdio and remote Streamable HTTP.

## Requirements

- Node.js 18 or newer
- A Wiki.js v2.x or v3.x instance
- A Wiki.js API token with page management permissions

## Configuration

Copy `.env.example` to `.env` and set the Wiki.js values:

```text
WIKIJS_API_URL=https://wiki.example.com/graphql
WIKIJS_API_TOKEN=your-api-token
```

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `WIKIJS_API_URL` | Yes | — | Wiki.js GraphQL endpoint. |
| `WIKIJS_API_TOKEN` | Yes | — | Wiki.js API token. Never log or commit it. |
| `TRANSPORT` | No | `stdio` | `stdio` for local clients or `http` for Streamable HTTP. |
| `HTTP_HOST` | No | `127.0.0.1` | HTTP bind address. Use `0.0.0.0` in Docker. |
| `HTTP_PORT` | No | `3200` | HTTP listening port. |
| `MCP_PATH` | No | `/mcp` | Streamable HTTP endpoint path. |
| `MCP_AUTH_TOKEN` | No | empty | Optional bearer token required by `/mcp`. `/health` remains public. |
| `MCP_ALLOWED_HOSTS` | No | loopback hosts for local binding | Comma-separated hostnames accepted by `/mcp`. Required for non-loopback binding. |
| `MCP_ALLOWED_ORIGINS` | No | same-host origins | Comma-separated exact origins, such as `https://mcp.example.com`. |

When exposing the service through a reverse proxy, set `MCP_ALLOWED_HOSTS` to the public hostname and set `MCP_ALLOWED_ORIGINS` to the browser/client origin when applicable. TLS termination belongs at the reverse proxy.

## Local stdio

Build and run the server:

```bash
npm ci
npm run build
npm run start:stdio
```

The default `TRANSPORT=stdio` is suitable for MCP clients that launch a local child process. The server writes protocol traffic to stdout and operational logs to stderr.

## Remote HTTP

Run the Streamable HTTP server:

```bash
npm run build
TRANSPORT=http HTTP_HOST=127.0.0.1 npm start
```

On PowerShell:

```powershell
$env:TRANSPORT = 'http'
$env:HTTP_HOST = '127.0.0.1'
npm start
```

The MCP endpoint is:

```text
http://hostname:3200/mcp
```

Behind a TLS reverse proxy, use an address such as:

```text
https://mcp.example.com/mcp
```

The endpoint supports `POST`, `GET`, and `DELETE` through the official MCP SDK Streamable HTTP transport. `GET /health` returns a small machine-readable status response and does not include credentials.

If `MCP_AUTH_TOKEN` is set, clients must send:

```http
Authorization: Bearer <token>
```

## Docker Compose and Dockhand

The repository includes a multi-stage, non-root `Dockerfile` and `compose.yaml`. It can be deployed with Dockhand's **Deploy from Git** workflow. Set the Compose environment values in Dockhand or an adjacent `.env` file; do not put real credentials in the repository.

The Compose service joins the external `proxied-network` so a same-host Wiki.js deployment can be reached as `http://wiki:3000/graphql`. If deploying outside that network, remove or adapt that network entry and provide a reachable `WIKIJS_API_URL` instead.

```bash
docker compose up -d --build
docker compose ps
curl http://localhost:3200/health
```

For a public reverse-proxy deployment, configure `MCP_ALLOWED_HOSTS`, `MCP_ALLOWED_ORIGINS`, and a strong `MCP_AUTH_TOKEN`. The container health check calls `http://127.0.0.1:3200/health`.

## Available tools

| Tool | Description |
| --- | --- |
| `wikijs_create_page` | Create a Wiki.js page. |
| `wikijs_update_page` | Update page content or metadata. |
| `wikijs_get_page` | Retrieve page content and metadata. |
| `wikijs_list_pages` | List pages with pagination and filtering. |
| `wikijs_search_pages` | Search Wiki.js pages. |
| `wikijs_delete_page` | Delete a page. |
| `wikijs_move_page` | Move a page to another path or locale. |
| `wikijs_get_tree` | Browse the page hierarchy. |
| `wikijs_list_tags` | List defined page tags. |
| `wikijs_search_tags` | Search page tags. |
| `wikijs_page_history` | List page revisions. |
| `wikijs_get_page_version` | Retrieve one immutable page revision. |
| `wikijs_patch_page` | Preview by default or replace exactly one expected text occurrence with a guarded update. |
| `wikijs_restore_page_version` | Preview by default or restore a confirmed page revision. |

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build
```

The reusable MCP server factory is in `src/server/createServer.ts`; stdio and HTTP hosting live in `src/server/stdio.ts` and `src/server/http.ts`. Wiki.js API access remains centralized in `src/services/`.

## License

MIT License. See [LICENSE](./LICENSE).
# Asset and image management

The server exposes native Wiki.js asset tools: `wikijs_upload_asset`, `wikijs_list_assets`, `wikijs_list_asset_folders`, `wikijs_create_asset_folder`, `wikijs_rename_asset`, and `wikijs_delete_asset`. Wiki.js 2.x handles asset metadata and folder operations through GraphQL and accepts file uploads at the authenticated `/u` endpoint. The API token needs the relevant `read:assets`, `write:assets`, or `manage:assets` permissions.

Uploads accept exactly one of a Base64 `base64Data` value or a public HTTP(S) `sourceUrl`. Supported formats are PNG, JPEG, GIF, and WebP; the server checks the content signature and default maximum size is 10 MB. `WIKIJS_MAX_UPLOAD_MB` changes the limit (up to 100 MB). `WIKIJS_ALLOW_REMOTE_ASSETS=false` disables URL downloads. Remote downloads reject loopback, private, link-local, and reserved IP resolutions, pin the validated address for the request, and reject unsafe redirects. URL uploads can still be affected by your network's DNS and egress policy; keep the server's outbound network restricted where possible.

Overwrites are rejected. Asset deletion requires `confirm: true`; Wiki.js deletes only the selected asset, and pages that reference it are not modified. Filename extensions must match the image format. ChatGPT or Codex image attachments are not automatically exposed to this MCP server: provide an accessible source URL or Base64 data explicitly.

Example: upload with `filename: "r730xd-front.jpg"`, `folderPath: "equipment/servers"`, and `sourceUrl: "https://example.com/server.jpg"`. Use the returned Markdown or HTML reference in a page:

```markdown
![Dell R730xd Front](/equipment/servers/r730xd-front.jpg)
```

```html
<img src="/equipment/servers/r730xd-front.jpg" alt="Dell R730xd Front" style="max-width:100%;height:auto;">
```

Asset paths use Wiki.js's path convention (leading slash, folder slugs, and filename). Reverse-proxy installations retain the configured API path prefix in the absolute URL. Wiki.js 2.x upload responses do not return the created asset ID, so the server verifies the asset through GraphQL after upload; a successful upload that cannot be read back is reported as an error.
