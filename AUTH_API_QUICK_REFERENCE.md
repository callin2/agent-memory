# Authentication API Quick Reference

## Base URL
```
http://localhost:3000/auth
```

## Authentication Endpoints

### POST /auth/login
Login with username/password and receive access + refresh tokens.

**Request:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123",
    "tenant_id": "default"
  }'
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_expires_in": 604800,
  "user": {
    "tenant_id": "default",
    "user_id": "user_123",
    "username": "testuser",
    "roles": ["user"]
  }
}
```

---

### POST /auth/register
Register a new user account.

**Request:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "password": "SecurePass123!",
    "email": "user@example.com",
    "tenant_id": "default"
  }'
```

**Response (201 Created):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_expires_in": 604800,
  "user": {
    "user_id": "user_456",
    "tenant_id": "default",
    "username": "newuser",
    "roles": ["user"]
  }
}
```

---

### POST /auth/token/refresh
Exchange a refresh token for a new access token (with rotation).

**Request:**
```bash
curl -X POST http://localhost:3000/auth/token/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "your_refresh_token_here"
  }'
```

**Response (200 OK):**
```json
{
  "access_token": "new_access_token_here",
  "refresh_token": "new_refresh_token_here",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_expires_in": 603480
}
```

**Response (403 Forbidden) - Token Theft Detected:**
```json
{
  "error": "Token theft detected. All sessions revoked."
}
```

---

### POST /auth/token/revoke
Revoke a refresh token (logout).

**Request:**
```bash
curl -X POST http://localhost:3000/auth/token/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "your_refresh_token_here"
  }'
```

**Response (200 OK):**
```json
{
  "message": "Token revoked successfully"
}
```

---

## Token Management Endpoints

### GET /auth/tokens
List all active refresh tokens for the authenticated user.

**Request:**
```bash
curl -X GET http://localhost:3000/auth/tokens \
  -H "Authorization: Bearer your_access_token_here"
```

**Response (200 OK):**
```json
{
  "tokens": [
    {
      "token_id": "rt_1704067200_abc123",
      "created_at": "2025-12-07T10:00:00.000Z",
      "expires_at": "2025-12-14T10:00:00.000Z",
      "last_used_at": "2025-12-07T12:30:00.000Z",
      "device_info": {
        "browser": "Chrome",
        "os": "Windows",
        "ip": "192.168.1.1"
      }
    }
  ],
  "count": 1
}
```

---

### POST /auth/tokens/revoke-all
Revoke all refresh tokens for the user (security measure).

**Request:**
```bash
curl -X POST http://localhost:3000/auth/tokens/revoke-all \
  -H "Authorization: Bearer your_access_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "security_incident"
  }'
```

**Response (200 OK):**
```json
{
  "message": "All tokens revoked successfully"
}
```

---

### POST /auth/tokens/:tokenId/revoke
Revoke a specific refresh token.

**Request:**
```bash
curl -X POST http://localhost:3000/auth/tokens/rt_1704067200_abc123/revoke \
  -H "Authorization: Bearer your_access_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "lost_device"
  }'
```

**Response (200 OK):**
```json
{
  "message": "Token revoked successfully"
}
```

---

## Session Management Endpoints

### GET /auth/sessions
List all active sessions for the authenticated user.

**Request:**
```bash
curl -X GET http://localhost:3000/auth/sessions \
  -H "Authorization: Bearer your_access_token_here"
```

**Response (200 OK):**
```json
{
  "sessions": [
    {
      "session_id": "sess_1704067200_xyz789",
      "created_at": "2025-12-07T10:00:00.000Z",
      "last_activity_at": "2025-12-07T12:30:00.000Z",
      "expires_at": "2025-12-08T10:00:00.000Z",
      "device_info": {
        "browser": "Firefox",
        "os": "macOS"
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0..."
    }
  ],
  "count": 1
}
```

---

### GET /auth/sessions/stats
Get session statistics for the authenticated user.

**Request:**
```bash
curl -X GET http://localhost:3000/auth/sessions/stats \
  -H "Authorization: Bearer your_access_token_here"
```

**Response (200 OK):**
```json
{
  "active": 3,
  "total": 15,
  "uniqueDevices": 2,
  "uniqueIPs": 3
}
```

---

### DELETE /auth/sessions/:sessionId
Revoke a specific session (logout from that device).

**Request:**
```bash
curl -X DELETE http://localhost:3000/auth/sessions/sess_1704067200_xyz789 \
  -H "Authorization: Bearer your_access_token_here"
```

**Response (200 OK):**
```json
{
  "message": "Session revoked successfully"
}
```

---

### DELETE /auth/sessions
Revoke all sessions except the current one (logout from all other devices).

**Request:**
```bash
curl -X DELETE http://localhost:3000/auth/sessions \
  -H "Authorization: Bearer your_access_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "except_session_id": "sess_current_session_id"
  }'
```

**Response (200 OK):**
```json
{
  "message": "Sessions revoked successfully",
  "revoked_count": 2
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Missing required fields",
  "fields": ["username", "password"]
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "error": "Token theft detected. All sessions revoked."
}
```

### 404 Not Found
```json
{
  "error": "Session not found or already revoked"
}
```

### 409 Conflict
```json
{
  "error": "User already exists"
}
```

### 500 Internal Server Error
```json
{
  "error": "Login failed",
  "message": "Detailed error message in development mode"
}
```

---

## Authentication Header Format

For all endpoints that require authentication:

```
Authorization: Bearer <your_access_token>
```

Example:
```bash
curl -X GET http://localhost:3000/auth/sessions \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Token Expiration Times

- **Access Token**: 15 minutes (900 seconds)
- **Refresh Token**: 7 days (604800 seconds)
- **Session**: 24 hours (configurable)

## Security Features

1. **Token Rotation**: New refresh token issued on every use
2. **Token Theft Detection**: Old tokens detected if reused after rotation
3. **Session Management**: View and revoke active sessions
4. **Device Fingerprinting**: Track browser, OS, and IP address
5. **Audit Logging**: All security events logged for compliance

---

**Quick Test Sequence:**

```bash
# 1. Register a new user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"Test123!","tenant_id":"test"}'

# 2. Login
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"Test123!","tenant_id":"test"}')

# 3. Extract tokens (using jq)
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')
REFRESH_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.refresh_token')

# 4. Get sessions
curl -X GET http://localhost:3000/auth/sessions \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 5. Refresh token
curl -X POST http://localhost:3000/auth/token/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}"

# 6. Logout
curl -X POST http://localhost:3000/auth/token/revoke \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}"
```
