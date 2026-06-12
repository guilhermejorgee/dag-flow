# Domain Dictionary

**UserStorage**: In-memory array in `src/models/user.js` used for user persistence. _Avoid_: database, persistent storage, db.
**UserEntity**: Contains `id`, `email`, and hashed `password`. _Avoid_: username.
