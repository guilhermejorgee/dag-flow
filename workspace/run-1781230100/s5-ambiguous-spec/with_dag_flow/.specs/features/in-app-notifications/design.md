# Design: in-app-notifications

## Solution Components
- **WebSocket Transport Layer**: A WebSocket server attached to the existing Node.js HTTP server in `src/server.js` to manage active user connections.
- **NotificationBuffer Manager**: An in-memory data structure (e.g., a `Map` keyed by user ID) storing up to 50 recent `InAppNotification` objects per user.
- **Event Dispatcher**: An internal event emitter to decouple task operations from the WebSocket layer. Handlers will listen for `TaskCreatedEvent`, `TaskStatusChangedEvent`, and `TaskAssignedEvent` to append to the buffer and push to connected clients.

## Patterns Reused
- N/A - The existing application is a standard stateless Express API. Real-time push and in-memory state management are entirely new capabilities for this codebase.

## New Patterns Introduced
- **Stateful Connections**: Introduces long-lived WebSocket connections, deviating from the stateless HTTP request-response cycle.
- **In-Memory User State**: Introduces transient state retention (`NotificationBuffer`), requiring memory management considerations (eviction on limit).
- **Internal Event Bus**: Introduces event-driven domain communication rather than direct synchronous function calls for secondary side-effects (notifications).

## Cross-Cutting Concerns
- **Authentication**: WebSocket handshake must authenticate the user (using the same token mechanism as the REST API) before allowing connection.
- **Memory Limits**: The NotificationBuffer enforces a hard limit of 50 notifications per user to prevent memory leaks or out-of-memory errors.
- **Observability**: WebSocket connections and disconnections must be logged.

## ADRs Required
- `0001-use-websockets-for-in-app-notifications`
- `0002-in-memory-notification-buffer`

## Confidence
Confidence is high, but the introduction of stateful WebSockets to a previously stateless API requires careful memory monitoring.
