# Domain Dictionary

**UserStore**: In-memory array storing user records. _Avoid_: database, db.
**JWTConfig**: Configuration for token containing secret from env/fallback and 24h expiration. _Avoid_: jwt setup.
**TokenPayload**: Object containing `userId` and `email` embedded in JWT. _Avoid_: jwt data, token body.
