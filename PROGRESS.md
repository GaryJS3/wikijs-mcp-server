# Wiki.js MCP Server — Progress

Updated: 2026-08-24

## Current state

The first deployment milestone is implemented and pushed to `main`. The repository now supports both stdio and Streamable HTTP MCP transports, Docker/Compose deployment, authentication and host/origin checks, and the Wiki.js tools through a shared server factory.

The Dockhand container is online and healthy in `Containers External` (environment ID `2`). Release `2.1.0` is deployed. The Hawser agent runs directly on that host as root; it is not a container.

## Completed

- Added configuration loading and validation in `src/config.ts`.
- Separated MCP server/tool registration from transport startup.
- Added stdio startup and Streamable HTTP startup.
- Added `/health`, optional bearer authentication, host allow-listing, and Origin validation.
- Preserved the seven existing Wiki.js tools:
  - `wikijs_create_page`
  - `wikijs_get_page`
  - `wikijs_list_pages`
  - `wikijs_search_pages`
  - `wikijs_update_page`
  - `wikijs_delete_page`
- `wikijs_move_page`
- `wikijs_get_tree`
- `wikijs_list_tags`
- `wikijs_search_tags`
- `wikijs_page_history`
- `wikijs_get_page_version`
- `wikijs_patch_page`
- `wikijs_restore_page_version`
- Added multi-stage, non-root Docker packaging.
- Added `compose.yaml` using the external `proxied-network`, allowing the service to reach Wiki.js at `http://wiki:3000/graphql` on the same Docker network.
- Added HTTP integration tests using the official MCP client transport.
- Updated README, `.env.example`, CHANGELOG, and CI.

## Validation

The following checks passed locally:

- `npm run typecheck`
- `npm test` — 24 tests passed across 3 files
- `npm run build`
- `git diff --check`
- Compiled HTTP smoke test: `/health` returned HTTP 200
- Live Dockhand `/health`: HTTP 200, server version `2.1.0`
- Live MCP initialize/tool listing: all 14 tools returned successfully
- Live read-only Wiki.js call: passed; returned the `Welcome` page and reported 12 total pages
- Guarded patch tests verify zero/multiple-match failures do not call the update mutation.
- Patch and restore default to dry-run; restore additionally requires `confirm: true`.
- Live disposable-page validation passed: tree/tag discovery, dry-run patch, applied patch, history/version retrieval, dry-run restore, applied restore, restored-content verification, and cleanup.

The local Docker image build was not run successfully because the Docker Desktop Linux engine was unavailable. CI includes Docker build validation.

## Git

- `99eaea0` — `feat: add Streamable HTTP and Docker deployment`
- `39b97e7` — `fix: connect Dockhand deployment to Wiki.js network`
- Both commits are pushed to `origin/main`.

## Dockhand deployment

Configured Git stack:

- Stack: `wikijs-mcp`
- Stack ID: `3`
- Environment: `Containers External` / ID `2`
- Repository: `https://github.com/GaryJS3/wikijs-mcp-server.git`
- Branch: `main`
- Compose file: `compose.yaml`
- Git sync: reached commit `39b97e7`
- Auto-update: daily at `03:00`
- Container: `wikijs-mcp`, running and healthy
- Deployed release: `2.1.0` / image `wikijs-mcp-wikijs-mcp:2.1.0`
- Deployed commit: `0dd6d9c`
- Published endpoint: `http://10.10.0.64:3200`
- Docker network address: `172.22.0.10` on `proxied-network`

The Wiki.js API URL and API token were configured in Dockhand stack environment settings. The token is intentionally not recorded in this file. Rotate it after testing because it was pasted into the conversation.

### Resolved configuration issue

The initial live stack configuration used:

```text
WIKIJS_API_URL=http://wiki/graphql
```

The Wiki.js container exposes its HTTP service on container port `3000`, not port `80`. Its network alias is confirmed as `wiki` on `proxied-network`. The Dockhand stack value was corrected to:

```text
WIKIJS_API_URL=http://wiki:3000/graphql
```

After redeployment, the read-only `wikijs_list_pages` smoke test passed.

## Immediate handoff steps

