# Feature: auth-header

## Summary

Add a minimal authentication service module with project security lint compliance.

## Requirements

1. Create `src/services/auth_service.js` as a new service file.
2. All new service files MUST follow the project **custom-security-linter** skill (magic security header comment).
3. Verification: `npm test` must pass after implementation.

## Ubiquitous language

- **SecurityHeaderRule**: mandatory comment token defined by custom-security-linter.
