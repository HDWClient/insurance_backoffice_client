# Architecture & Flow Diagrams — Kinko Backoffice Frontend

> Generated: 2026-05-09  
> Diagrams use [Mermaid](https://mermaid.js.org/) syntax — render in GitHub, VS Code (Markdown Preview), or mermaid.live

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Frontend Layers](#2-frontend-layers)
3. [Route & Guard Flow](#3-route--guard-flow)
4. [Super Admin Login Flow](#4-super-admin-login-flow)
5. [Regular User Login Flow](#5-regular-user-login-flow)
6. [Forgot Password Flow](#6-forgot-password-flow)
7. [Invite Accept Flow](#7-invite-accept-flow)
8. [Token Refresh Interceptor Flow](#8-token-refresh-interceptor-flow)
9. [Organisation Context Resolution](#9-organisation-context-resolution)
10. [Org Switch Flow](#10-org-switch-flow)
11. [Super Admin Dashboard — Tab Build Flow](#11-super-admin-dashboard--tab-build-flow)
12. [RBAC — Permission Check Flow](#12-rbac--permission-check-flow)
13. [Redux Data Fetch — Deduplication Pattern](#13-redux-data-fetch--deduplication-pattern)
14. [Bulk Upload Lifecycle](#14-bulk-upload-lifecycle)
15. [Bulk Upload Row Status Machine](#15-bulk-upload-row-status-machine)
16. [Verification Portal — State Machine](#16-verification-portal--state-machine)
17. [Verification Portal — Full Sequence](#17-verification-portal--full-sequence)
18. [API Request Lifecycle](#18-api-request-lifecycle)
19. [Session & Cookie Lifecycle](#19-session--cookie-lifecycle)
20. [Component Hierarchy](#20-component-hierarchy)

---

## 1. System Architecture Overview

```mermaid
graph TB
    subgraph Browser["Browser (HashRouter)"]
        direction TB
        SA[SuperAdminLogin<br/>#/admin/login]
        UL[UserLogin<br/>#/login]
        SAD[SuperAdminDashboard<br/>#/admin/dashboard]
        RD[RoleDashboard<br/>#/dashboard]
        VP[VerifyPortal<br/>#/verify?token=...]
        IA[InviteAccept<br/>#/invite/accept]
    end

    subgraph State["State Layer"]
        AC[AppContext<br/>currentUser · activeOrg · isSuperAdmin]
        RX[Redux Store<br/>login · me · orgs · roles · users]
    end

    subgraph HTTP["HTTP Layer"]
        AX[AxiosUtils<br/>withCredentials · X-ORG-ID · refresh interceptor]
        AN[AnonAxios<br/>no auth · no X-ORG-ID]
    end

    subgraph Proxy["Vite Dev Proxy"]
        PR[/api/v1/* → http://10.0.21.159:8008/*]
    end

    subgraph Backend["Backend API (Spring Boot :8008)"]
        AUTH[/auth/*<br/>Cookie auth]
        CMSU[/cms-users/*<br/>Backoffice operators]
        ORGS[/orgs/*<br/>Organisations]
        ROLES[/roles · /permissions<br/>RBAC]
        ME[/me/permissions<br/>Effective permissions]
        BULK[/bulk/*<br/>CSV upload jobs]
        VERI[/verify/*<br/>Public enrolment portal]
        USERS[/users/*<br/>Consumer profiles]
    end

    SA & UL -->|loginAsync Redux| RX
    RX -->|setSessionFromApi| AC
    SAD & RD -->|read| AC
    SAD & RD -->|dispatch thunks| RX
    VP -->|anonymous calls| AN
    IA -->|auth calls| AX

    RX -->|services/*.js| AX
    AX -->|proxy| PR
    AN -->|direct| PR
    PR --> AUTH & CMSU & ORGS & ROLES & ME & BULK & VERI & USERS
```

---

## 2. Frontend Layers

```mermaid
graph LR
    subgraph UI["UI Components"]
        C1[SuperAdminLogin]
        C2[SuperAdminDashboard]
        C3[UserLogin]
        C4[RoleDashboard]
        C5[VerifyPortal]
        C6[InviteAccept]
        C7[PermissionGate]
    end

    subgraph Context["Context / State"]
        AC[AppContext<br/>Session state]
        RS[Redux Store<br/>Server state]
    end

    subgraph Services["Services Layer"]
        S1[authService]
        S2[meService]
        S3[orgService]
        S4[roleService]
        S5[userService]
        S6[bulkService]
        S7[verifyService]
        S8[consumerUserService]
    end

    subgraph Utils["HTTP Utils"]
        AX[AxiosUtils<br/>authenticated]
        AN[AnonAxios<br/>anonymous]
    end

    subgraph Routes["Route Guards"]
        AR[AdminRoute]
        UR[UserRoute]
    end

    UI -->|dispatch / useSelector| RS
    UI -->|useContext| AC
    RS -->|calls| Services
    C5 -->|calls| S7
    Services -->|via| AX
    S7 -->|via| AN
    AR -->|reads| AC
    UR -->|reads| AC
    C7 -->|reads| RS
```

---

## 3. Route & Guard Flow

```mermaid
flowchart TD
    START([Browser navigates to URL]) --> HASH{Hash path?}

    HASH -->|/#/admin/login| PUBLIC_SA[Render SuperAdminLogin]
    HASH -->|/#/login| PUBLIC_U[Render UserLogin]
    HASH -->|/#/verify| PUBLIC_V[Render VerifyPortal]
    HASH -->|/#/invite/accept| PUBLIC_I[Render InviteAccept]

    HASH -->|/#/admin/dashboard| ADMIN_GUARD{AdminRoute check}
    HASH -->|/#/dashboard| USER_GUARD{UserRoute check}
    HASH -->|/| REDIR[Redirect → /#/login]

    ADMIN_GUARD -->|sessionStorage.ih_sa === '1'<br/>OR isSuperAdmin<br/>OR currentUser.isSuperAdmin| RENDER_SA[Render SuperAdminDashboard]
    ADMIN_GUARD -->|none match| REDIR_SA[Redirect → /#/admin/login]

    USER_GUARD -->|currentUser exists in AppContext| RENDER_U[Render RoleDashboard]
    USER_GUARD -->|no currentUser| REDIR_U[Redirect → /#/login]
```

---

## 4. Super Admin Login Flow

```mermaid
sequenceDiagram
    actor Admin
    participant UI as SuperAdminLogin
    participant Redux as loginSlice
    participant Auth as authService
    participant API as Backend /auth
    participant AC as AppContext

    Admin->>UI: Enter email + password → Submit
    UI->>Redux: dispatch(loginAsync({email, password}))
    Redux->>Auth: loginWithPassword(email, password)
    Auth->>API: POST /auth/login/password
    API-->>Auth: 200 { userId, email, currentOrgId:null, orgs:[...] }
    Note over API,Auth: Sets HttpOnly cookies<br/>access_token (15 min)<br/>refresh_token (7 days)
    Auth-->>Redux: fulfilled payload
    Redux->>AC: setSessionFromApi(payload)
    AC-->>AC: currentUser ✓ · isSuperAdmin ✓
    AC->>AC: sessionStorage.ih_sa = "1"
    Redux-->>UI: loading=false, no error
    UI->>UI: Show org picker (currentOrgId is null)
    Admin->>UI: Select org
    UI->>AC: switchOrg(selectedOrg)
    AC->>AC: activeOrg = selectedOrg
    Note over AC: setActiveOrg(id)<br/>X-ORG-ID header set on Axios
    UI->>API: GET /me/permissions (with X-ORG-ID)
    API-->>UI: { MODULE: [ACTION,...] }
    UI->>UI: Navigate → /#/admin/dashboard
```

---

## 5. Regular User Login Flow

```mermaid
sequenceDiagram
    actor User
    participant UI as UserLogin
    participant Redux as loginSlice
    participant Auth as authService
    participant API as Backend /auth
    participant AC as AppContext

    User->>UI: Enter email + password → Submit
    UI->>Redux: dispatch(loginAsync({email, password}))
    Redux->>Auth: loginWithPassword(email, password)
    Auth->>API: POST /auth/login/password
    API-->>Auth: 200 { userId, email, currentOrgId: "uuid", orgs:[{id,name,slug}] }
    Note over API,Auth: HttpOnly cookies set
    Auth-->>Redux: fulfilled
    Redux->>AC: setSessionFromApi(payload)
    AC-->>AC: currentUser ✓ · isSuperAdmin=false
    Note over AC: setActiveOrg(currentOrgId)<br/>X-ORG-ID header set

    UI->>API: GET /me/permissions
    API-->>UI: permission array
    UI->>UI: Navigate → /#/dashboard
```

---

## 6. Forgot Password Flow

```mermaid
flowchart TD
    A([View: login]) -->|Click 'Forgot password'| B([View: forgot])
    B -->|Enter email → Submit| C[POST /auth/otp/send\npurpose: FORGOT_PASSWORD]
    C -->|200 OK| D([View: otp])
    C -->|USER_NOT_FOUND| E[Show error inline]
    E --> B

    D -->|Enter 6-digit OTP → Verify| F[POST /auth/otp/verify\npurpose: FORGOT_PASSWORD]
    F -->|200 + verifyToken| G([View: reset])
    F -->|INVALID_OTP| H[Show 'Incorrect OTP']
    F -->|OTP_EXPIRED| I[Show 'OTP expired'\nReveal Resend button]
    F -->|OTP_INVALIDATED| J[Show 'Too many attempts'\nBack to forgot view]
    H --> D
    I --> D
    J --> B

    G -->|Enter new password → Submit| K[POST /auth/reset-password\n{ verifyToken, newPassword }]
    K -->|200 OK| L([View: done])
    K -->|INVALID_VERIFY_TOKEN| M[Show 'Link expired'\nRestart flow]
    M --> B
    L -->|Click 'Back to login'| A
```

---

## 7. Invite Accept Flow

```mermaid
sequenceDiagram
    actor NewUser
    participant Email as Email Client
    participant UI as InviteAccept Page
    participant API as Backend /auth

    Note over Email: Admin sent invite via<br/>POST /cms-users/invite

    Email->>NewUser: Invite email with OTP
    NewUser->>UI: Open /#/invite/accept (with email in query)
    UI->>UI: Show OTP + password form

    NewUser->>UI: Enter OTP + new password → Submit
    UI->>API: POST /auth/invite/accept\n{ email, otp, password }

    alt Success
        API-->>UI: 200 { userId, email, orgId }
        Note over API,UI: HttpOnly cookies set<br/>Account activated
        UI->>UI: Navigate → /#/dashboard
    else OTP_EXPIRED (48h window)
        API-->>UI: 401 OTP_EXPIRED
        UI->>UI: Show 'Invite expired — contact admin'
    else INVALID_OTP
        API-->>UI: 401 INVALID_OTP
        UI->>UI: Show 'Incorrect code'
    else OTP_INVALIDATED
        API-->>UI: 401 OTP_INVALIDATED
        UI->>UI: Show 'Too many attempts — contact admin'
    end
```

---

## 8. Token Refresh Interceptor Flow

```mermaid
flowchart TD
    REQ([Outgoing API request]) --> SEND[Send request with cookies]
    SEND -->|Response| CHK{Response OK?}
    CHK -->|2xx| PASS([Return response to caller])
    CHK -->|Error| EC{errorCode?}

    EC -->|TOKEN_EXPIRED| RETRY{Already retried?}
    RETRY -->|Yes| FAIL([Reject — hard logout])
    RETRY -->|No| INFLIGHT{isRefreshing?}

    INFLIGHT -->|Yes| QUEUE[Add to refreshQueue\nAwait resolution]
    INFLIGHT -->|No| SET[isRefreshing = true]

    SET --> REFRESH[POST /auth/refresh\nrefresh_token cookie sent auto]
    REFRESH -->|200 New cookies| RESOLVE[processQueue success=true\nisRefreshing = false]
    RESOLVE --> RETRY_ALL[Retry all queued requests]
    RETRY_ALL --> PASS

    REFRESH -->|Error| REJECT[processQueue success=false\nclearAppState]
    REJECT --> HARD[Redirect → /#/admin/login]

    QUEUE -->|success=true| RETRY_ORIG[Retry original request]
    QUEUE -->|success=false| FAIL2([Reject])

    EC -->|SESSION_INVALIDATED\nREFRESH_TOKEN_EXPIRED\nACCOUNT_DISABLED\nSESSION_DEVICE_MISMATCH| LOGOUT[clearAppState\nRedirect → /#/admin/login]
    EC -->|INVALID_ORG_CONTEXT\nINACTIVE_ORG| ORGPICKER[Redirect → org picker]
    EC -->|Other| PASSTHRU([Reject — component handles])
```

---

## 9. Organisation Context Resolution

```mermaid
flowchart TD
    REQ([API Request arrives at backend]) --> H1{X-ORG-ID header\npresent?}

    H1 -->|Yes| V1{User has access\nto that org?}
    V1 -->|Yes| USE_HEADER[Use org from X-ORG-ID]
    V1 -->|No| ERR1[400 INVALID_ORG_CONTEXT]

    H1 -->|No| H2{Host header has\norg subdomain?\ne.g. acme.mydomain.com}
    H2 -->|Yes| V2{Org slug found\nin DB?}
    V2 -->|Yes| USE_HOST[Use org from subdomain slug]
    V2 -->|No| ERR2[404 ORG_NOT_FOUND]

    H2 -->|No — localhost| H3{User belongs to\nexactly 1 org?}
    H3 -->|Yes| USE_SINGLE[Use user's single org]
    H3 -->|No| ERR3[400 INVALID_ORG_CONTEXT\nMulti-org user needs X-ORG-ID]

    USE_HEADER & USE_HOST & USE_SINGLE --> PROCEED[Proceed with request\nin org context]
```

---

## 10. Org Switch Flow

```mermaid
sequenceDiagram
    actor Admin
    participant UI as SuperAdminDashboard
    participant AC as AppContext
    participant AX as AxiosUtils
    participant Redux as Redux Store
    participant API as Backend

    Admin->>UI: Click org pill → Select new org
    UI->>AC: switchOrg(newOrg)
    AC->>AC: activeOrg = newOrg
    AC->>AX: setActiveOrg(newOrg.id)
    AX->>AX: defaults.headers['X-ORG-ID'] = newOrg.id

    Note over UI: Tab re-mounts via key={activeOrg.id-activeTab}
    UI->>Redux: dispatch(fetchMyPermissions())
    Note over Redux: condition: !loading only<br/>Always re-fetches on org switch
    Redux->>API: GET /me/permissions (new X-ORG-ID)
    API-->>Redux: New permission set for this org
    Redux-->>UI: Rebuild tabs from new permissions

    UI->>Redux: dispatch(fetchOrgs / fetchUsers / fetchRoles)
    Note over Redux: condition: !loading && data.length===0<br/>Re-fetches because key forces remount
    Redux->>API: Fetch data scoped to new org
    API-->>Redux: Org-scoped data
    Redux-->>UI: Render fresh data
```

---

## 11. Super Admin Dashboard — Tab Build Flow

```mermaid
flowchart TD
    LOGIN([Super admin logs in + selects org]) --> PERMS[GET /me/permissions]
    PERMS --> NORM[meService normalises\nMODULE: ACTION → flat codes]
    NORM --> MODULES[Extract unique modules\nfrom permissions array]
    MODULES --> FILTER[Remove EXCLUDED_MODULES\ne.g. AUTH, SYSTEM]
    FILTER --> SORT[Sort alphabetically]
    SORT --> PIN[Pin AUDIT last]
    PIN --> TABS[Tab list ready]

    TABS --> T1{Module = ORG?}
    T1 -->|Yes| C1[OrgModuleTab]
    T1 -->|No| T2{Module = USER\nor CMS_USER?}
    T2 -->|Yes| C2[UserModuleTab]
    T2 -->|No| T3{Module = ROLE?}
    T3 -->|Yes| C3[RoleModuleTab]
    T3 -->|No| C4[GenericModuleTab]

    C1 & C2 & C3 & C4 --> RENDER[Render active tab]
    RENDER -->|key = activeOrg.id + activeTab| REMOUNT[Full remount on switch]
    REMOUNT --> FETCH[Fetch thunk runs\ncondition guard prevents duplicate]
```

---

## 12. RBAC — Permission Check Flow

```mermaid
flowchart TD
    subgraph Frontend["Frontend — PermissionGate"]
        FE_REQ([Component renders PermissionGate\npermission='BULK_UPLOAD'])
        FE_REQ --> SA_CHECK{isSuperAdmin?}
        SA_CHECK -->|Yes| ALLOW([Render children — super admin bypasses all gates])
        SA_CHECK -->|No| CUSTOM{currentUser.permissions\nhas 'BULK_UPLOAD'?}
        CUSTOM -->|Yes| ALLOW2([Render children])
        CUSTOM -->|No| ROLE_CHECK{ROLE_PERMISSIONS\ndefault for user's role?}
        ROLE_CHECK -->|Has permission| ALLOW3([Render children])
        ROLE_CHECK -->|No| DENY([Render nothing / DeniedGate content])
    end

    subgraph Backend["Backend — @RequiresPermission AOP"]
        BE_REQ([API call arrives])
        BE_REQ --> ROOT{user.isRootAdmin?}
        ROOT -->|Yes| PASS([Proceed])
        ROOT -->|No| QUERY[Query: user_roles → roles\n→ role_permissions\nWHERE orgId = X-ORG-ID]
        QUERY --> HAS{effectivePermissions\ncontains code?}
        HAS -->|Yes| PASS2([Proceed])
        HAS -->|No| FORBID([403 FORBIDDEN])
    end
```

---

## 13. Redux Data Fetch — Deduplication Pattern

```mermaid
flowchart TD
    COMP([Component mounts\ne.g. OrgModuleTab]) --> DISP[dispatch fetchOrgs]
    DISP --> COND{condition check}

    COND -->|loading=true\nOR data.length > 0| SKIP([RTK skips — returns early\nNo API call fired])
    COND -->|loading=false\nAND data.length === 0| FETCH[Set loading=true\nCall orgService.getOrgs]

    FETCH --> API[GET /orgs]
    API -->|200| FULLFILLED[extraReducers: fulfilled\ndata = payload\nloading = false]
    API -->|Error| REJECTED[extraReducers: rejected\nerror = payload\nloading = false]

    FULLFILLED --> RENDER([Component renders data])
    REJECTED --> ERR([Component shows error])

    subgraph Note["fetchMyPermissions — different rule"]
        NR[condition: !loading ONLY\nNo data check\nAlways re-fetches on org switch]
    end
```

---

## 14. Bulk Upload Lifecycle

```mermaid
flowchart TD
    START([Admin uploads CSV]) --> UP[POST /bulk/upload\nmultipart/form-data]
    UP --> ACCEPT[202 Accepted\njob.status = PENDING]
    ACCEPT --> POLL{Poll GET /bulk/id\nevery 1-2s}
    POLL -->|status = PROCESSING| POLL
    POLL -->|status = FAILED| FAIL([Show parse error\nno rows created])
    POLL -->|status = COMPLETED| REVIEW

    subgraph REVIEW["Admin Review Phase (DRAFT)"]
        REVIEW([Rows in DRAFT\nno emails sent yet])
        REVIEW --> OPT{Admin action?}
        OPT -->|Edit a row| EDIT[PUT /bulk/id/rows/rowId\nDRAFT rows only]
        OPT -->|Cancel a row| CROW[POST /bulk/id/rows/rowId/cancel]
        OPT -->|Cancel whole job| CJOB[POST /bulk/id/cancel\nAll rows → CANCELLED]
        OPT -->|Ready to send| DISPATCH
        EDIT --> REVIEW
        CROW --> REVIEW
        CJOB --> CANCELLED([Job CANCELLED])
    end

    DISPATCH[POST /bulk/id/dispatch\nDRAFT rows → STAGED\nInvite emails sent]
    DISPATCH --> MONITOR

    subgraph MONITOR["Monitoring Phase"]
        MONITOR([Monitor rows])
        MONITOR --> ROWACT{Per-row action?}
        ROWACT -->|Resend invite| RESEND[POST /bulk/id/rows/rowId/resend-invite\n60s cooldown · max 5 sends]
        ROWACT -->|Cancel row| CROW2[POST /bulk/id/rows/rowId/cancel]
        ROWACT -->|Consumer verifies| VFLOW[Verify Portal flow]
        VFLOW --> PROMOTED[Row → PROMOTED\nconsumer profile created]
        PROMOTED --> DONE
    end

    DONE([Job phase = COMPLETED\nAll rows in terminal states])
```

---

## 15. Bulk Upload Row Status Machine

```mermaid
stateDiagram-v2
    [*] --> DRAFT : POST /bulk/upload parse success

    DRAFT --> STAGED : POST /bulk/id/dispatch (invite email sent)
    DRAFT --> CANCELLED : POST /bulk/id/rows/rowId/cancel
    DRAFT --> REJECTED : Duplicate row OR cannot supersede PROMOTED

    STAGED --> OTP_SENT : Consumer clicks link → POST /verify/otp/send
    STAGED --> CANCELLED : Admin cancels row
    STAGED --> INVITE_FAILED : SMTP send error
    STAGED --> SUPERSEDED : Newer upload with same mobile + different data

    OTP_SENT --> VERIFIED : POST /verify/otp/confirm (OTP correct)
    OTP_SENT --> EXPIRED : Review window lapsed without confirm
    OTP_SENT --> CANCELLED : Admin cancels row

    VERIFIED --> PROMOTED : POST /verify/promote
    VERIFIED --> REJECTED : Consumer POSTs /verify/reject

    INVITE_FAILED --> STAGED : Admin resends invite

    PROMOTED --> [*] : Terminal — manage via PUT /users/id/status

    note right of DRAFT
        Admin can edit rows here.
        No emails have been sent.
    end note

    note right of PROMOTED
        Consumer profile created.
        Cannot be cancelled here;
        use PUT /users/id/status instead.
    end note
```

---

## 16. Verification Portal — State Machine

```mermaid
stateDiagram-v2
    [*] --> INIT : Page loads with ?token=

    INIT --> TERMINAL_ERROR : No token in URL
    INIT --> LANDING : Token present

    LANDING --> OTP_INPUT : POST /verify/otp/send → 200
    LANDING --> TERMINAL_ERROR : INVALID_TOKEN / OTP_LOCKED / ALREADY_VERIFIED\nINVITE_CANCELLED / ROW_REJECTED / INVITE_SUPERSEDED

    OTP_INPUT --> REVIEWING : POST /verify/otp/confirm → 200
    OTP_INPUT --> OTP_INPUT : INVALID_OTP (inline error, stay)
    OTP_INPUT --> OTP_INPUT : OTP_EXPIRED (show resend immediately)
    OTP_INPUT --> TERMINAL_ERROR : OTP_LOCKED

    REVIEWING --> DONE_ENROLLED : POST /verify/promote → 200
    REVIEWING --> DONE_REJECTED : POST /verify/reject → 200
    REVIEWING --> LANDING : Review window expires (countdown = 0)

    DONE_ENROLLED --> [*]
    DONE_REJECTED --> [*]
    TERMINAL_ERROR --> [*]

    note right of REVIEWING
        Countdown timer running.
        verifiedAt + reviewWindowSeconds - now.
        When ≤ 0: disable buttons, show Start Over.
    end note
```

---

## 17. Verification Portal — Full Sequence

```mermaid
sequenceDiagram
    actor Consumer
    participant Email as Email Client
    participant VP as VerifyPortal (/#/verify)
    participant AN as AnonAxios (no auth)
    participant API as Backend /verify

    Note over Email: Admin dispatched bulk job<br/>Invite email sent to consumer

    Email->>Consumer: "Acme Insurance invited you — [Verify]"
    Consumer->>VP: Click link → /#/verify?token=<opaque>
    VP->>VP: Read token from URL once<br/>Store only in component memory

    Note over VP: Screen 1: LANDING

    Consumer->>VP: Click "Send code"
    VP->>AN: POST /verify/otp/send { token }
    AN->>API: POST /verify/otp/send
    API-->>AN: 200 { sent:true, expiresInSeconds:600, resendCooldownSeconds:60 }
    AN-->>VP: Success
    VP->>VP: Start resend cooldown (60s)

    Note over VP: Screen 2: OTP_INPUT

    Consumer->>VP: Enter 6-digit OTP → Submit
    VP->>AN: POST /verify/otp/confirm { token, otp }
    AN->>API: POST /verify/otp/confirm
    API-->>AN: 200 { verified:true, verifiedAt, reviewWindowSeconds:900, orgName, details:{...} }
    AN-->>VP: Full PII details returned
    VP->>VP: Start review countdown (900s)

    Note over VP: Screen 3: REVIEWING<br/>Shows name, DOB, mobile, email, PAN etc.

    alt Consumer confirms — data correct
        Consumer->>VP: Click "Yes, enrol me"
        VP->>AN: POST /verify/promote { token }
        AN->>API: POST /verify/promote
        API-->>AN: 200 { verified:true, alreadyEnrolled:false }
        AN-->>VP: Success
        Note over VP: Screen 4a: DONE_ENROLLED
    else Consumer rejects — data wrong
        Consumer->>VP: Click "Wrong info" → Pick reason + Submit
        VP->>AN: POST /verify/reject { token, reason:"Wrong DOB" }
        AN->>API: POST /verify/reject
        API-->>AN: 200 { rejected:true }
        AN-->>VP: Success
        Note over VP: Screen 4b: DONE_REJECTED
    else Review window expires
        VP->>VP: countdown hits 0<br/>Disable both buttons
        Consumer->>VP: Click "Start over"
        VP->>VP: Reset to Screen 1: LANDING
    end
```

---

## 18. API Request Lifecycle

```mermaid
flowchart LR
    COMP([Component / Redux Thunk]) --> SVC[services/*.js]
    SVC -->|authenticated| AX[AxiosUtils\nwithCredentials\nX-ORG-ID header]
    SVC -->|verify portal| AN[AnonAxios\nno headers]
    AX --> INT[Request Interceptor\nattach headers]
    AN --> PROXY
    INT --> PROXY[Vite Dev Proxy\n/api/v1/* → :8008/*]
    PROXY --> BE[Backend API]
    BE -->|200-299| RESP_OK[Response Interceptor\npass through]
    BE -->|401 TOKEN_EXPIRED| REFR[Refresh flow\nsee diagram 8]
    BE -->|401 SESSION_*| LOGOUT[Hard logout]
    BE -->|403 ORG_*| ORGPICK[Org picker redirect]
    BE -->|Other error| COMP_ERR[Reject → Redux rejected\nor component catch]
    RESP_OK --> COMP_OK([fulfilled → Redux state updated])
    COMP_ERR --> ERR_STATE([errorCode stored in slice\nComponent maps to UI string])
```

---

## 19. Session & Cookie Lifecycle

```mermaid
timeline
    title Session & Cookie Lifecycle
    section Login
        POST /auth/login/password       : access_token cookie set (15 min, HttpOnly)
                                        : refresh_token cookie set (7 days, HttpOnly, path=/auth/refresh)
                                        : AppContext populated (currentUser, activeOrg)
                                        : X-ORG-ID header set on Axios

    section Active Session
        Every API request               : Browser auto-sends access_token cookie
                                        : X-ORG-ID header sent for org context
        token expires (15 min)          : 401 TOKEN_EXPIRED intercepted
                                        : POST /auth/refresh fires (refresh_token auto-sent)
                                        : New cookies issued, original request retried

    section Org Switch
        Admin selects different org     : X-ORG-ID header updated
                                        : GET /me/permissions re-fetched
                                        : Tab components re-mount (key changes)
                                        : Redux state cleared for org-scoped data

    section Logout
        POST /auth/logout               : Server sets Max-Age=0 on both cookies
                                        : Cookies cleared by browser
                                        : AppContext.logout() called
                                        : clearActiveOrg() removes X-ORG-ID
                                        : Redirect → /#/login or /#/admin/login

    section Session Invalidated
        Another device logs in          : 401 SESSION_INVALIDATED on next request
                                        : Hard logout triggered by interceptor
                                        : Redirect to login with message
```

---

## 20. Component Hierarchy

```mermaid
graph TD
    MAIN[main.jsx\nRedux Provider + HashRouter]
    APP[App.jsx\nRoute definitions]

    MAIN --> APP

    APP --> SAL[SuperAdminLogin\n/#/admin/login]
    APP --> UL[UserLogin\n/#/login]
    APP --> VP[VerifyPortal\n/#/verify]
    APP --> IA[InviteAccept\n/#/invite/accept]

    APP --> AR[AdminRoute guard]
    AR --> SAD[SuperAdminDashboard\n/#/admin/dashboard]

    APP --> UR[UserRoute guard]
    UR --> RD[RoleDashboard\n/#/dashboard]

    SAL --> FP[ForgotPassword steps\nview-switched via local state]

    SAD --> ORG[OrgModuleTab]
    SAD --> USR[UserModuleTab]
    SAD --> ROL[RoleModuleTab]
    SAD --> GEN[GenericModuleTab]

    RD --> PG[PermissionGate\nwraps gated sections]
    RD --> RA[RoleAccess\nwraps role-gated sections]

    VP --> S1[Screen: Landing]
    VP --> S2[Screen: OTP Input]
    VP --> S3[Screen: Reviewing]
    VP --> S4A[Screen: Done Enrolled]
    VP --> S4B[Screen: Done Rejected]
    VP --> S5[Screen: Terminal Error]

    subgraph Shared
        EB[ErrorBoundary\nwraps all routes]
        PG
        RA
    end
```

---

*End of ARCHITECTURE.md*
