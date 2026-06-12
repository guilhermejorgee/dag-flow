# Specification: JWT Authentication

## Feature Description
Implement JSON Web Token (JWT) authentication with registration and login capabilities using an in-memory user array.

## Requirements
1. **Storage**: In-memory array in `src/models/user.js`. No database.
2. **Registration**: 
   - Endpoint: `POST /api/auth/register`
   - Payload: `email`, `password`. (No `username`).
   - Security: Hash password using `bcrypt`.
3. **Login**:
   - Endpoint: `POST /api/auth/login`
   - Payload: `email`, `password`.
   - Response: Returns JWT token.
4. **JWT Configuration**:
   - Payload content: `{ id }` (the user's unique ID).
   - Expiration time: `24h` (24 hours).
   - Generation library: `jsonwebtoken`.
5. **Routing**:
   - Mount auth routes in `src/app.js` at `/api/auth`.
