# Design: File Upload Endpoint

## Solution Components
- **Multer Configuration**: A middleware instance created using `multer` configured with:
  - `dest`: `./uploads/` relative to project root.
  - `limits`: `fileSize: 5 * 1024 * 1024` (5MB).
  - `fileFilter`: A custom function checking `mimetype` against `image/jpeg`, `image/png`, `image/gif`, `application/pdf`, and `text/plain`.
- **Express Route**: `src/routes/upload.js` exposing `POST /api/upload`.
- **Error Handling**: Catch `multer` errors (like `LIMIT_FILE_SIZE` and file type rejection) and format them into a standard JSON 400 Bad Request response.

## Patterns Reused
- **Express Router**: `src/routes/upload.js` uses standard Express Router pattern.
- **Middleware**: `multer` will be used as a route-specific middleware, an existing standard Express pattern.

## New Patterns Introduced
- N/A - This feature introduces no new pattern; it strictly conforms to standard Express routing and middleware attachment.

## Cross-Cutting Concerns
- Error Handling: We must handle multer-specific errors safely and return 400 Bad Request.
- File System: Creates a dependency on the local file system `uploads/` directory, which must be gitignored but writable.

## ADRs Required
- N/A - No architectural trade-off was made that meets the ADR criteria (hard to reverse + surprising + real trade-off). Using local disk for uploads was explicitly mandated.

## Confidence
High confidence. Multer is the standard library for handling `multipart/form-data` in Express.
