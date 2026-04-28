> Last Updated: 2026-04-21

# API Client Setup

> The complete axios configuration for the backoffice frontend including cookies, org context, error handling, and refresh interceptor.

---

## Base Setup

```ts
// src/api/client.ts
import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,        // REQUIRED — sends HttpOnly cookies cross-origin
  headers: {
    'Content-Type': 'application/json',
  },
})
```

`withCredentials: true` is the single most important setting. Without it, the browser will not send cookies and every request will be treated as unauthenticated.

---

## Setting Org Context

```ts
// Called after login or org selection
export function setActiveOrg(orgId: string) {
  apiClient.defaults.headers.common['X-ORG-ID'] = orgId
}

export function clearActiveOrg() {
  delete apiClient.defaults.headers.common['X-ORG-ID']
}
```

---

## Response Interceptor — Token Refresh + Error Handling

```ts
// src/api/interceptors.ts
import { apiClient } from './client'
import { redirectToLogin, clearAppState } from '../auth/state'

let isRefreshing = false
let refreshQueue: Array<(success: boolean) => void> = []

function processQueue(success: boolean) {
  refreshQueue.forEach(cb => cb(success))
  refreshQueue = []
}

// Hard logout error codes — no retry, go to login
const HARD_LOGOUT_CODES = new Set([
  'SESSION_INVALIDATED',
  'REFRESH_TOKEN_EXPIRED',
  'ACCOUNT_DISABLED',
  'SESSION_DEVICE_MISMATCH',
])

apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config
    const errorCode: string | undefined = error.response?.data?.errorCode

    if (!errorCode) return Promise.reject(error)

    // Hard logout
    if (HARD_LOGOUT_CODES.has(errorCode)) {
      clearAppState()
      redirectToLogin()
      return Promise.reject(error)
    }

    // Org access errors — redirect to org picker
    if (errorCode === 'INVALID_ORG_CONTEXT' || errorCode === 'INACTIVE_ORG') {
      redirectToOrgPicker()
      return Promise.reject(error)
    }

    // Silent token refresh
    if (errorCode === 'TOKEN_EXPIRED' && !originalRequest._retried) {
      originalRequest._retried = true

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((success) => {
            if (success) resolve(apiClient(originalRequest))
            else reject(error)
          })
        })
      }

      isRefreshing = true
      try {
        await apiClient.post('/auth/refresh')
        processQueue(true)
        return apiClient(originalRequest)
      } catch {
        processQueue(false)
        clearAppState()
        redirectToLogin()
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)
```

---

## TypeScript Types

```ts
// src/api/types.ts

export interface ApiResponse<T = unknown> {
  success: boolean
  data: T | null
  message: string | null
  errorCode: string | null
}

export interface PagedResponse<T = unknown> {
  success: boolean
  data: {
    content: T[]
    page: number
    size: number
    totalElements: number
    totalPages: number
  } | null
  message: string | null
  errorCode: string | null
}

export interface OrgSummary {
  id: string
  name: string
  slug: string
}

export interface LoginResponseData {
  userId: string
  email: string
  orgContext: {
    currentOrg: OrgSummary | null
    orgs: OrgSummary[]
  }
}
```

---

## Environment Variables

```env
# .env.local (local dev)
VITE_API_BASE_URL=http://localhost:8008

# .env.staging (local → staging via proxy)
VITE_API_BASE_URL=

# .env.production
VITE_API_BASE_URL=
```

---

## Initialization Order

```ts
// src/main.ts or app entry point

// 1. Create API client (withCredentials already set)
// 2. Register interceptors
// 3. Check if user is already authenticated (call GET /auth/me or similar)
//    → If 401 → show login
//    → If 200 → restore session, set X-ORG-ID from stored org
// 4. Mount app
```

The app should always check auth state on load — the access token cookie may still be valid from a previous session. Never assume logged-out on page refresh.

---

## Pagination Helper

```ts
export interface PaginationParams {
  page?: number   // 0-indexed, default 0
  size?: number   // default 20, max 100
}

// Usage
const response = await apiClient.get<PagedResponse<Member>>('/members', {
  params: { page: 0, size: 20, status: 'ACTIVE' }
})
```
