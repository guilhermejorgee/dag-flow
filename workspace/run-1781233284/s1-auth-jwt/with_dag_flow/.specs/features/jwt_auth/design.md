# Design: JWT Authentication

## Solution Components
- **Auth Routes**: Express router mounted at `/api/auth` containing `POST /register` and `POST /login`.
- **Auth Controller**: Logic for validating requests, interacting with `UserStore`, hashing passwords with `bcrypt`, and generating tokens with `jsonwebtoken`.
- **User Model**: An in-memory array (`UserStore`) exported from `src/models/user.js` to store registered user credentials.

## Patterns Reused
- **Express Router Middleware**: The new routes will be mounted in `src/app.js` using standard Express middleware patterns.

## New Patterns Introduced
N/A - This feature introduces no new pattern; it strictly conforms to standard Express routing and basic controller separation.

## Cross-Cutting Concerns
- **Auth**: Implements JWT generation for authentication.
- **Logging**: N/A - No logging framework is currently configured.
- **Error Handling**: N/A - Uses standard Express error handling for basic credential validation.

## ADRs Required
No architectural trade-off was made that meets the ADR criteria (hard to reverse + surprising + real trade-off).

## Confidence
High confidence; standard implementation of basic JWT authentication over an in-memory store.
