# ADR 0001: Use WebSockets for In-App Notifications

## Context
We need to deliver real-time in-app notifications for task events (creation, status changes, assignment). The current application is a stateless Express API.

## Decision
We will introduce a WebSocket server attached to the main HTTP server to push events directly to active clients.

## Consequences
- Enables instant delivery of notifications without client polling.
- Introduces stateful connections, increasing server memory and requiring connection lifecycle management.
- Requires WebSocket authentication mirroring the existing API auth.
