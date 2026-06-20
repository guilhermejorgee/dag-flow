# Design: auth-header

## Scope

Single-file addition: `src/services/auth_service.js`.

## Architecture

N/A — no new patterns. Reuses existing Node.js service layout under `src/services/`.

## ADRs

None required.

## Verification

`test.js` at project root checks for the SecurityHeaderRule comment in the service file.
