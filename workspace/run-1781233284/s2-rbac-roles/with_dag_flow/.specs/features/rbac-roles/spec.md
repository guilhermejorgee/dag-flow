# Feature Specification: RBAC Role Management

## 1. Goal
Add Role-Based Access Control (RBAC) to secure the API. Differentiate between `Admin` and `User` roles. Ensure only `Admin` users can create or delete tasks.

## 2. Domain Context (from CONTEXT.md)
* **DataStore**: In-memory array used for model persistence.
* **AuthStrategy**: JWT used for user authentication before RBAC evaluation.
* **ForbiddenResponse**: HTTP 403 status with JSON `{"error": "Forbidden"}` structure.

## 3. Requirements
* Implement role assignment for users (either `Admin` or `User`).
* Authenticate incoming requests using JWT.
* Evaluate roles after successful JWT verification.
* Apply authorization checks to task creation and task deletion routes.
* Return HTTP 403 Forbidden with payload `{"error": "Forbidden"}` if an unauthorized user attempts protected actions.
