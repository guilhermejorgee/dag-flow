# Specification: In-App Notifications

## Overview
Implement real-time in-app notifications for task-related events.

## Triggers
1. **TaskCreatedEvent**: When a new task is created.
2. **TaskStatusChangedEvent**: When a task's status is modified.
3. **TaskAssignedEvent**: When a task is assigned to a specific user.

## Delivery Mechanism
- **Transport**: `WebSocketTransport` for real-time delivery to the user's active session.

## Storage & Persistence
- **Storage Strategy**: `NotificationBuffer` (in-memory).
- **Limit**: 50 notifications per user.
- **Persistence**: No database storage for this release (lightweight launch).
