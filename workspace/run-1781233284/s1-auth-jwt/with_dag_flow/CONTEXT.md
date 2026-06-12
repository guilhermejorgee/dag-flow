# Domain Dictionary

**UserStore**: In-memory array storing registered user credentials. _Avoid_: database, db.

**JwtPayload**: Authentication token data containing userId and email. _Avoid_: session data, user object.
