# Tasks: file-upload

| ID | Title | Command | Dependencies |
|---|---|---|---|
| T-1 | Install multer | `npm install multer` | |
| T-2 | Create uploads directory | `mkdir -p uploads` | |
| T-3 | Create middleware | `node scripts/create_middleware.js` | T-1, T-2 |
| T-4 | Create routes | `node scripts/create_routes.js` | T-3 |
| T-5 | Mount routes | `node scripts/mount_routes.js` | T-4 |
| T-Final | Mark complete | `echo "Done"` | T-5 |
