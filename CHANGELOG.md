# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Nothing yet

### Changed
- README now points Claude Code users to [wikijs-plugin](https://github.com/markus-michalski/wikijs-plugin) as the recommended install path; this repo continues to receive fixes and remains the way to run the server for any other MCP client

### Deprecated
- Manual clone/build/config install for Claude Code usage — superseded by wikijs-plugin's marketplace install

### Removed
- Nothing yet

### Fixed
- Nothing yet

### Security
- Nothing yet

## [2.0.1] - 2026-03-20

### Added
- Auto-fetch content on metadata-only updates (#3)

### Changed
- clean up CHANGELOG.md placeholder entries

### Fixed
- auto-fetch title and description on partial page updates (#5)
- Security hardening from audit (#4)

## [3.0.1] - 2025-12-15

### Fixed
- Add graceful shutdown handlers for MCP server
---

## [3.0.0] - 2025-12-15

### Changed
- feat!: Complete TypeScript migration with MCP Best Practices (#2)
- Auto-sync from Markus-PC
- Add GitHub Actions CI workflow
- Reduce README to minimum and reference Wiki.js FAQ

### Fixed
- Track package-lock.json for reproducible builds
---

## [1.0.0] - 2025-11-05

### Added
- Add path-based page identification to update, delete, and move tools
- Initial Wiki.js MCP Server implementation

### Changed
- fixed verion in package.json
- Reset CHANGELOG.md for fresh start
- Add support/donation section to README
- Minimize README and reference Wiki.js documentation
- Change WIKIJS_API_URL to a customizable placeholder
- Remove local release script in favor of master script
- Add release automation script
- Update installation and troubleshooting with correct paths

### Fixed
- Require tags parameter in update to work around Wiki.js API bug
- Remove tags field from single page queries
- Fix tags mapping in get-page tool
- Only pass defined parameters to updatePage
- Handle undefined values in updatePage variable definitions
- Add required isPrivate field to page creation
- Correct GraphQL tags field structure
- Load .env from deployment directory

### Security
---

[Unreleased]: https://github.com/markus-michalski/wikijs-mcp-server/compare/v2.0.1...HEAD
[2.0.1]: https://github.com/markus-michalski/wikijs-mcp-server/releases/tag/v2.0.1
