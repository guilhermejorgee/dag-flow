# ADR 0002: In-Memory Notification Buffer

## Context
Notifications need to be stored and accessed, but we want to keep the initial launch lightweight without schema changes or database migrations.

## Decision
We will store notifications in an in-memory buffer, strictly limited to the 50 most recent notifications per user.

## Consequences
- Extremely fast read/write operations.
- Ephemeral: notifications are lost on server restart or deployment.
- Eliminates database load for the initial release.
- Memory footprint grows linearly with active users, bounded by the 50-item limit.
