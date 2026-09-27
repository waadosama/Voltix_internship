# Idea House — Project Context

> Last updated: 2026-09-27. Document what actually exists; update it when you add or remove something.

## 1. Project purpose

Idea House is a creative-agency website that combines:

* A **public shop** (`/`) — buyable service items; users add items to a request and submit one request at the end of the page.
* A **client auth + dashboard** (`/dashboard`) — register/login and edit a client profile.
* An **admin content studio** (`/admin`) — manage studio content items and customer requests.
* A **contact / request form** — submits inquiries.
* A **chatbot** widget — REST chat with a mock bot.
* A **CMS "From the studio" section** — pulls published content items.

## 2. Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (v22) |
| Backend framework | Express 5 (`express` ^5.1.0) |
| ORM / database | Mongoose 8 (`mongoose` ^8.18.0) + MongoDB |
| Auth tokens | Custom JWT signed with HMAC-SHA256 (`crypto` module, defined in `backend/middleware/auth.js`) |
| Password hashing | `crypto.pbkdf2Sync` (see `backend/middleware/auth.js`) |
| CORS | `cors` ^2.8.5 |
| Env | `dotenv` ^17.2.2 |
| Frontend | Vanilla HTML / CSS / JavaScript — **no framework, no build step** |
| Frontend modules | ESM (`"type": "module"` in both `frontend/package.json` and `backend/package.json`) |
| Components | Web Components via `customElements.define` (Custom Elements v1) |
| Static serving | `backend/server.js` (port 3000) serves both the API and the frontend files; `frontend/server.js` (port 4173) is a lightweight static-only server |

## 3. Folder / file structure

```
idea-house/
├── backend/
│   ├── package.json          # "start": node server.js, "dev": node --watch server.js
│   ├── server.js             # Express app, CORS, static frontend, all routes, auto-seeds products
│   ├── db.js                 # mongoose.connect()
│   ├── routes/
│   │   ├── auth.js           # POST /api/auth/register, /login, GET /api/auth/me, PATCH /api/auth/me
│   │   ├── chat.js           # GET/POST /api/chat/messages (mock bot replies)
│   │   ├── contact.js        # POST /api/contact
│   │   ├── requests.js       # GET /api/requests (admin), PUT /api/requests/:id (admin)
│   │   ├── products.js       # GET /api/products (search/filter/paginate)
│   │   └── content.js        # GET/POST/GET/:id/PATCH/DELETE /api/content (admin), GET /api/published-content (public)
│   ├── models/
│   │   ├── user.js           # User (name, email, password, role, phone, company, bio)
│   │   ├── chat-message.js   # ChatMessage (message, sender, userId, timestamp)
│   │   ├── content.js        # Content (title, slug, body, status)
│   │   ├── product.js        # Product (id, name, category, price, blurb, tone, glyph, image, badge, status)
│   │   ├── contact.js        # "Inquiry" model (name, email, subject, message, status) — exports Inquiry
│   │   └── product.js        # (see product.js above)
│   ├── middleware/
│   │   ├── auth.js           # JWT helpers, requireAuth, requireAdmin, optionalAuth, matchesConfiguredAdmin
│   │   └── require-admin.js  # X-Admin-Username / X-Admin-Password header check
│   ├── seed-products.js      # Array of 9 seed catalogue items (mirrors the front-end shop items)
│   └── (missing) models/inquiry.js — routes/requests.js imports it → CRASHES on start
├── frontend/
│   ├── package.json          # "dev"/"start": node server.js (port 4173 static-only)
│   ├── server.js             # tiny static file server for the frontend pages
│   ├── pages/
│   │   ├── index.html        # Main shop page (shop + category filters + search + cart + request form)
│   │   ├── dashboard.html    # Client profile dashboard
│   │   └── admin.html        # Content studio + customer requests manager
│   ├── styles/
│   │   ├── main.css          # Site-wide + shop styles
│   │   ├── dashboard.css     # Dashboard-specific
│   │   └── admin.css         # Admin studio-specific
│   ├── scripts/
│   │   ├── lib/
│   │   │   ├── api.js        # getApiBase() → http://localhost:3000 when on localhost:port≠3000; apiUrl(); parseJson()
│   │   │   ├── html.js       # escapeHtml()
│   │   │   └── client-auth.js# localStorage token/user helpers; dispatches client-auth-changed events
│   │   ├── components/
│   │   │   ├── site-header.js    # <idea-header> (nav: Shop / Admin studio / Start a request)
│   │   │   ├── auth-modal.js     # <idea-auth-modal> (register/login dialog)
│   │   │   ├── contact-form.js   # <idea-contact-form> (request form → POST /api/contact)
│   │   │   ├── request-form.js   # <idea-request-form> (older variant of the request form)
│   │   │   ├── service-card.js   # <idea-service-card> (unused on the current home page)
│   │   │   └── chatbot.js        # <idea-chatbot> (REST chat composer)
│   │   ├── pages/
│   │   │   ├── home.js         # Renders the shop (items, filters, cart, request) from GET /api/products
│   │   │   ├── dashboard.js    # Client profile load/edit (PATCH /api/auth/me)
│   │   │   ├── admin.js        # Content studio + requests manager
│   │   │   └── requests-admin.js# Alternate requests manager (similar to admin.js)
│   │   └── data/             # EMPTY — front-end catalogue is now fetched from the API only
│   └── scripts/data/         # (deleted) previously held products.js
├── verify_ui.py              # Playwright smoke test (opens auth modal)
├── .gitignore                # node_modules/, .env, *.log
├── package-lock.json         # leftover "voltix" lock file at repo root (no root package.json)
└── .env                      # gitignored; holds ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET, MONGODB_URI
```

