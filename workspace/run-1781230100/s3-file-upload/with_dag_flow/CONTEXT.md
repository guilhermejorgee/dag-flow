# Domain Dictionary

**FileUploadEndpoint**: Endpoint at `POST /api/upload` accepting a single file field `file`, validated against 5MB limit and specific MIME types, saving to local `uploads/`. _Avoid_: generic upload route.
