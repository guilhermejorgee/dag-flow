# Design: file-upload

## Solution Components
- **Multer Middleware**: A configured `multer` instance defining disk storage destination (`uploads/`), file size limits (5MB), and a `fileFilter` for MIME type validation.
- **Express Route Controller**: The `POST /api/upload` route handler that integrates the multer middleware and responds to the client upon successful upload or intercepts validation errors.

## Patterns Reused
- Express routing and middleware patterns. Route definitions will align with the existing project structure (if any).

## New Patterns Introduced
- **File Upload Handling**: Establishes the pattern for accepting `multipart/form-data` requests via `multer`.

## Cross-Cutting Concerns
- **Error Handling**: Multer errors (like `LIMIT_FILE_SIZE`) and custom `fileFilter` rejections will be explicitly caught and transformed into a `400 Bad Request` JSON response to comply with specifications.
- **Security**: The `fileFilter` strictly checks MIME types to prevent non-allowed file execution, but local `uploads/` directory must not execute scripts.
- **Auth**: N/A - No specific authentication constraints were provided; assumes standard route access.

## ADRs Required
No architectural trade-off was made that meets the ADR criteria (hard to reverse + surprising + real trade-off).

## Confidence
Confidence is high as this design relies on standard usage of `multer` with well-defined constraints.