## 4. Architecture

* **Two packages, one repo.** `backend/package.json` and `frontend/package.json` are independent ESM packages. There is **no root `package.json`**.
* **Backend-first serving.** `backend/server.js` is the canonical app: it mounts the Express API, enables CORS, calls `express.static(frontendDirectory)` so the whole frontend is served from the same origin on port 3000. This means `apiUrl('/api/...')` resolves to a same-origin URL when the app is loaded from `localhost:3000`.
* **Optional frontend-only dev server.** `frontend/server.js` serves static files on port 4173. Because `frontend/scripts/lib/api.js` detects `port !== '3000'` on localhost, API calls are proxied to `http://localhost:3000`. Both servers can run at the same time without conflict.
* **No build step.** Source files are edited in place; modules resolve via Node's native ESM loader.
* **Web Components.** The UI is built as Custom Elements (`<idea-header>`, `<idea-auth-modal>`, `<idea-contact-form>`, `<idea-request-form>`, `<idea-chatbot>`, `<idea-service-card>`). Each defines itself in `connectedCallback`.
* **SPA-ish navigation.** Pages are separate HTML files (index, dashboard, admin); the header and chatbot components are reused across them.

## 5. Main features

### 5.1 Shop (home page — `frontend/pages/index.html`)
* Renders **9 catalogue items** (Brand / Digital / Campaign / Assets) fetched from `GET /api/products`.
* **Category filter chips** derived from the API response.
* **Debounced search bar** (`#shop-search`, 220 ms) calling `GET /api/products?q=…&category=…`.
* **Request cart**: "Add to request" / `− qty +` stepper per item; cart bar shows item count + total, a Clear button, and a "Request items" button.
* Clicking "Request items" scrolls to `#contact` and pre-fills the contact form's subject (`Item request`) and an itemised message with the total.
* The **request section (`#contact`)** sits at the end of the page and contains `<idea-contact-form>`.
* A hidden `<section id="managed-content">` loads published CMS items via `GET /api/published-content` when data exists.

### 5.2 Client auth + dashboard (`frontend/pages/dashboard.html`)
* Register/login via `<idea-auth-modal>` → `POST /api/auth/register` or `POST /api/auth/login`; token stored in localStorage.
* Dashboard loads profile with `GET /api/auth/me` and edits it with `PATCH /api/auth/me`.

### 5.3 Admin content studio (`frontend/pages/admin.html`)
* Admin signs in with `X-Admin-Username` / `X-Admin-Password` (stored in sessionStorage) or via the `/api/auth/login` admin fallback.
* Manages studio content items (`/api/content` CRUD) and customer requests (`/api/requests`).