1. The Hawser writable-state issue is resolved far enough for Dockhand to create the container; retain the systemd override as part of the host setup.
2. Keep the corrected Dockhand value `WIKIJS_API_URL=http://wiki:3000/graphql`.
3. On future Hawser failures, inspect the effective service unit:

   ```bash
   systemctl cat hawser
   systemctl show hawser -p User -p DynamicUser -p ProtectSystem -p ReadWritePaths -p StateDirectory -p Environment
   ```

4. If needed, make Hawser’s root service state writable. The intended systemd override is:

   ```ini
   [Service]
   StateDirectory=hawser
   ReadWritePaths=/var/lib/hawser
   Environment=HOME=/var/lib/hawser
   Environment=DOCKER_CONFIG=/var/lib/hawser/.docker
   ```

   Do not change the service to a non-root user; Hawser currently runs as root.

5. Apply and restart the agent:

   ```bash
   systemctl daemon-reload
   systemctl restart hawser
   systemctl status hawser --no-pager
   ```

6. Verify the container is healthy and check `/health`.

## Remaining plan

The transport and initial Dockhand deployment are complete. Work should continue in the following order.

### Priority 0 — Close the deployment milestone

- Rotate the Wiki.js API token exposed during deployment testing.
- Decide whether the endpoint remains trusted-LAN-only or will be published through a TLS reverse proxy.
- If it will be exposed more broadly, configure a strong `MCP_AUTH_TOKEN` and narrow `MCP_ALLOWED_HOSTS` and `MCP_ALLOWED_ORIGINS` before exposure.
- Expand the README with the live endpoint, authentication mode, redeployment procedure, and health/read-only smoke commands.
- Commit and push the pending README correction plus this progress file and the roadmap.
- Redeploy from the resulting `main` commit and repeat health, tool-list, and `wikijs_list_pages` checks.

Completion evidence should record the deployed commit, container health, authentication mode without its secret, and the read-only smoke result.

### Priority 1 — Navigation and discovery

The implementation and live test-instance smoke test are complete. The tools use Wiki.js `pages.tree`, `pages.tags`, and `pages.searchTags` GraphQL operations. The next work is release follow-through and broader client acceptance.

- Optional locale and parent/path filtering where supported.
- Predictable empty-tree and malformed-response handling.
- Unit tests plus HTTP MCP integration coverage.
- A live test-instance smoke test.
- README, changelog, and evaluation updates.

Tag discovery should follow as a separate focused slice. Site-information tooling should be added only for stable, useful, non-administrative GraphQL fields.

### Priority 2 — Safer editing and history

Page history/version reads, dry-run previews, guarded patching, and confirmed revision restore are implemented and live-validated. The patch operation requires exactly one expected-old-text match and performs no mutation on zero or multiple matches. Restore requires `confirm: true` and defaults to dry-run.

### Priority 3 — Production hardening

Add upstream timeouts, read-only-only retry rules, structured redacted logs, rate-limit handling, restart/recovery coverage, reverse-proxy validation, and exercised upgrade/rollback runbooks. Never retry a mutation automatically.

### Priority 4 — Release and client acceptance

Maintain a named-client matrix for stdio and Streamable HTTP. The standalone server remains the implementation source of truth. Treat the separate `wikijs-plugin` marketplace wrapper as packaging/integration work and verify it against a released server version with an install smoke test.

## Definition of done for each future slice

1. Confirm the live/test Wiki.js API behavior before finalizing a public tool schema.
2. Add validation, success, empty-result, and upstream-error tests.
3. Run `npm run typecheck`, `npm test`, `npm run build`, and `git diff --check`.
4. For deployment changes, build through CI or an available Linux Docker engine.
5. For read operations, run a live test-instance smoke test; for mutations, use only a uniquely named disposable page.
6. Update README, evaluation prompts, changelog, roadmap, and this progress handoff as applicable.
7. Land focused commits and record the deployed commit and validation evidence.

## Security notes

- Keep `WIKIJS_API_TOKEN` in Dockhand secrets/environment storage, never in Git.
- Configure `MCP_AUTH_TOKEN` before exposing the HTTP endpoint beyond a trusted network.
- Keep `MCP_ALLOWED_HOSTS` and `MCP_ALLOWED_ORIGINS` narrow for the actual deployment path.
