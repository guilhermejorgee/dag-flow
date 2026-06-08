# Specification: Role-Based Access Control (RBAC) API

## 1. Objective
Implement a Node.js/Express API with Role-Based Access Control (RBAC) including login, JWT issuance, and role-based route protection.

## 2. In-Scope
- `POST /login`: Accepts username and password, returns a signed JWT.
- Roles system containing `Admin`, `Editor`, and `Viewer`.
- Authorization middleware to decode JWT and enforce role requirements.
- `GET /admin-data`: Protected route accessible ONLY to `Admin`.
- `GET /editor-data`: Protected route accessible to `Admin` and `Editor`.
- In-memory persistence for users (no external DB).
- Unit tests using Node.js native test runner (`node:test`).

## 3. Out-of-Scope
- Database integration (PostgreSQL, MongoDB, etc.).
- Complex user management (registration, password reset).
- Refresh tokens or session invalidation.

## 4. Business Rules
1. **Authentication Rule**: Requests missing a JWT or providing an invalid JWT must receive `401 Unauthorized`.
2. **Authorization Rule**: Valid JWTs with an insufficient role for a route must receive `403 Forbidden`.
3. **Login Rule**: Invalid credentials must receive `401 Unauthorized`.
4. **Role Inheritance Rule**: Admins can access Editor routes. Viewers cannot access Editor or Admin routes.
