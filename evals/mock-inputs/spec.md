# User Authentication Specification

## Overview
Implement user authentication using JWT (JSON Web Tokens) to securely authenticate users.

## Requirements
- Users can login with email and password to receive an AccessToken.
- Passwords must be securely hashed.
- AccessToken expires in 15 minutes.
- Protected API endpoints must validate the AccessToken.
- Requests with an invalid or expired AccessToken must be rejected with 401 Unauthorized.
