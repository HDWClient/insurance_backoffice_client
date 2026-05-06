import axios from "axios";

// ── Base client ────────────────────────────────────────────
// withCredentials is REQUIRED — tells the browser to send HttpOnly cookies.
// Never store or manually attach tokens; the browser handles cookies automatically.
const AxiosUtils = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ── Org context ────────────────────────────────────────────
// Call setActiveOrg(id) after login or org switch.
// Call clearActiveOrg() on logout or org switch.
export function setActiveOrg(orgId) {
  AxiosUtils.defaults.headers.common["X-ORG-ID"] = orgId;
}

export function clearActiveOrg() {
  delete AxiosUtils.defaults.headers.common["X-ORG-ID"];
}

// ── Token refresh queue ────────────────────────────────────
// Multiple concurrent requests can fail with TOKEN_EXPIRED simultaneously.
// Queue them and resolve all after a single refresh — never fire multiple /auth/refresh calls.
let isRefreshing = false;
let refreshQueue = [];

function processQueue(success) {
  refreshQueue.forEach((cb) => cb(success));
  refreshQueue = [];
}

// Error codes that require immediate logout with no retry
const HARD_LOGOUT_CODES = new Set([
  "SESSION_INVALIDATED",
  "REFRESH_TOKEN_EXPIRED",
  "REFRESH_TOKEN_MISSING",
  "REFRESH_TOKEN_REVOKED",
  "ACCOUNT_DISABLED",
  "SESSION_DEVICE_MISMATCH",
]);

function redirectToLogin() {
  clearActiveOrg();
  window.location.href = `${import.meta.env.BASE_URL}#/admin/login`;
}

// ── Response interceptor ───────────────────────────────────
AxiosUtils.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;
    const status    = error.response?.status;
    const errorCode = error.response?.data?.errorCode;

    // If the refresh call itself failed, drain the queue and log out immediately.
    // Without this guard the interceptor re-queues the refresh request waiting
    // for processQueue — which never fires — causing a deadlock.
    if (originalRequest.url?.includes("/auth/refresh")) {
      processQueue(false);
      isRefreshing = false;
      redirectToLogin();
      return Promise.reject(error);
    }

    // Hard logout — no retry, go to login immediately
    if (errorCode && HARD_LOGOUT_CODES.has(errorCode)) {
      redirectToLogin();
      return Promise.reject(error);
    }

    // Org context errors — clear header and let the caller handle
    if (errorCode === "INVALID_ORG_CONTEXT" || errorCode === "INACTIVE_ORG") {
      clearActiveOrg();
      return Promise.reject(error);
    }

    // Silent token refresh on TOKEN_EXPIRED, UNAUTHORIZED, or any bare 401
    const shouldRefresh =
      errorCode === "TOKEN_EXPIRED" ||
      errorCode === "UNAUTHORIZED"  ||
      status === 401;

    if (shouldRefresh && !originalRequest._retried) {
      originalRequest._retried = true;

      if (isRefreshing) {
        // Queue this request and wait for the in-flight refresh to finish
        return new Promise((resolve, reject) => {
          refreshQueue.push((success) => {
            if (success) resolve(AxiosUtils(originalRequest));
            else reject(error);
          });
        });
      }

      isRefreshing = true;
      try {
        // refresh_token cookie is scoped to /auth/refresh — sent automatically
        await AxiosUtils.post("/auth/refresh");
        processQueue(true);
        return AxiosUtils(originalRequest);
      } catch {
        processQueue(false);
        redirectToLogin();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default AxiosUtils;
