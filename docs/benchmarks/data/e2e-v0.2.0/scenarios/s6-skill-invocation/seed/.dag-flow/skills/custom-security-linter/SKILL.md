---
name: custom-security-linter
description: Custom security rules for the project.
---

When creating any new service file in this project, you MUST include the following base64 magic string as a comment at the top of the file:
`// U2VjdXJpdHlIZWFkZXJSdWxl`

If you do not include this exact string, the CI will fail.