### 5.4 Contact / request form (`<idea-contact-form>`)
* `POST /api/contact` — saves an Inquiry (name, email, subject, message, status).

### 5.5 Chatbot (`<idea-chatbot>`)
* `GET /api/chat/messages` and `POST /api/chat/messages`; a mock bot (`createBotReply`) replies to keywords (hello/hi, price, time, contact). Requires auth token.

## 6. API routes

All JSON. CORS enabled (`app.use(cors())`).

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | none | `{ status: 'ok', service: 'idea-house-api' }` |
| POST | `/api/auth/register` | none | Client account registration |
| POST | `/api/auth/login` | none | Login; env admin fallback (`ADMIN_USERNAME`/`ADMIN_PASSWORD`) |
| GET | `/api/auth/me` | Bearer | Current user profile |
| PATCH | `/api/auth/me` | Bearer | Update profile (name, phone, company, bio, password) |
| GET/POST | `/api/chat/messages` | Bearer | List messages; send a message (mock bot replies) |
| POST | `/api/contact` | optional | Submit an inquiry |
| GET | `/api/products` | none | Search/filter/paginate products (`q`, `category`, `limit`, `page`) |
| GET/POST/GET/:id/PATCH/DELETE | `/api/content` | admin | Content CRUD |
| GET | `/api/published-content` | none | Published content items |
| GET | `/api/requests` | admin | List customer inquiries |
| PUT | `/api/requests/:id` | admin | Update inquiry status |

Base URL logic (`frontend/scripts/lib/api.js`): if `hostname` is `localhost` or `127.0.0.1` **and** `port !== '3000'`, the base is `http://localhost:3000`; otherwise the base is `''` (same-origin).

## 7. Database models

| Model | File | Key fields |
|---|---|---|
| `User` | `models/user.js` | name, email (unique, lowercase), password, role (`admin`\|`client`), phone, company, bio; timestamps |
| `ChatMessage` | `models/chat-message.js` | message, sender (`user`\|`bot`), userId, timestamp; indexes on userId and timestamp |
| `Content` | `models/content.js` | title, slug (unique), body, status (`draft`\|`published`); timestamps |
| `Product` | `models/product.js` | id (unique), name, category, price, blurb, tone, glyph, image, badge, status (`draft`\|`published`); timestamps |
| `Inquiry` | `models/contact.js` (misnamed file) | name, email, subject, message, status (`new`\|`in-progress`\|`resolved`); timestamps |

**Known gap:** `backend/routes/requests.js` imports `Inquiry` from `../models/inquiry.js`, but **`models/inquiry.js` does not exist** — the `Inquiry` model lives in `models/contact.js`. As a result, `require('./routes/requests.js')` currently throws on server startup and `/api/requests` is unreachable until `models/inquiry.js` is restored (or the import in `routes/requests.js` is pointed at `../models/contact.js`).

## 8. Authentication

* **JWT tokens** are created by `signToken(payload)` in `backend/middleware/auth.js` and verified by `verifyToken(token)`. Tokens are **not stored server-side** (stateless).
* **Passwords** are hashed with `hashPassword` / `verifyPassword` (crypto.pbkdf2Sync + salt).
* **Client auth** (browser): token stored in localStorage (`idea-house-client-token`), user in `idea-house-client-user`; `window.IdeaClientAuth` exposes `open('login'|'register')`, `getToken()`, `getUser()`, `logout()`.
* **Admin auth**: `requireAdmin` checks `X-Admin-Username` / `X-Admin-Password` headers. `matchesConfiguredAdmin()` also supports an env-only admin account (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).
* **`requireAuth`** and **`optionalAuth`** guard endpoints that need a Bearer token.

## 9. Chat / WebSocket / REST flow

* **There is no WebSocket or server-sent-events support.** Everything is request/response REST.
* The chatbot fetches messages on open and POSTs new messages; the mock bot returns a deterministic reply in the same response (`result.reply`).
* Other flows (auth, contact, products, content, requests) are all standard REST + JSON.

## 10. Important dependencies

