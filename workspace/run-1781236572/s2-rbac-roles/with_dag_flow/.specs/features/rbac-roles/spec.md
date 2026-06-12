# Specification: RBAC Roles

## Overview
Implement Role-Based Access Control (RBAC) with in-memory storage for Users and Tasks. The system supports `Admin` and `User` roles using JWT authentication.

## Core Requirements
1. **Data Storage:** In-memory arrays for users and tasks.
2. **Admin Bootstrap:** On startup, if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are present in the environment, an `Admin` user is populated into the in-memory store.
3. **Registration:** Public `/register` endpoint that creates a user with the default `User` role. Passwords must be hashed with `bcrypt`.
4. **Authentication:** Public `/login` endpoint that authenticates a user and returns a signed JWT containing the user's ID and role.
5. **RBAC Middleware:** Middleware to verify JWT and enforce role-based access.
6. **Task Routes:**
   - `GET /tasks`: Open to any authenticated user (Admin or User).
   - `POST /tasks`: Restricted to `Admin` role.
   - `DELETE /tasks/:id`: Restricted to `Admin` role.
   - Tasks are global and have no user ownership.

## Technical Details
- **Libraries:** `express`, `bcrypt`, `jsonwebtoken` (already in `package.json`).
- **Env variables:** `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET`.
