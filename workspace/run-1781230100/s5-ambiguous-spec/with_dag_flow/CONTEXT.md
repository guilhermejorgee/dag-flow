# Domain Dictionary

**InAppNotification**: Real-time message delivered directly to the user's active application session. _Avoid_: email, push alert, system log.
**TaskCreatedEvent**: Trigger when a new task is created. _Avoid_: ticket opened.
**TaskStatusChangedEvent**: Trigger when a task's status is modified. _Avoid_: progress update.
**TaskAssignedEvent**: Trigger when a task is assigned to a specific user. _Avoid_: owner changed.
**WebSocketTransport**: Transport layer for delivering instant updates directly to the user's active session. _Avoid_: polling, server-sent events.
**NotificationBuffer**: In-memory storage keeping up to 50 notifications per user. _Avoid_: database storage, persistent history.
