# AstraFlow Security Policy

**Version**: 1.0.0  
**Last Updated**: June 2026  
**Application**: Fuel price forecasting platform for Mauritius  
**Repository**: AstraFlow

---

## Table of Contents

1. [Overview & Philosophy](#1-overview--philosophy)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Data Security & Privacy](#3-data-security--privacy)
4. [API Security](#4-api-security)
5. [Infrastructure Security](#5-infrastructure-security)
6. [Dependency & Supply Chain Security](#6-dependency--supply-chain-security)
7. [Frontend Security](#7-frontend-security)
8. [ML Model Security](#8-ml-model-security)
9. [Incident Response Plan](#9-incident-response-plan)
10. [Known Security Issues & Roadmap](#10-known-security-issues--roadmap)
11. [Reporting Vulnerabilities](#11-reporting-vulnerabilities)
12. [Security Checklist for Development](#12-security-checklist-for-development)

---

## 1. Overview & Philosophy

### 1.1 Security Objectives

AstraFlow collects personally identifiable information (PII) — including email addresses, full names, business types, and fuel spending data — from users across Mauritius. The platform also integrates with third-party services (Supabase, TomTom, OilPriceAPI) and stores credentials for each. Our security objectives are:

| Objective | Priority | Rationale |
|---|---|---|
| Protect user PII | **Critical** | Legal obligation under Data Protection Act 2017 (Mauritius) |
| Secure credentials & API keys | **Critical** | Prevent unauthorized access to infrastructure and third-party services |
| Prevent account takeover | **High** | Users depend on forecasts for business decisions |
| Ensure data integrity | **High** | Fuel price data and predictions must be tamper-proof |
| Maintain availability | **Medium** | Platform supports time-sensitive fuel purchasing decisions |
| Audit & compliance readiness | **Medium** | Prepare for GDPR/CCPA-style regulations |

### 1.2 Threat Model

| Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Credential exposure via compromised `.env` | Medium | Critical | Git-secrets scanning, `.env` in `.gitignore`, secret rotation |
| Brute-force login attacks | High | High | Rate limiting, account lockout, strong password policy |
| JWT token theft (XSS on web) | Medium | High | Secure storage on native, HttpOnly cookies for web, short expiry |
| SQL injection | Low | Critical | ORM usage (SQLAlchemy), parameterized queries |
| User enumeration via registration errors | High | Low | Generic error messages |
| Privilege escalation via unprotected admin endpoints | Medium | High | Role-based access control |
| Third-party API key leakage | Medium | High | Secret rotation, env-var injection at deploy time |
| ML model poisoning via manipulated training data | Low | Medium | Input validation, training data integrity checks |

---

## 2. Authentication & Authorization

### 2.1 Current Implementation

| Component | Technology | Status |
|---|---|---|
| Password hashing | `passlib[bcrypt]` (bcrypt algorithm) | ✅ Implemented |
| JWT signing | `python-jose[cryptography]` (HS256) | ✅ Implemented |
| Token storage (native) | `expo-secure-store` (iOS Keychain / Android Keystore) | ✅ Secure |
| Token storage (web) | `localStorage` | ⚠️ **Vulnerable to XSS** |
| Token expiry | 30 days | ⚠️ **Excessively long** |
| Token refresh mechanism | None | ❌ Missing |
| Token revocation | None | ❌ Missing |
| Multi-factor authentication | None | ❌ Missing |
| Password reset flow | None | ❌ Missing |
| Account lockout | None | ❌ Missing |
| Admin role checks | None | ❌ Missing |

### 2.2 Requirements & Standards

#### Password Policy

All user passwords **must** meet the following criteria:

- **Minimum length**: 8 characters
- **Maximum length**: 128 characters (to prevent DoS via bcrypt cost)
- **Character classes**: At least 3 of the following 4:
  - Uppercase letters (A–Z)
  - Lowercase letters (a–z)
  - Digits (0–9)
  - Special characters (`!@#$%^&*()_+-=[]{}|;':",./<>?`)
- **Common password check**: Must not appear in common password lists (e.g., HaveIBeenPwned, SecLists, common passwords list)
- **Context check**: Must not contain the user's email, full name, or business name
- **History**: Must not match the last 5 passwords (enforced once password history is implemented)
- **Hashing**: bcrypt with cost factor ≥ 12 (`rounds=12`)

#### Enforcement Locations

| Layer | Location | Status |
|---|---|---|
| Client-side (form validation) | `src/app/register.tsx`, `src/app/login.tsx` | ⚠️ **Minimal** |
| Server-side (Pydantic model) | `backend/routes/auth.py` | ❌ Missing |
| Server-side (business logic) | `backend/routes/auth.py` — `create_user()` | ❌ Missing |

#### JWT Token Policy

| Parameter | Current Value | Required Value | Rationale |
|---|---|---|---|
| Algorithm | HS256 | HS256 or RS256 | ✅ Acceptable |
| Access token expiry | 30 days | **15 minutes** | Limit window for stolen token |
| Refresh token expiry | N/A | **7 days** | Allow session renewal without re-authentication |
| Refresh token rotation | N/A | **Required** | Invalidate old refresh tokens on use |
| Secret key | Env var `SECRET_KEY` or fallback `"astraflow-dev-secret-key-change-in-production"` | Env var **only**, minimum 256-bit entropy | Fallback key is publicly known |
| Token ID (jti) | Not included | **Required** | Enable token revocation |
| Issuer (iss) claim | Not included | `"astraflow-api"` | Identify token origin |
| Audience (aud) claim | Not included | `"astraflow-client"` | Restrict token usage |

### 2.3 Role-Based Access Control (RBAC)

#### Roles

| Role | Description | Permissions |
|---|---|---|
| `user` | Standard authenticated user | Access dashboard, forecasts, surveys, news, routes |
| `admin` | Application administrator | All user permissions + manage fuel prices, manage news, manage users |
| `system` | Internal service account | Health checks, internal API calls |

#### Endpoint Authorization Matrix

| Endpoint | `user` | `admin` | `system` | Public |
|---|---|---|---|---|
| `POST /api/auth/register` | — | — | — | ✅ |
| `POST /api/auth/login` | — | — | — | ✅ |
| `POST /api/auth/refresh` | ✅ | ✅ | — | — |
| `GET /api/dashboard` | ✅ | ✅ | — | — |
| `GET /api/predict` | ✅ | ✅ | — | — |
| `GET /api/forecast` | ✅ | ✅ | — | — |
| `GET /api/prices/history` | ✅ | ✅ | — | — |
| **`POST /api/prices/admin`** | ❌ | **✅** | — | — |
| `GET /api/surveys` | ✅ | ✅ | — | — |
| `POST /api/surveys` | ✅ | ✅ | — | — |
| `GET /api/surveys/insights` | ✅ | ✅ | — | — |
| `POST /api/notifications/register` | ✅ | ✅ | — | — |
| `DELETE /api/notifications/register` | ✅ | ✅ | — | — |
| `GET /api/news` | ✅ | ✅ | — | ✅ |
| `POST /api/news` | ❌ | **✅** | — | — |
| `GET /api/routes/geocode` | ✅ | ✅ | — | — |
| `POST /api/routes/plan` | ✅ | ✅ | — | — |
| `GET /api/routes/gas-stations` | ✅ | ✅ | — | — |
| `GET /api/health` | — | — | ✅ | ✅ |

### 2.4 Auth Middleware Implementation Guide

```python
# backend/middleware/auth.py — Reference pattern

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Optional

security = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            issuer="astraflow-api",
            audience="astraflow-client",
            options={"verify_exp": True},
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
        )

    user_id = payload.get("sub")
    role = payload.get("role", "user")

    # Check token revocation (against Redis or DB blacklist)
    if await is_token_revoked(payload.get("jti")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
        )

    return User(id=user_id, role=role)


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user
```

---

## 3. Data Security & Privacy

### 3.1 Data Classification

| Classification | Examples | Storage | Retention |
|---|---|---|---|
| **PII — Sensitive** | Email address, full name, business type, fuel spending amount | Supabase PostgreSQL (encrypted at rest) | Duration of account + 90 days |
| **PII — Free text** | Survey comments (may contain PII) | Supabase PostgreSQL | Duration of account + 90 days |
| **Authentication secrets** | Password hashes (bcrypt) | Supabase PostgreSQL | Indefinite (until account deletion) |
| **Operational data** | Fuel prices, forecasts, news articles | Supabase PostgreSQL | Indefinite (public data) |
| **Device tokens** | Expo push tokens | Supabase PostgreSQL | Until token deregistration |
| **Infrastructure secrets** | DB credentials, API keys, JWT secret | Render environment variables, never in code | Until rotation |

### 3.2 Data Protection in Transit

| Layer | Requirement | Status |
|---|---|---|
| Client-to-backend (production) | TLS 1.2 minimum, TLS 1.3 preferred | ✅ (Render HTTPS) |
| Client-to-backend (development) | Localhost (HTTP) | ⚠️ **Acceptable for dev only** |
| Backend-to-Supabase | TLS (enforced by Supabase) | ✅ |
| Backend-to-TomTom API | HTTPS | ✅ |
| Backend-to-OilPriceAPI | HTTPS | ✅ |
| Backend-to-OSRM / Nominatim | HTTPS | ✅ |
| HSTS header | `Strict-Transport-Security: max-age=31536000; includeSubDomains` | ❌ Missing |
| HTTP→HTTPS redirect | Required | ❌ Missing |

### 3.3 Data Protection at Rest

| Component | Protection | Status |
|---|---|---|
| PostgreSQL (Supabase) | AES-256 encryption at rest (managed by Supabase) | ✅ |
| Password hashes | bcrypt with cost factor 12 | ✅ |
| JWT signing key | Environment variable | ⚠️ **Has insecure fallback** |
| API keys (third-party) | Environment variables only | ⚠️ **One key committed to repo** |
| Database backups | Supabase automated backups (point-in-time recovery) | ✅ |
| Local SQLite fallback | No encryption | ⚠️ **Avoid in production** |

### 3.4 Data Retention & Deletion

| Data Type | Retention Policy | Deletion Mechanism |
|---|---|---|
| User account & profile | Until account deletion request + 90 days grace period | Hard delete from `users` table; cascade to `surveys`, `push_tokens` |
| Survey responses | Until associated user account deletion + 90 days | Cascade delete on `surveys.user_id` (ensure ON DELETE CASCADE is set) |
| Fuel price data | Indefinite (historical reference) | Not deleted |
| Forecast data | Indefinite | Not deleted |
| Push tokens | Until deregistration or 90 days of inactivity | Delete on deregistration request or stale token cleanup job |
| Application logs | 30 days (production) | Log rotation |
| Error logs | 90 days | Log rotation |
| API request logs | 30 days | Log rotation |

### 3.5 GDPR & Data Protection Act 2017 (Mauritius) Compliance

| Right | Implementation Status | Required Action |
|---|---|---|
| Right to be informed | ❌ Missing | Add privacy policy, data processing notice at registration |
| Right of access | ⚠️ Partial | User can view own profile, surveys. No data export endpoint. |
| Right to rectification | ❌ Missing | No profile editing endpoint |
| Right to erasure | ❌ Missing | No account deletion endpoint |
| Right to restrict processing | ❌ Missing | Implement account freeze mechanism |
| Right to data portability | ❌ Missing | Add `/api/user/export` endpoint producing JSON |
| Right to object | ❌ Missing | Add opt-out mechanism (e.g., marketing, analytics) |
| Breach notification | ❌ Missing | Document breach response procedure (see §9) |

---

## 4. API Security

### 4.1 Security Headers

All API responses **must** include the following headers. These should be set via a FastAPI middleware.

| Header | Value | Purpose |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforce HTTPS for 1 year |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter (XSS auditor) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | `geolocation=(self), camera=(), microphone=(), payment=()` | Restrict browser features |
| `Content-Security-Policy` | See §4.1.1 | Prevent XSS and data injection |
| `Cache-Control` | `no-store` (for authenticated endpoints) | Prevent caching of sensitive data |

#### 4.1.1 Content-Security-Policy (Backend API)

```http
Content-Security-Policy: default-src 'self'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

The API does not serve HTML, so `script-src: 'none'` and `frame-ancestors: 'none'` are appropriate.

#### 4.1.2 Implementation (FastAPI Middleware)

```python
# backend/middleware/security_headers.py

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(self), camera=(), microphone=(), payment=()"
        )

        # Only apply CSP to non-API responses if applicable
        if not request.url.path.startswith("/api"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; script-src 'none'; object-src 'none'; "
                "base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
            )

        # Do not cache authenticated responses
        if request.headers.get("authorization"):
            response.headers["Cache-Control"] = "no-store"

        return response
```

### 4.2 CORS Configuration

**⚠️ CURRENTLY INSECURE**: The application uses `allow_origins=["*"]` with `allow_credentials=True`, which is forbidden by the CORS specification and browser behavior is unpredictable.

#### Required Configuration

```python
# backend/main.py

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://astraflow.vercel.app",       # Production frontend
        "https://astraflow-api.onrender.com",  # Production API (for any web UI served from here)
        "http://localhost:8081",               # Local Expo dev (web)
        "http://localhost:19006",              # Local Expo dev (alternative port)
        "exp://192.168.*.*:8081",             # Expo Go on LAN (wildcard not supported,
                                              #   list specific IPs or use a proxy)
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "X-Requested-With",
    ],
    expose_headers=[
        "X-Request-ID",      # For request tracing
        "X-RateLimit-*",     # Rate limit headers
    ],
    max_age=600,  # Cache preflight for 10 minutes
)
```

**Note**: `allow_origins=["*"]` must never be used with `allow_credentials=True`. There is a known limitation with CORS and the `*` wildcard for credentials — most modern browsers will reject credentialed requests when `Access-Control-Allow-Origin: *` is set.

### 4.3 Rate Limiting

Rate limiting **must** be implemented on all endpoints, with stricter limits on authentication endpoints.

| Endpoint Group | Rate Limit | Burst | Window | Justification |
|---|---|---|---|---|
| `POST /api/auth/login` | 5 requests | 10 | 15 minutes | Prevent brute-force password guessing |
| `POST /api/auth/register` | 3 requests | 5 | 60 minutes | Prevent account creation abuse |
| `POST /api/auth/refresh` | 10 requests | 20 | 15 minutes | Prevent token refresh abuse |
| `GET /api/predict` | 60 requests | 100 | 1 minute | Standard API rate |
| `GET /api/forecast` | 30 requests | 50 | 1 minute | ML endpoint (compute cost) |
| All other authenticated | 120 requests | 200 | 1 minute | Standard API rate |
| `GET /api/health` | No limit | — | — | Monitoring endpoints |
| Anonymous (no token) | 10 requests | 20 | 1 minute | Prevent unauthenticated abuse |

#### Implementation (using `slowapi`)

```python
# backend/middleware/rate_limit.py

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.responses import JSONResponse

limiter = Limiter(key_func=get_remote_address)

# Register with FastAPI
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Per-endpoint usage:
@router.post("/auth/login")
@limiter.limit("5/15minutes")
async def login(request: Request, credentials: LoginRequest):
    ...

@router.post("/auth/register")
@limiter.limit("3/60minutes")
async def register(request: Request, user_data: RegisterRequest):
    ...
```

### 4.4 Input Validation

All input **must** be validated at the API boundary using Pydantic models. The following rules apply:

| Field | Validation Rule | Location | Status |
|---|---|---|---|
| Email | `EmailStr` type (validates format + domain), max 254 chars | Pydantic model | ⚠️ **Uses plain `str` in some models** |
| Password | Min 8 chars, max 128 chars, complexity requirements (see §2.2) | Pydantic model + business logic | ❌ Missing |
| Full name | Min 1 char, max 100 chars, alphanumeric + spaces + hyphens + apostrophes only | Pydantic model | ❌ Missing |
| Business type | Enum validation (`restaurant`, `taxi`, `delivery`, `retail`, `logistics`) | Pydantic model | ✅ |
| Liters (predict) | `float`, `gt=0`, max 1,000,000 | Pydantic model | ✅ |
| Forecast days | `int`, `ge=7`, `le=90` | Pydantic model | ✅ |
| Gas station radius | `float`, `ge=0.5`, `le=50` | Pydantic model | ✅ |
| Survey comments | Max 2000 chars, no HTML tags | Pydantic model + sanitization | ❌ Missing |
| News content | Max 50000 chars | Pydantic model | ❌ Missing |
| News title | Max 200 chars | Pydantic model | ❌ Missing |
| Push token | Non-empty string, max 500 chars | Pydantic model | ❌ Missing |

#### Input Validation Implementation Guide

```python
# backend/models/validators.py

from pydantic import BaseModel, EmailStr, field_validator
import re

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    business_type: BusinessType

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must not exceed 128 characters")

        # Check character class diversity
        categories = 0
        if re.search(r"[A-Z]", v): categories += 1
        if re.search(r"[a-z]", v): categories += 1
        if re.search(r"[0-9]", v): categories += 1
        if re.search(r"[!@#$%^&*()_+\-=\[\]{}|;':\",./<>?`~]", v): categories += 1

        if categories < 3:
            raise ValueError(
                "Password must contain at least 3 of: uppercase, lowercase, "
                "digits, special characters"
            )
        return v

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        if len(v) < 1:
            raise ValueError("Full name is required")
        if len(v) > 100:
            raise ValueError("Full name must not exceed 100 characters")
        if not re.match(r"^[a-zA-ZÀ-ÿ '-]+$", v):
            raise ValueError("Full name contains invalid characters")
        return v.strip()
```

### 4.5 Output Encoding & XSS Prevention

User-supplied data that is rendered in the frontend **must** be encoded to prevent XSS. This includes:

- Survey comments
- User full names (displayed in profile)
- News content (though admin-controlled, still encode)
- Business names (if added in future)

#### Frontend (React Native / Expo)

For React Native, use `Text` component (auto-escapes). For Web views:

```typescript
// In any WebView usage, sanitize HTML:
import DOMPurify from 'dompurify';

const sanitized = DOMPurify.sanitize(userContent, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
  ALLOWED_ATTR: ['href'],
});
```

For API responses that return user-supplied text, ensure the frontend never uses `dangerouslySetInnerHTML` or equivalent without sanitization.

### 4.6 Error Handling & Information Disclosure

| Scenario | Current Behavior | Required Behavior |
|---|---|---|
| Invalid email during login | `"Invalid email or password"` | ✅ **Acceptable** (does not reveal if email exists) |
| Valid email, wrong password | `"Invalid email or password"` | ✅ **Acceptable** (same message as above) |
| Email already registered | `"Email already registered"` | ❌ **Reveals email existence** |
| Database connection failure | FastAPI 500 error with traceback | ❌ **Must return generic error** |
| Invalid token format | JWT exception details | ❌ **Must return generic 401** |
| Missing required field | Pydantic validation error with field names | ✅ **Acceptable** (necessary for development) |

#### Required Error Response Format

```json
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "request_id": "req_abc123"
  }
}
```

Never include:
- Stack traces
- Database query details
- Internal IP addresses or hostnames
- File system paths
- Environment variable names or values

#### Implementation

```python
# backend/middleware/error_handler.py

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

async def global_error_handler(request: Request, exc: Exception) -> JSONResponse:
    # Log full details internally
    logger.error(
        "Unhandled exception",
        exc_info=exc,
        extra={
            "path": request.url.path,
            "method": request.method,
            "request_id": request.headers.get("X-Request-ID", "unknown"),
        },
    )

    # Return generic message to client
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please try again later.",
                "request_id": request.headers.get("X-Request-ID", "unknown"),
            }
        },
    )
```

---

## 5. Infrastructure Security

### 5.1 Environment & Secrets Management

#### Current Status

| Secret | Location | Type | Status |
|---|---|---|---|
| `DATABASE_URL` | `backend/.env` (committed to git) | PostgreSQL connection string with password | ❌ **CRITICAL — EXPOSED** |
| `SECRET_KEY` | `backend/.env` (committed to git) | Supabase secret / JWT signing key | ❌ **CRITICAL — EXPOSED** |
| `TOMTOM_API_KEY` | `backend/.env` (committed to git) | Third-party API key | ❌ **CRITICAL — EXPOSED** |
| `OIL_PRICE_API_KEY` | Not in `.env` | Third-party API key | ✅ Not in repo |
| `DATABASE_URL` (prod) | Render dashboard env vars | PostgreSQL connection string | ✅ Not in repo |
| `SECRET_KEY` (prod) | Render dashboard env vars | JWT signing key | ✅ Not in repo |

#### Immediate Remediation Required

1. **Rotate ALL exposed credentials immediately**:
   - Reset Supabase database password
   - Regenerate Supabase `service_role` secret
   - Regenerate TomTom API key

2. **Remove `.env` from git tracking**:
   ```bash
   # Remove from git index (without deleting the file)
   git rm --cached backend/.env

   # Verify with .gitignore already covering .env
   # Add to .gitignore if not present (already done — line 38)
   ```

3. **Force push to remove from history** (coordinate with all collaborators):
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch backend/.env" \
     --prune-empty --tag-name-filter cat -- --all
   git push origin --force --all
   ```

#### Secrets Management Guidelines

| Rule | Description |
|---|---|
| **No secrets in code** | Never hardcode secrets, API keys, passwords, tokens, or connection strings |
| **No secrets in git** | Never commit secrets to any branch. Use `.gitignore` and pre-commit hooks. |
| **Environment variables only** | All secrets injected via environment variables at deploy time |
| **Use `.env.example`** | Provide a template with placeholder values (never real secrets) |
| **Production vs development** | Use different secrets for each environment |
| **Rotation schedule** | Rotate all secrets every 90 days |
| **Emergency rotation** | Rotate immediately upon suspicion of exposure |

#### `.env.example` Template

```bash
# backend/.env.example

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# JWT
SECRET_KEY=your-secret-key-min-256-bits

# Third-party APIs
TOMTOM_API_KEY=your-tomtom-api-key
OIL_PRICE_API_KEY=your-oilpriceapi-key

# Application
ENVIRONMENT=development
LOG_LEVEL=INFO
```

### 5.2 Deployment Security

#### Render (Backend)

| Control | Requirement | Status |
|---|---|---|
| Secrets via env vars | `sync: false` in `render.yaml` | ✅ Correct |
| Health check endpoint | `GET /api/health` | ✅ |
| Docker image | Multi-stage build, minimal base image (python:3.12-slim) | ✅ |
| Non-root user | Run as non-root user in container | ⚠️ Verify |
| Port binding | 0.0.0.0:8000 (required for Render) | ✅ Acceptable |
| Auto-deploy | Only from `main` branch via GitHub Actions | ✅ |
| Version pinning | Pin base image digest, not just tag | ⚠️ Use `python:3.12-slim@sha256:...` |

#### Vercel (Frontend)

| Control | Requirement | Status |
|---|---|---|
| Environment variables | API URL, no secrets exposed to client | ✅ |
| Build output | Static files, no server-side secrets | ✅ |
| Deploy previews | PR previews use staging env | ✅ |
| CSP headers | Configured in `vercel.json` | ❌ Missing |

### 5.3 Network Security

| Control | Requirement | Status |
|---|---|---|
| TLS termination | Render manages TLS at edge | ✅ |
| Database network isolation | Supabase database allows connections from Render IPs only | ⚠️ Verify IP restrictions |
| API exposed to internet | Required by design | ✅ Acceptable |
| WAF / DDoS protection | Render provides basic DDoS protection | ✅ |
| IP allowlisting (admin) | Admin endpoints accessible from any authenticated user | ❌ Consider VPN/IP restriction |
| Internal services | No internal-only endpoints | ✅ |

### 5.4 Logging & Monitoring

#### Logging Requirements

| Event Type | Log Level | Data to Log | Retention |
|---|---|---|---|
| Authentication success | INFO | User ID, timestamp, IP, user-agent | 90 days |
| Authentication failure | WARNING | Email (hashed), timestamp, IP, reason | 90 days |
| Authorization failure | WARNING | User ID, attempted resource, timestamp | 90 days |
| API request (non-auth) | DEBUG | Method, path, status, duration, request ID | 30 days |
| Database errors | ERROR | Query (sanitized), error type, timestamp | 90 days |
| Third-party API failures | ERROR | Service name, status code, timestamp | 90 days |
| Rate limit exceeded | WARNING | IP, endpoint, timestamp | 30 days |
| Application errors | ERROR | Error type, stack trace (internal), request ID | 90 days |

#### Structured Logging Implementation

```python
# backend/middleware/logging.py

import structlog

logger = structlog.get_logger("astraflow")

# In any handler:
logger.info(
    "user_login",
    user_id=str(user.id),
    ip=request.client.host,
    user_agent=request.headers.get("user-agent"),
)
```

**Never log**:
- Password values (even hashed)
- JWT tokens
- API keys or secrets
- Full database connection strings
- Raw SQL queries containing user data

#### Monitoring & Alerting

| Monitor | Tool/Method | Threshold | Action |
|---|---|---|---|
| 5xx error rate | Render dashboard / uptime monitor | > 1% in 5 minutes | Alert on-call |
| 401/403 rate spike | Log analysis | > 100/min | Investigate possible attack |
| Failed logins per IP | Log analysis | > 10 in 15 minutes | Rate limiting should block; alert if bypassed |
| Database connection pool | Render dashboard | > 80% utilization | Scale connection pool |
| API response time | Render dashboard | p99 > 5 seconds | Investigate bottleneck |

---

## 6. Dependency & Supply Chain Security

### 6.1 Dependency Audit

All dependencies **must** be audited before being added to the project.

#### Python (Backend)

| Dependency | Version | Purpose | Audit Status |
|---|---|---|---|
| `fastapi` | 0.115.x | Web framework | ✅ Active, well-maintained |
| `uvicorn` | 0.34.x | ASGI server | ✅ |
| `sqlalchemy` | 2.0.x | ORM | ✅ |
| `passlib[bcrypt]` | 1.7.x | Password hashing | ⚠️ **1.7.4 is final release, unmaintained since 2022. Consider `bcrypt` directly.** |
| `python-jose[cryptography]` | 3.5.x | JWT | ✅ |
| `python-multipart` | 0.0.32 | Form parsing | ⚠️ Ensure latest patch |
| `httpx` | 0.28.x | HTTP client | ✅ |
| `scikit-learn` | 1.5.x | ML | ✅ |
| `numpy` | 1.26.x | Numerical | ✅ |
| `pandas` | 2.x | Data processing | ✅ |
| `alembic` | 1.14.x | Migrations | ✅ |
| `slowapi` | — | Rate limiting | ⚠️ Need to add |
| `structlog` | — | Structured logging | ⚠️ Need to add |

#### JavaScript/TypeScript (Frontend)

| Dependency | Version | Purpose | Audit Status |
|---|---|---|---|
| `expo` | ~56.0.9 | Framework | ✅ Latest SDK |
| `react-native` | 0.85.x | Native runtime | ✅ |
| `expo-secure-store` | Latest | Secure token storage | ✅ |
| `expo-router` | Latest | Routing | ✅ |
| `@gluestack-ui/*` | Latest | UI components | ✅ |
| `nativewind` | Latest | Styling | ✅ |
| `react-native-webview` | 13.16.1 | Web views | ⚠️ **XSS vector if not sanitized** |

### 6.2 Automated Scanning

| Scan Type | Tool | Frequency | Integrated In |
|---|---|---|---|
| Dependency vulnerabilities | `npm audit` / `pip-audit` | Every PR | CI pipeline (to be added) |
| Static analysis (Python) | `bandit` | Every PR | CI pipeline (to be added) |
| Static analysis (JS) | `eslint-plugin-security` | Every PR | CI pipeline (to be added) |
| SAST | `Semgrep` or `SonarCloud` | Weekly | CI pipeline (to be added) |
| Secret scanning | `trufflehog` or `git-secrets` | Every push | Pre-commit hook (to be added) |
| Container scanning | `trivy` or `grype` | Every deploy | CI pipeline (to be added) |
| License compliance | `license-checker` | Monthly | CI pipeline (to be added) |

### 6.3 Pre-Commit Hooks

Recommended `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: detect-private-key
      - id: check-added-large-files
      - id: check-merge-conflict
      - id: end-of-file-fixer
      - id: trailing-whitespace

  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

  - repo: https://github.com/PyCQA/bandit
    rev: 1.7.9
    hooks:
      - id: bandit
        args: ["-r", "backend/"]
        files: ^backend/

  - repo: https://github.com/pre-commit/mirrors-eslint
    rev: v9.0.0
    hooks:
      - id: eslint
        args: ["--config", ".eslintrc.js"]
        additional_dependencies:
          - eslint-plugin-security
```

---

## 7. Frontend Security

### 7.1 Token Storage

| Platform | Storage Mechanism | Security | Risk |
|---|---|---|---|
| iOS (native) | Keychain via `expo-secure-store` | ✅ Encrypted at rest, accessible only by app | Low |
| Android (native) | Keystore via `expo-secure-store` | ✅ Encrypted at rest, hardware-backed on supported devices | Low |
| Web | `localStorage` | ❌ Plaintext, accessible to any JS on the same origin | **High** — XSS vulnerable |

#### Mitigation for Web

For web deployment, prefer **HttpOnly cookies** for token storage instead of `localStorage`:

```typescript
// src/services/auth.ts — Alternative approach for web

// Login: set cookie via backend (HttpOnly, Secure, SameSite=Strict)
// The backend sets:
//   Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=604800
//   Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=900
```

If cookies are not feasible, implement these mitigations:

1. **Short token lifetime**: Access tokens expire in 15 minutes (reducing XSS window)
2. **Content Security Policy**: Strict CSP blocks inline script injection
3. **Subresource Integrity**: For any loaded scripts
4. **No sensitive data in localStorage**: Only the access token; refresh token should be HttpOnly cookie
5. **Clear on logout**: Ensure `localStorage.removeItem(TOKEN_KEY)` on logout

### 7.2 WebView Security

If using `react-native-webview`:

```typescript
// WebView must NOT allow JavaScript execution from untrusted sources
<WebView
  source={{ uri: trustedUrl }}
  javaScriptEnabled={false}  // Disable unless absolutely needed
  allowFileAccess={false}
  allowUniversalAccessFromFileURLs={false}
  mixedContentMode="never"
  onMessage={handleMessage}
/>
```

### 7.3 Deep Linking

Expo Router handles deep links. Ensure:

- Validate incoming deep links against an allowlist of schemes and hosts
- Never pass raw URL data from deep links directly to WebView or navigation
- Log and monitor unexpected deep link patterns

### 7.4 API URL Configuration

```typescript
// src/config.ts

const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("EXPO_PUBLIC_API_URL is not defined");
}

if (__DEV__ && API_URL.startsWith("http://")) {
  console.warn("API is using HTTP in development. Ensure HTTPS in production.");
}
```

---

## 8. ML Model Security

### 8.1 Model Integrity

| Risk | Description | Mitigation |
|---|---|---|
| Data poisoning | Malicious data in training set skews forecasts | Validate all training data sources; use historical data from trusted sources only |
| Model theft | Unauthorized access to trained model weights | Store model files in secure, access-controlled storage |
| Adversarial inputs | Specially crafted inputs cause incorrect forecasts | Input validation on prediction requests (bounds checking) |

### 8.2 Training Data Security

- Training data is sourced from:
  - Historical fuel prices (manually verified, government-sourced data)
  - User survey data (aggregated, anonymized)
  - OilPriceAPI (external, trusted API)
- All training data **must** be anonymized before use — no PII in training features
- Training pipeline runs in isolated environment (Docker container with no internet access)

### 8.3 Model Serving

```python
# The /api/forecast endpoint must:
# 1. Validate all input parameters (fuel type, days range)
# 2. Set reasonable bounds on output (no negative prices, no astronomical values)
# 3. Log prediction requests for monitoring
# 4. Never expose internal model parameters in responses
```

---

## 9. Incident Response Plan

### 9.1 Incident Classification

| Severity | Definition | Response Time | Examples |
|---|---|---|---|
| **SEV-1 (Critical)** | Active data breach, compromised credentials, service outage | < 1 hour | Database leaked, JWT secret compromised, app unavailable |
| **SEV-2 (High)** | Exploitable vulnerability, partial data exposure | < 4 hours | XSS vulnerability, authentication bypass, rate limit bypass |
| **SEV-3 (Medium)** | Security misconfiguration, minor info disclosure | < 24 hours | CORS misconfiguration, verbose error messages, missing headers |
| **SEV-4 (Low)** | Best-practice deficiency, no active exploit | < 1 week | Weak password policy, missing HSTS, outdated dependency |

### 9.2 Response Procedure

#### Phase 1: Detection & Triage (0–1 hour)

1. **Identify**: Confirm the incident. Where did it occur? What is affected?
2. **Classify**: Assign severity (SEV-1 through SEV-4).
3. **Contain**: For SEV-1/SEV-2, apply immediate containment:
   - Rotate affected credentials/keys
   - Disable affected user accounts
   - Block offending IPs at the network level
   - Take affected services offline if necessary
4. **Notify**: Alert the development team via designated communication channel.
5. **Document**: Create an incident ticket with all known details.

#### Phase 2: Investigation (1–4 hours)

1. **Determine scope**: What data was accessed? Which users are affected?
2. **Identify root cause**: How did the incident occur?
3. **Preserve evidence**: Collect logs, snapshots, and other forensic data.
4. **Timeline**: Reconstruct the sequence of events.

For SEV-1 incidents involving PII:
- Notify the Data Protection Office (Mauritius) within 72 hours as required by the Data Protection Act 2017.
- Notify affected users within 72 hours.

#### Phase 3: Remediation (4–48 hours)

1. **Fix root cause**: Deploy the security fix.
2. **Validate**: Verify the fix works and no regressions.
3. **Restore**: Bring affected services back online.
4. **Monitor**: Increase monitoring for 48 hours post-remediation.

#### Phase 4: Post-Mortem (within 1 week)

1. **Write incident report**: Include timeline, root cause, impact, remediation steps.
2. **Implement preventive measures**: Add tests, monitoring, or process changes.
3. **Review and update**: Update this security policy if needed.

### 9.3 Communication Plan

| Audience | When | What | Who |
|---|---|---|---|
| Development team | Immediately upon SEV-1/SEV-2 detection | Incident details, containment status | On-call engineer |
| Users | Within 72 hours for PII breach (legal requirement) | Breach notification, recommended actions | Project lead |
| Public | After containment for SEV-1 incidents | Public disclosure if required | Project lead |
| Regulators | Within 72 hours for PII breach | Formal incident report | Project lead |

### 9.4 Contact Information

| Role | Contact |
|---|---|
| Security lead | [Designated security team member] |
| Incident response | [On-call rotation email/phone] |
| Emergency (SEV-1) | [Emergency contact] |
| Data Protection Officer | [DPO email] |

---

## 10. Known Security Issues & Roadmap

### 10.1 Current Known Issues

| ID | Issue | Severity | Status | Target Fix |
|---|---|---|---|---|
| SEC-001 | `.env` credentials committed to git history | **CRITICAL** | Open | Rotate credentials immediately + `git filter-branch` |
| SEC-002 | CORS allows all origins (`*`) with credentials | **HIGH** | Open | Restrict to specific origins |
| SEC-003 | JWT expiry is 30 days (excessively long) | **HIGH** | Open | Reduce to 15 minutes + add refresh tokens |
| SEC-004 | No rate limiting on any endpoint | **HIGH** | Open | Implement `slowapi` with per-endpoint limits |
| SEC-005 | No admin role check on `/api/prices/admin` | **HIGH** | Open | Add RBAC middleware |
| SEC-006 | Email enumeration via register endpoint | **MEDIUM** | Open | Return generic error message |
| SEC-007 | Missing security headers (HSTS, CSP, etc.) | **MEDIUM** | Open | Add middleware |
| SEC-008 | `localStorage` for JWT on web platform | **MEDIUM** | Open | Migrate to HttpOnly cookies |
| SEC-009 | No password strength validation server-side | **MEDIUM** | Open | Add Pydantic validators |
| SEC-010 | No HTTPS redirect or HSTS | **MEDIUM** | Open | Configure at Render/reverse proxy level |
| SEC-011 | SQL injection risk in `supabase_migrate.py` | **LOW** | Open | Rewrite with parameterized queries |
| SEC-012 | No input length limits on string fields | **LOW** | Open | Add max-length validators |
| SEC-013 | `passlib` is unmaintained (1.7.4 final release) | **LOW** | Open | Migrate to `bcrypt` directly |
| SEC-014 | No account deletion/data export endpoints | **LOW** | Open | Implement for GDPR compliance |
| SEC-015 | Free-text survey comments could contain PII | **LOW** | Open | Add sanitization and PII detection |

### 10.2 Security Roadmap

| Quarter | Milestone | Issues Addressed |
|---|---|---|
| Q3 2026 | **Critical fixes** | SEC-001, SEC-002, SEC-003, SEC-004, SEC-005 |
| Q3 2026 | **Auth hardening** | SEC-006, SEC-008, SEC-009 |
| Q4 2026 | **Infrastructure security** | SEC-007, SEC-010, SEC-011 |
| Q4 2026 | **Compliance readiness** | SEC-014, SEC-015 |
| Q1 2027 | **Continuous improvement** | SEC-012, SEC-013, dependency updates |
| Q1 2027 | **Security automation** | CI/CD scanning, pre-commit hooks |

### 10.3 Security Testing Schedule

| Test Type | Frequency | Responsibility |
|---|---|---|
| Dependency audit (`npm audit`, `pip-audit`) | Weekly | Dev team |
| Secret scanning | Every push (pre-commit) | Dev team |
| Static analysis (SAST) | Every PR | CI pipeline |
| Penetration testing | Annually | External security firm |
| Vulnerability assessment | Quarterly | Dev team |
| Code review (security-focused) | Every PR | Dev team |
| Dependency update review | Monthly | Dev team |

---

## 11. Reporting Vulnerabilities

### 11.1 Responsible Disclosure Policy

If you discover a security vulnerability in AstraFlow, please follow this disclosure process:

1. **Do NOT** open a public GitHub issue.
2. **Do NOT** post the vulnerability in public forums, chat channels, or social media.
3. **Email** the details to [security contact email — to be established].
4. Allow up to **72 hours** for an initial response.
5. Allow up to **90 days** for remediation before public disclosure (coordinated disclosure).

### 11.2 What to Include

- **Description**: What is the vulnerability and where does it occur?
- **Severity**: What is the potential impact?
- **Steps to reproduce**: Detailed steps, including any code snippets or requests.
- **Proof of concept**: If possible, a minimal demonstration.
- **Suggested fix**: If you have one, please include it.
- **Your contact**: For follow-up questions.

### 11.3 Scope

| In Scope | Out of Scope |
|---|---|
| API endpoints and authentication | Third-party services (Supabase, Render, Vercel) — report to their respective teams |
| Frontend token storage and XSS | Physical security of infrastructure |
| Database security and data leakage | Social engineering of team members |
| Dependency vulnerabilities | Outdated browser issues |
| CORS and security headers | Issues requiring physical access to devices |

### 11.4 Recognition

We maintain a security hall of fame for researchers who report valid vulnerabilities. With your permission, we will acknowledge your contribution.

---

## 12. Security Checklist for Development

### 12.1 Pre-Commit Checklist

Before every commit, verify:

- [ ] No secrets, passwords, or API keys in the code
- [ ] No `.env` files staged for commit
- [ ] No commented-out debug code or `console.log`/`print()` statements
- [ ] No `TODO`, `FIXME`, or `HACK` comments related to security
- [ ] No `allow_origins=["*"]` in CORS configuration
- [ ] No `debug=True` in FastAPI
- [ ] No hardcoded URLs or IPs
- [ ] All new endpoints have appropriate auth/role checks
- [ ] All user input is validated (Pydantic models)
- [ ] All new dependencies have been security-audited
- [ ] Pre-commit hooks pass (if configured)

### 12.2 Pre-Release Checklist

Before every deployment:

- [ ] All SEV-1/SEV-2 issues are resolved or have an approved exception
- [ ] Dependency audit shows no critical vulnerabilities
- [ ] JWT secret is unique per environment (dev/staging/production)
- [ ] CORS origins are restricted to required domains
- [ ] Rate limiting is configured for auth endpoints
- [ ] Security headers are present in API responses
- [ ] HTTPS is enforced (production)
- [ ] HSTS is configured
- [ ] Database credentials are scoped to minimum required permissions
- [ ] Logging is configured (no sensitive data in logs)
- [ ] Error handling returns generic messages (no stack traces)
- [ ] Frontend API URL points to production HTTPS endpoint
- [ ] All third-party API keys are valid and not expired
- [ ] Monitoring and alerting are configured

### 12.3 Code Review Security Questions

For every pull request, reviewers should ask:

1. **Data flow**: What new data is being collected or transmitted? Is it necessary?
2. **Authentication**: Does this change affect auth? Are tokens handled correctly?
3. **Authorization**: Are role checks in place for protected operations?
4. **Input validation**: Are all new input fields validated? What about edge cases?
5. **Output encoding**: Is user-supplied data rendered safely in the frontend?
6. **Error handling**: Do errors leak sensitive information?
7. **Dependencies**: Are any new packages introduced? Have they been audited?
8. **Logging**: Is sensitive data being logged?
9. **Configuration**: Are environment variables properly named and documented?
10. **Testing**: Are there tests for security-relevant behavior?

---

## Appendix A: Security-Related File Locations

| File | Purpose |
|---|---|
| `backend/.env` | ⚠️ Local secrets (DO NOT COMMIT — already committed, needs purging) |
| `backend/.env.example` | Template for local secrets (no real values) |
| `backend/main.py` | FastAPI app configuration, CORS, middleware setup |
| `backend/services/auth.py` | JWT creation and validation, password hashing |
| `backend/routes/auth.py` | Registration and login endpoints |
| `backend/routes/dashboard.py` | Protected endpoints, `get_current_user` dependency |
| `backend/middleware/` | Security middleware (proposed location) |
| `src/services/auth.ts` | Frontend token storage and auth API calls |
| `src/app/register.tsx` | Registration form (client-side validation) |
| `src/app/login.tsx` | Login form (client-side validation) |
| `.gitignore` | File patterns to exclude from git |
| `render.yaml` | Render deployment configuration (env vars marked `sync: false`) |
| `AGENTS.md` | Development agent instructions |

## Appendix B: Useful Commands

```bash
# Audit Python dependencies for known vulnerabilities
pip-audit

# Audit JavaScript dependencies
npm audit

# Scan for secrets in git history
gitleaks detect --source .

# Static analysis for Python security issues
bandit -r backend/

# Scan Docker image for vulnerabilities
trivy image astraflow-api:latest

# Check for exposed secrets (alternative to gitleaks)
trufflehog filesystem --directory .

# Generate a secure random key (256-bit, for JWT)
python -c "import secrets; print(secrets.token_hex(32))"

# Verify no .env is tracked by git
git ls-files | grep .env
```

## Appendix C: References

- [OWASP Top 10 (2021)](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Mauritius Data Protection Act 2017](https://dataprotection.govmu.org/)
- [FastAPI Security Documentation](https://fastapi.tiangolo.com/tutorial/security/)
- [Expo Security Documentation](https://docs.expo.dev/guides/security/)
- [Supabase Security Documentation](https://supabase.com/docs/guides/security)
- [Render Security Practices](https://render.com/docs/security)
- [Python Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Python_Security_Cheat_Sheet.html)

---

*This document is a living document and should be reviewed and updated quarterly, or immediately following any security incident.*
