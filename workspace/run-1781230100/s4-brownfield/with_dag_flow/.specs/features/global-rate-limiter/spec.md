# Global Rate Limiter Specification

## Requirements
- **Core Function**: Global API rate limiter using Redis to block bad bots.
- **Threshold**: 100 requests per 15 minutes.
- **Scope**: Applied globally to all routes. No exemptions.
- **Response**: HTTP 429 status code with JSON payload `{"error": "Too Many Requests"}`.
- **Infrastructure**: Redis store. Connection uses `REDIS_URL` environment variable, falling back to `redis://localhost:6379` without authentication if the variable is empty.
