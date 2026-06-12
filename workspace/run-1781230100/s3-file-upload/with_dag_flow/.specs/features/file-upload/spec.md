# Specification: File Upload Endpoint

## Overview
Implement a file upload endpoint using `multer`. 

## Requirements
- **Endpoint**: `POST /api/upload`
- **Field Name**: `file` (single file)
- **Max File Size**: 5MB
- **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/gif`, `application/pdf`, `text/plain`
- **Storage Destination**: Local disk, in the `uploads/` directory relative to the project root.
- **Validation**:
  - Reject uploads exceeding 5MB.
  - Reject files with MIME types not in the allowed list.
