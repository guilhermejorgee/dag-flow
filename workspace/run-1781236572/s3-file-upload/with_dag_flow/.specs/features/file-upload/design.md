# Design: file-upload

## Architecture
- Use `multer` as middleware in Express.
- Destination: `uploads/` directory relative to project root.
- Validation: Check `mimetype` in `fileFilter` for JPEG, PNG, GIF, PDF, TXT.
- Size limit: Set `limits: { fileSize: 5 * 1024 * 1024 }` (5MB).
- Error Handling: Catch multer errors and return 400 Bad Request with specific error message.

## Components
- `src/middleware/upload.js`: Configures and exports multer middleware.
- `src/routes/uploadRoutes.js`: Defines `POST /upload` endpoint.
- `src/app.js`: Mounts the `/upload` router.
