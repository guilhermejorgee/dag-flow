# Domain Dictionary

**User**: Entity representing a system user with a designated role. _Avoid_: account, profile.
**Role**: Access level assigned to a User (Admin, Editor, Viewer) that dictates permissions. _Avoid_: permissions, groups, type.
**JWT**: JSON Web Token returned upon successful login used to authenticate and authorize requests. _Avoid_: session token, auth key.
**AuthorizationMiddleware**: Express middleware that intercepts requests to extract JWT and validate role against route requirements. _Avoid_: auth checker, guard.
**Super-Admin**: The highest privilege role that can access system-wide sensitive data and remove users. _Avoid_: root, owner, master.
**Deletion**: The action of removing a User from the in-memory persistence layer. _Avoid_: disabling, deactivating.
