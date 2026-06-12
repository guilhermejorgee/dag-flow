# JWT Authentication Specification

## Goal
Implement JWT authentication with register and login routes using bcrypt and jsonwebtoken.

## Requirements
- POST `/api/auth/register` requires `email` and `password`.
- POST `/api/auth/login` verifies credentials and returns JWT.
- JWT Payload: `userId`, `email`.
- Token expiration: 24 hours.
- JWT Secret: `JWT_SECRET` env variable, fallback to `dev-secret`.
- Storage: In-memory array at `src/models/user.js`.
- Mount routes in `src/app.js`.
