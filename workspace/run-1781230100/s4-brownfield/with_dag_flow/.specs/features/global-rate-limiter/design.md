# Design: global-rate-limiter

## Solution Components
- **Redis Client Module**: A connection manager (e.g. in `src/utils/redis.js` or `src/config/redis.js`) that connects to `REDIS_URL` or `redis://localhost:6379`.
- **Rate Limiter Middleware**: An Express middleware (e.g. `src/middleware/rateLimiter.js`) implementing a 100 requests / 15 minutes limit per IP, returning a 429 status code with `{"error": "Too Many Requests"}` when exceeded.
- **Server Integration**: Injection of the middleware into the global request pipeline in `src/server.js` or `src/app.js` before any route definitions.

## Patterns Reused
- **Express Middleware**: Uses the standard `(req, res, next)` signature already present in the Express framework structure.

## New Patterns Introduced
- **External Cache/State Storage**: Introduces Redis to the stack for ephemeral state. Future caching or session needs should reuse this client pattern.

## Cross-Cutting Concerns
- **Auth**: N/A - Limit applies to all requests (by IP), irrespective of authentication state.
- **Logging**: Will log rate-limit blocks and Redis connection errors for observability.
- **Rate Limiting**: This feature directly implements the rate limiting concern globally.
- **Error Handling**: Redis connection failures should be caught and logged so they don't crash the Node.js process (e.g., fail-open or return 500).

## ADRs Required
N/A - Using Redis for distributed rate limiting is an industry standard and is not a hard-to-reverse architectural trade-off.

## Confidence
High confidence. Standard rate-limiting packages (like `express-rate-limit` and `rate-limit-redis`) perfectly map to these requirements and minimize custom state-tracking logic.
