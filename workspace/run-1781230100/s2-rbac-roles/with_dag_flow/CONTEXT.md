# Domain Dictionary

**JWT**: Authentication token mechanism securing routes and asserting user identity. _Avoid_: session, cookie, token (unqualified).
**Role**: Access level (Admin or User) defining permitted actions on routes. _Avoid_: group, permission, privilege.
**UserModel**: In-memory storage of users, accessed via ID from JWT to lookup Roles. _Avoid_: database, persistent store.
