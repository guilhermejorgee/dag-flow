# Feature: Super-Admin Role

## 1. Description
Introduce a new role `SUPER-ADMIN` that has exclusive access to sensitive data and user management capabilities.

## 2. Requirements
- Add `SUPER-ADMIN` role support.
- Add `SUPER-ADMIN` dummy user to `src/db.js` for testing.
- New endpoint `GET /super-admin-data`:
  - Access: `SUPER-ADMIN` only.
  - Response: `{ message: 'Welcome Super-Admin', data: 'Super secret data' }`.
- New endpoint `DELETE /users/:id`:
  - Access: `SUPER-ADMIN` only.
  - Response (Success): `200 OK` with `{ message: 'User deleted' }`.
  - Response (Not Found): `404 Not Found` if the user ID doesn't exist.
- Update tests to cover:
  - `SUPER-ADMIN` access to both new endpoints.
  - Deny access to `ADMIN`, `EDITOR`, `VIEWER` for both new endpoints.
  - `DELETE` endpoint behavior (success and 404).

## 3. Edge Cases Addressed
- Deleting a non-existent user returns `404 Not Found`.
- Ensuring existing roles (`ADMIN`, `EDITOR`, `VIEWER`) are denied access with `403 Forbidden`.