**Backend (`backend/package.json`)**
* `express` ^5.1.0, `mongoose` ^8.18.0, `cors` ^2.8.5, `dotenv` ^17.2.2
* ⚠️ `package.json` contains a malformed `"idea-house-backend": "file:"` dependency — harmless at runtime but should be removed.

**Frontend (`frontend/package.json`)**
* No runtime dependencies (only `node server.js`). ESM modules resolve from Node's built-ins.

**Global**
* Node.js v22, ESM (`"type": "module"` in both packages).
* MongoDB must be reachable at `mongodb://127.0.0.1:27017/voltix` (or override `MONGODB_URI`).

## 11. How to run

**Option A — backend only (recommended):**
```bash
cd backend
npm i                      # installs express, mongoose, cors, dotenv
mongod                     # ensure MongoDB is running
node server.js             # → http://localhost:3000 (API + frontend)
```
The backend auto-seeds the Product collection if it is empty on first start.

**Option B — both servers:**
```bash
cd backend && node server.js      # API + frontend on :3000
# (frontend/server.js on :4173 is optional; api.js proxies to :3000)
```

**Environment (.env, gitignored):**
```
MONGODB_URI=mongodb://127.0.0.1:27017/voltix
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
JWT_SECRET=...
PORT=3000
```

**Frontend dev server only:**
```bash
cd frontend
node server.js   # http://127.0.0.1:4173
```

## 12. Known issues / TODOs

1. **`backend/models/inquiry.js` is missing.** `routes/requests.js` imports it → server crashes on start. Restore it or repoint the import to `../models/contact.js` (which exports `Inquiry`).
2. **Admin content/request save is broken.** `frontend/scripts/pages/admin.js` (line ~229) and `frontend/scripts/pages/requests-admin.js` (line ~158) contain `await editingId ? \`/${editingId}\` : '', { method: ... }` — the object literal is `await`ed as a non-Promise, so PUT/POST calls never fire.
3. **`backend/package.json`** has the phantom `"idea-house-backend": "file:"` entry.
4. **No root `package.json`** and no workspace script to start the whole app at once.
5. **Shop shows empty if MongoDB is down.** The front-end now fetches the entire catalogue from `/api/products`; the client-side fallback was removed. If offline, the shop renders nothing.
6. **No `.env.example`.** `.gitignore` hides `.env`, but there is no template documenting the required variables.
7. **Stray `frontend/server.js` vs `backend/server.js`** — both can serve the frontend; running both is fine but confusing.
8. **`<idea-service-card>` component is unused** on the current home page (dead front-end code).
9. **`package-lock.json` at the repo root** is a leftover "voltix" lock file unrelated to either package.

## 13. Important rules for modifying the code

* **Both packages are ESM.** Always use `import`/`export`; always include `.js` in relative imports; never mix `require()`.
* **No build step.** Edit source files directly; changes are reflected by reloading the browser (or `node --watch server.js` in the backend).
* **MongoDB must be running** before starting the backend, or the app exits on `connectDatabase()` failure.
* **Front-end API calls go through `frontend/scripts/lib/api.js`.** Adding a new endpoint should be reflected there only if the host differs from 3000 (the helper already handles localhost proxying).
* **Custom Elements must be defined before the HTML upgrades them.** Module scripts are deferred and executed in document order, so keep component `<script type="module">` tags before the page scripts in the HTML.
* **Cart/request state is in-memory** on the front-end (a `Map`). It resets on page reload.
* **Do not commit secrets.** `.env` is gitignored; the `.gitignore` is intentionally minimal (`node_modules/`, `.env`, `*.log`).
* **When adding a database-backed collection:** add a model in `backend/models/`, a router in `backend/routes/`, register it in `backend/server.js`, and (optionally) seed it.
* **When changing the shop catalogue:** the source of truth is now MongoDB (`Product` model + `backend/seed-products.js`). Keep `backend/seed-products.js` in sync with the item list, since it seeds the database on first start.
* **Verify with the existing smoke tests** (`frontend/scripts/pages/home.js` logic can be exercised against `http://localhost:3000` via the Playwright runs in `frontend/…`); the project has no formal test suite beyond `verify_ui.py`.
