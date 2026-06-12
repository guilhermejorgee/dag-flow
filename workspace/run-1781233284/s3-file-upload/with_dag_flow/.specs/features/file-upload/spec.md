# File Upload Specification

## Core Requirements
- Implement a file upload endpoint using `multer`.
- **Route**: `POST /api/upload`
- **Field Name**: `file` (single file upload)
- **Storage**: Local disk in the `uploads/` directory relative to the project root.

## Validation Rules
- **Maximum File Size**: 5MB
- **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/gif`, `application/pdf`, and `text/plain`
- **Error Handling**: Any upload exceeding the size limit or having an invalid MIME type must return a `400 Bad Request` error.
