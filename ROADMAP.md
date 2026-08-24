# Wiki.js MCP Server — Roadmap

## Goal

Provide a reliable Wiki.js MCP server that works locally over stdio and remotely over Streamable HTTP, with a Docker deployment suitable for Dockhand.

## Milestone 1 — Transport and deployment foundation

Status: implemented and deployed; ongoing operational hardening remains.

- [x] Preserve the existing seven Wiki.js tools.
- [x] Share tool registration between stdio and HTTP transports.
- [x] Add validated environment configuration.
- [x] Add Streamable HTTP MCP transport.
- [x] Add health endpoint.
- [x] Add optional bearer authentication.
- [x] Add host and Origin validation.
- [x] Add real HTTP MCP client integration tests.
- [x] Add Dockerfile and Compose deployment.
- [x] Attach Compose service to the external `proxied-network`.
- [x] Update README, examples, changelog, and CI.
- [x] Build and start the image successfully through Dockhand.
- [x] Run live MCP health and tool-list smoke tests.
- [x] Complete a live read-only Wiki.js smoke test after correcting the API port.

## Milestone 2 — Operationalize the live deployment

Status: live and healthy; documentation and security follow-through remain.

- [x] Keep Hawser’s writable systemd-managed state directory configuration.
- [x] Correct the Dockhand stack API URL to `http://wiki:3000/graphql`.
- [x] Deploy stack `wikijs-mcp` in Dockhand environment `Containers External`.
- [x] Verify health, MCP initialization, tool listing, and a read-only Wiki.js request.
- [ ] Rotate the Wiki.js API token that was exposed during deployment testing.
- [x] Record the final endpoint, authentication mode, redeployment procedure, and health checks in the README.
- [ ] Decide whether the service remains trusted-LAN-only or will be exposed through a reverse proxy.
- [ ] Before any broader exposure, require TLS, a strong `MCP_AUTH_TOKEN`, and narrow host/origin allow lists.
- [x] Commit and push the corrected README plus `ROADMAP.md` and `PROGRESS.md`, then redeploy and repeat the read-only smoke test.

Acceptance gate:

- No exposed credentials remain valid.
- The documented endpoint and commands match the live stack.
- A fresh deployment from `main` becomes healthy and passes `wikijs_list_pages` without manual container changes.

## Milestone 3 — Wiki navigation and discovery

- [x] Confirm the Wiki.js GraphQL shapes available for hierarchy and tags.
- [x] Add `wikijs_get_tree` for page hierarchy navigation with optional locale and parent/path filtering.
- [x] Add tag listing and tag-based page discovery, using the smallest useful tool surface supported by the API.
- [ ] Add site information only where the GraphQL API provides stable, non-administrative fields.
- [x] Add unit tests for validation, empty results, locale handling, pagination, and upstream GraphQL failures.
- [x] Add read-only integration coverage against a real test Wiki.js instance.
- [x] Update tool documentation and README; evaluation/changelog updates remain part of release preparation.

Acceptance gate:

- Clients can discover a page from hierarchy or tags without already knowing its numeric ID.
- All new operations are read-only, work over both stdio and HTTP, and pass mocked plus live test-instance coverage.
- Existing seven tool names and behavior remain compatible.

## Milestone 4 — History and safer editing

- [x] Probe and document Wiki.js page history and revision identifiers; restore semantics remain uncommitted.
- [x] Add page history/version listing and revision retrieval.
- [x] Add `wikijs_patch_page` with required expected-old-text checks.
- [x] Fail without mutation when expected text matches zero or multiple locations.
- [x] Return a before/after preview in dry-run mode before applying a patch.
- [x] Require and complete disposable-page live mutation tests covering patch, restore, and delete behavior.
- [x] Add revision restore only after confirming the Wiki.js mutation and revision identifiers; live disposable-page validation remains.

Acceptance gate:

- A targeted edit cannot silently overwrite content that changed after the client read it.
- Dry-run output clearly identifies the proposed change and guarantees no mutation.
- Every destructive live test uses a uniquely named disposable page and cleans it up when safe.

## Milestone 5 — Reliability and production hardening

- [ ] Add optimistic concurrency if Wiki.js exposes a usable revision/version field; otherwise document the limitation and rely on guarded patch semantics.
- [ ] Decide and document whether HTTP sessions remain stateless or support resumability based on actual client requirements.
- [ ] Add bounded upstream request timeouts and clear timeout/error mapping.
- [ ] Define conservative retry behavior for read-only requests only; never retry mutations implicitly.
- [ ] Add structured request logging without tokens or page contents by default.
- [ ] Add rate-limit behavior appropriate for the target Wiki.js instance.
- [ ] Test deployment through the intended reverse proxy, including TLS and forwarded host/origin behavior.
- [ ] Add container restart, rollback, backup/restore dependency, and upgrade runbooks.
- [ ] Add restart/recovery smoke coverage and confirm the container returns healthy without manual intervention.

Acceptance gate:

- Slow or unavailable Wiki.js requests terminate predictably and do not leak secrets or page contents.
- Mutation requests are never automatically replayed.
- The documented restart, upgrade, and rollback procedures have been exercised on the deployed stack.

## Milestone 6 — Release and client acceptance

- [ ] Add a named-client acceptance matrix for the intended MCP clients and transports.
- [ ] Verify tool discovery and representative read-only calls from each supported client.
- [ ] Verify guarded write behavior from at least one client against a disposable page.
- [ ] Keep the standalone MCP server as the source of truth; validate the separate `wikijs-plugin` wrapper against a released server version rather than duplicating server logic.
- [ ] Decide versioning and release notes for the transport/deployment work and each new tool milestone.
- [ ] Publish only after CI, Docker build, live smoke, documentation, and changelog gates pass.

Acceptance gate:

- Supported clients can install/connect using documented steps and exercise the advertised tools.
- The marketplace wrapper, if maintained, pins or declares a compatible server version and has its own install smoke test.

## Recommended execution order

1. Finish Milestone 2 security and documentation cleanup.
2. Run live test-instance checks for the Milestone 3 navigation tools and release them.
3. Run disposable-page checks for guarded patching and history/version reads.
4. Run live disposable-page validation for dry-run patching and confirmed revision restore.
5. Complete production hardening and named-client acceptance before declaring the service production-ready.

Each milestone should land as focused commits. Keep infrastructure/deployment changes separate from tool additions, and avoid combining multiple new public tools in one commit unless they share one API contract and test fixture.

## Deliberate non-goals

- No Wiki.js administration, user management, database access, or custom web UI.
- No renaming or breaking changes to the existing seven tools.
- No SDK migration unless the current SDK blocks a required capability.
- No secrets committed to Git, Compose, documentation, or test fixtures.

## Handoff checklist

- Read `PROGRESS.md` first.
- Confirm the branch and latest pushed commit before changing deployment files.
- Check Hawser’s effective systemd sandbox settings before troubleshooting Dockhand again.
- Keep deployment changes separate from future Wiki.js tool additions.
- Run typecheck, tests, build, and `git diff --check` before each focused commit.
- Validate destructive Wiki.js operations only against a disposable/test page.
