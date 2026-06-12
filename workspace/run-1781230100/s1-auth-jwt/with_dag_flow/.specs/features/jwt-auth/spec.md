# JWT Authentication Specification

## Overview
Implement JWT authentication with register and login routes.

## Routes
- `POST /api/auth/register`: Register a new user.
- `POST /api/auth/login`: Authenticate an existing user.

## Data Storage
- Users are stored in an in-memory array (`UserStore`) defined in `src/models/user.js`.
- Required fields for authentication: `email` and `password`.

## Security
- Passwords are hashed using `bcrypt`.
- JWT generated using `jsonwebtoken`.
- Secret: Environment variable `JWT_SECRET` with fallback to `'dev-secret'` for local dev.
- Expiration: `24h`.

## JWT Payload
- `userId` (string/number)
- `email` (string)
