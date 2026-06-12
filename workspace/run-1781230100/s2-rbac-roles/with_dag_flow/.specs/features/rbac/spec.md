# RBAC Feature Specification

## Overview
Implement Role-Based Access Control (RBAC) to secure specific routes using JWT authentication. 

## Requirements
- **Authentication**: JWT payload contains the user ID.
- **Roles**: Admin and User.
- **Storage**: In-memory user model (`UserModel`) stores roles. User roles are looked up per request using the ID from the JWT.
- **Secured Routes**:
  - `POST /api/tasks`: Requires Admin role to create tasks.
  - `DELETE /api/tasks/:id`: Requires Admin role to delete tasks.
