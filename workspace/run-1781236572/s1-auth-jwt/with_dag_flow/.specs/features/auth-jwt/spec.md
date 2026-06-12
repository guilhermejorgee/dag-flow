# Specification: JWT Authentication

## Feature Requirements
- Implement JWT authentication with POST `/api/auth/login` and POST `/api/auth/register` routes.
- Update `app.js` to mount the routes.

## Business Logic
- Password hashing must use `bcrypt`.
- Token generation must use `jsonwebtoken`.
- Token expiration is set to 24 hours.
- JWT secret must be loaded from `JWT_SECRET` environment variable, falling back to `'dev-secret'`.

## Storage
- User credentials are stored in an in-memory array located in `src/models/user.js`. No persistent DB.
- User model fields: `email` and `password`.
