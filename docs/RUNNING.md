# Running the Application

## Prerequisites

| Tool    | Minimum version |
|---------|----------------|
| Node.js | 18.x or above  |
| npm     | 9.x or above   |

Check your versions:

```bash
node -v
npm -v
```

---

## Installation

```bash
# Navigate to the project root
cd Insur_Final

# Install all dependencies
npm install
```

---

## Available Scripts

### Start Development Server

```bash
npm run dev
```

App runs at → **http://localhost:5173**

> The dev server automatically proxies all `/api/v1/*` requests to the backend at `http://10.0.21.159:8008`.  
> Ensure the backend is reachable on the network before attempting to log in.

---

### Build for Production

```bash
npm run build
```

Compiled output is placed in the `dist/` folder.

---

### Preview Production Build Locally

```bash
npm run preview
```

Serves the production build at → **http://localhost:4173**

---

### Run Linter

```bash
npm run lint
```

---

## API Proxy Configuration

Defined in `vite.config.js`:

```
/api/v1/* → http://10.0.21.159:8008/*
```

To switch backends, update the `target` value in `vite.config.js`:

```js
proxy: {
  '/api/v1': {
    target: 'http://<your-backend-host>:<port>',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path.replace(/^\/api\/v1/, ''),
  },
},
```

---

## Login Pages & Credentials

### Super Admin

| Field    | Value        |
|----------|--------------|
| Username | `admin`      |
| Password | `superadmin` |

URL → `/admin/login`

### Regular Users (TPA / Org Admin / Agent / Viewer)

Created by the Super Admin from the **Users** tab.

URL → `/login`

---

## Application Routes

| Route              | Page                  | Access              |
|--------------------|-----------------------|---------------------|
| `/`                | Redirect to login     | —                   |
| `/login`           | User Login            | Public              |
| `/admin/login`     | Super Admin Login     | Public              |
| `/admin/dashboard` | Super Admin Dashboard | Super Admin only    |
| `/dashboard`       | Role Dashboard        | Logged-in user only |

Protected routes redirect to their respective login page if unauthenticated.

---

## Tech Stack

| Library          | Version | Purpose                       |
|------------------|---------|-------------------------------|
| React            | 19      | UI framework                  |
| React Router DOM | 7       | Client-side routing           |
| Redux Toolkit    | 2       | Auth state management         |
| Axios            | 1.x     | HTTP client with interceptors |
| Vite             | 8       | Dev server & build tool       |
