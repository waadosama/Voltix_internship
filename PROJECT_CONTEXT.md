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
│   ├── package.json          # "start": node server.js, "dev": node --watch server.js, "test": node --test
│   ├── app.js                # createApp() — Express app, CORS, static frontend, all routes (no port/DB)
│   ├── server.js             # createApp() + connectDatabase() + seed products + listen (entry point)
│   ├── db.js                 # mongoose.connect()
│   ├── routes/
│   │   ├── auth.js           # POST /api/auth/register, /login, GET /api/auth/me, PATCH /api/auth/me
│   │   ├── chat.js           # GET/POST /api/chat/messages (mock bot replies)
│   │   ├── contact.js        # POST /api/contact
│   │   ├── requests.js       # GET /api/requests, PUT /api/requests/:id (requests:read / requests:update)
│   │   ├── products.js       # GET /api/products(+ ?scope=all), GET/POST/PATCH/DELETE /api/products… (products:* )
│   │   ├── users.js          # GET /api/users, POST /api/users, PATCH /api/users/:id/role, DELETE /api/users/:id (admin)
│   │   └── content.js        # GET/POST/GET/:id/PATCH|PUT/DELETE /api/content (permission-gated), GET /api/published-content (public)
│   ├── models/
│   │   ├── user.js           # User (name, email, password, role: admin|employee|client, phone, company, bio)
│   │   ├── chat-message.js   # ChatMessage (message, sender, userId, timestamp)
│   │   ├── content.js        # Content (title, slug, body, status, createdBy, createdByName)
│   │   ├── product.js        # Product (id, name, category, price, blurb, tone, glyph, image, badge, status)
│   │   └── contact.js        # "Inquiry" model (name, email, subject, message, status) — exports Inquiry
│   ├── middleware/
│   │   ├── auth.js           # JWT helpers, hashing, requireAuth, optionalAuth, matchesConfiguredAdmin
│   │   ├── rbac.js           # requirePermission(), resolveActor(), ownsRecord()/canModifyRecord() — RBAC guard
│   │   └── require-admin.js  # legacy, unused X-Admin-Username / X-Admin-Password check
│   ├── rbac/
│   │   └── permissions.js    # pure role → permission catalogue (admin, employee, client)
│   ├── tests/
│   │   ├── rbac.unit.test.js # permission catalogue + ownership rules (no DB)
│   │   ├── rbac.api.test.js  # end-to-end 401/403 checks against the real app + MongoDB
│   │   ├── shop.api.test.js  # shop item detail page + /api/products/:id checks
│   │   └── products.admin.test.js # shop catalogue CRUD + products:* permission checks
│   └── (missing) models/inquiry.js — routes/requests.js imports it → CRASHES on start
├── frontend/
│   ├── package.json          # "dev"/"start": node server.js (port 4173 static-only)
│   ├── server.js             # tiny static file server for the frontend pages
│   ├── pages/
│   │   ├── index.html        # Main shop page (shop + category filters + search + cart + request form)
│   │   ├── shop-item.html    # Single shop item detail page (served for every /shop/:id)
│   │   ├── dashboard.html    # Client profile dashboard
│   │   └── admin.html        # Content studio + customer requests manager + shop catalogue manager
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
│   │   │   ├── shop-item.js    # /shop/:id detail page (item, add-to-request, related items)
│   │   │   ├── dashboard.js    # Client profile load/edit (PATCH /api/auth/me)
│   │   │   ├── admin.js        # Content studio + requests manager + shop catalogue (products:*)
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
* **Backend-first serving.** `backend/app.js` exports `createApp()` (mounts the Express API, enables CORS, `express.static(frontendDirectory)` so the whole frontend is served from the same origin on port 3000) and `backend/server.js` is the canonical entry point: it connects to MongoDB, seeds products and calls `app.listen()`. `apiUrl('/api/...')` therefore resolves to a same-origin URL when the app is loaded from `localhost:3000`.
* **Optional frontend-only dev server.** `frontend/server.js` serves static files on port 4173. Because `frontend/scripts/lib/api.js` detects `port !== '3000'` on localhost, API calls are proxied to `http://localhost:3000`. Both servers can run at the same time without conflict.
* **No build step.** Source files are edited in place; modules resolve via Node's native ESM loader.
* **Web Components.** The UI is built as Custom Elements (`<idea-header>`, `<idea-auth-modal>`, `<idea-contact-form>`, `<idea-request-form>`, `<idea-chatbot>`, `<idea-service-card>`). Each defines itself in `connectedCallback`.
* **SPA-ish navigation.** Pages are separate HTML files (index, shop-item, dashboard, admin); the header and chatbot components are reused across them. `GET /shop/:id` serves `shop-item.html` (the page script reads the id from the path); `GET /shop` redirects to `/#shop`.

## 5. Main features

### 5.1 Shop (home page — `frontend/pages/index.html`)
* Renders the catalogue items (Brand / Digital / Campaign / Assets) fetched from `GET /api/products` — **everything comes from MongoDB**, managed from the admin studio; there is no hardcoded/seeded item list.
* **Category filter chips** derived from the API response.
* **Debounced search bar** (`#shop-search`, 220 ms) calling `GET /api/products?q=…&category=…`.
* **Request cart**: "Add to request" / `− qty +` stepper per item; cart bar shows item count + total, a Clear button, and a "Request items" button. The cart is persisted in `localStorage` (`idea-house-cart`), so it survives reloads and is shared with the `/shop/:id` detail page.
* **Item detail pages**: the card's image and title link to `/shop/<id>` (`frontend/pages/shop-item.html` + `scripts/pages/shop-item.js`), which loads `GET /api/products/:id`, shows the full item, an add-to-request stepper, and up to three "More in <category>" items.
* Clicking "Request items" scrolls to `#contact` and pre-fills the contact form's subject (`Item request`) and an itemised message with the total.
* The **request section (`#contact`)** sits at the end of the page and contains `<idea-contact-form>`.
* A hidden `<section id="managed-content">` loads published CMS items via `GET /api/published-content` when data exists.

### 5.2 Client auth + dashboard (`frontend/pages/dashboard.html`)
* Register/login via `<idea-auth-modal>` → `POST /api/auth/register` or `POST /api/auth/login`; token stored in localStorage.
* Dashboard loads profile with `GET /api/auth/me` and edits it with `PATCH /api/auth/me`.
* The account summary shows the **role** and, as chips, the **permissions** that role grants (`user.permissions` returned by the API).

### 5.3 Admin content studio (`frontend/pages/admin.html`)
* Signs in with `X-Admin-Username` / `X-Admin-Password` (stored in sessionStorage) or with a normal `POST /api/auth/login` token — both an `admin` and an `employee` account can open the studio; a `client` account cannot.
* Manages studio content items (`/api/content`) and customer requests (`/api/requests`).
* The UI mirrors the backend permissions (`can()` in `frontend/scripts/pages/admin.js`): the "New item" button only renders with `content:create`, delete buttons only with `content:delete`, and records the account may not edit are shown read-only (the API also enforces this).
* **Shop catalogue manager** (`#studio-shop`, rendered from `GET /api/products?scope=all`): create/edit/delete the items the customer shop shows — every record lives in MongoDB. The whole section is hidden without `products:read`, the "New shop item" button needs `products:create`, saving needs `products:update` and the delete button needs `products:delete` (admin only — an `employee` sees neither section controls nor the section itself).

### 5.4 Contact / request form (`<idea-contact-form>`)
* `POST /api/contact` — saves an Inquiry (name, email, subject, message, status).

### 5.5 Chatbot (`<idea-chatbot>`)
* `GET /api/chat/messages` and `POST /api/chat/messages`; a mock bot (`createBotReply`) replies to keywords (hello/hi, price, time, contact). Requires auth token.

## 6. API routes

All JSON. CORS enabled (`app.use(cors())`). "Permission" is enforced by `requirePermission()` (`backend/middleware/rbac.js`) — `401` when the caller is not authenticated, `403` (with `role`, `requiredPermissions`, `missingPermissions`) when the role lacks the permission.

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/health` | none | `{ status: 'ok', service: 'idea-house-api' }` |
| POST | `/api/auth/register` | none | Client account registration (role is always forced to `client`) |
| POST | `/api/auth/login` | none | Login; env admin fallback (`ADMIN_USERNAME`/`ADMIN_PASSWORD`); returns `user.permissions` |
| GET | `/api/auth/me` | `profile:read` | Current user profile + role + permissions |
| PATCH | `/api/auth/me` | `profile:update` | Update profile (name, phone, company, bio, password) |
| GET/POST | `/api/chat/messages` | `chat:use` | List messages; send a message (mock bot replies) |
| POST | `/api/contact` | optional | Submit an inquiry |
| GET | `/api/products` | none | Search/filter/paginate **published** products (`q`, `category`, `limit`, `page`); `?scope=all` also returns drafts and requires `products:read` |
| GET | `/api/products/:id` | none (`products:read` for drafts) | One product by slug (or `_id`); `404` when it does not exist |
| POST | `/api/products` | `products:create` | Create a shop item (slug `id`, name, category, price, blurb, tone, glyph, image, badge, status) |
| PATCH/PUT | `/api/products/:id` | `products:update` | Update a shop item (whitelisted fields only; `409` when the slug is taken) |
| DELETE | `/api/products/:id` | `products:delete` | Delete a shop item |
| GET | `/api/content` | `content:read` | List content items (incl. `canUpdate`/`canDelete` hints) |
| POST | `/api/content` | `content:create` | Create a content item; optional `createdBy` assigns ownership (admins may assign anyone) |
| GET | `/api/content/:id` | `content:read` | Read one content item |
| PATCH/PUT | `/api/content/:id` | `content:update` | Update a content item — admins: any record, other roles: **only records they own** |
| DELETE | `/api/content/:id` | `content:delete` | Delete a content item |
| GET | `/api/published-content` | none | Published content items |
| GET | `/api/requests` | `requests:read` | List customer inquiries |
| PUT | `/api/requests/:id` | `requests:update` | Update inquiry status |
| GET | `/api/users` | `users:read` | List accounts + the role catalogue (`roles`) |
| POST | `/api/users` | `users:create` | Create an account with any role (admin-only; public `/register` stays `client`) |
| PATCH | `/api/users/:id/role` | `users:manage` | Change an account's role (not your own) |
| DELETE | `/api/users/:id` | `users:manage` | Delete an account (not yourself / the last admin) |

Base URL logic (`frontend/scripts/lib/api.js`): if `hostname` is `localhost` or `127.0.0.1` **and** `port !== '3000'`, the base is `http://localhost:3000`; otherwise the base is `''` (same-origin).

## 7. Database models

| Model | File | Key fields |
|---|---|---|
| `User` | `models/user.js` | name, email (unique, lowercase), password, role (`admin`\|`employee`\|`client`), phone, company, bio; timestamps |
| `ChatMessage` | `models/chat-message.js` | message, sender (`user`\|`bot`), userId, timestamp; indexes on userId and timestamp |
| `Content` | `models/content.js` | title, slug (unique), body, status (`draft`\|`published`), **createdBy** (User ref, RBAC ownership), createdByName; timestamps |
| `Product` | `models/product.js` | id (unique), name, category, price, blurb, tone, glyph, image, badge, status (`draft`\|`published`); timestamps |
| `Inquiry` | `models/contact.js` (misnamed file) | name, email, subject, message, status (`new`\|`in-progress`\|`resolved`); timestamps |

> Note: content items created **before** RBAC existed (or seeded) have `createdBy: null` — only an `admin` can edit those; an `employee` sees them as read-only.

## 8. Authentication + authorization (RBAC)

* **JWT tokens** are created by `signToken(payload)` in `backend/middleware/auth.js` and verified by `verifyToken(token)`. Tokens are **not stored server-side** (stateless).
* **Passwords** are hashed with `hashPassword` / `verifyPassword` (crypto.pbkdf2Sync + salt).
* **Client auth** (browser): token stored in localStorage (`idea-house-client-token`), user in `idea-house-client-user`; `window.IdeaClientAuth` exposes `open('login'|'register')`, `getToken()`, `getUser()`, `logout()`.
* **Legacy admin headers**: `matchesConfiguredAdmin()` still accepts `X-Admin-Username` / `X-Admin-Password` and is treated as a full `admin` actor inside `requirePermission()`.
* **Roles** live in `backend/rbac/permissions.js` (pure module):
  * `admin` — every permission (`content:*`, `requests:*`, `products:*`, `users:*`, profile, chat).
  * `employee` — `content:read`, `content:update` (own records only), `requests:read`, `requests:update`, profile, chat. **No** create/delete, **no** shop catalogue management, **no** user administration.
  * `client` — `profile:read`, `profile:update`, `chat:use` only.
  * Unknown roles get an empty permission list (deny by default).
* **`requirePermission('res:action', ...)`** (in `backend/middleware/rbac.js`) is the single guard used by every protected route:
  1. accepts the legacy admin headers, otherwise requires a valid Bearer JWT (`401`),
  2. **re-reads the account's role from MongoDB** — a token cannot outlive a role change or a deleted account,
  3. resolves the role's permission list and returns `403` with `missingPermissions` if anything required is absent,
  4. sets `request.user` (resolved actor) and `request.rbac = { role, permissions, source }`.
* **Record-level checks**: `canModifyRecord()` lets admins edit any record and other roles only records they own (`content.createdBy`).
* **`requireAuth`** / **`optionalAuth`** remain in `middleware/auth.js` for plain "must be signed in" checks.

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

**Tests (RBAC):**
```bash
cd backend
npm test        # node --test: permission-catalogue unit tests + end-to-end RBAC API tests
```
`tests/rbac.api.test.js` boots the real Express app on an ephemeral port against a **separate** database (`RBAC_TEST_MONGODB_URI`, default `mongodb://127.0.0.1:27017/voltix-rbac-test`) and deletes everything it creates; it skips itself if MongoDB is unavailable. `tests/rbac.unit.test.js` runs without a database.

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

1. **`frontend/scripts/pages/requests-admin.js` is dead code** — no HTML page imports it. It still contains the `await editingId ? \`/${editingId}\` : '', { method: ... }` bug (the object literal is `await`ed as a non-Promise), so PUT/POST calls never fire. The live studio is `frontend/scripts/pages/admin.js`.
2. **The studio's "New request" / request "Delete" buttons call endpoints the API does not implement** (`POST`/`DELETE /api/requests…`; only `GET` and `PUT /api/requests/:id` exist), so those two actions always error out.
3. **`backend/middleware/require-admin.js` is unused legacy** — the X-Admin header check now lives inside `requirePermission()` (`middleware/rbac.js`).
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
* **When adding a database-backed collection:** add a model in `backend/models/`, a router in `backend/routes/`, register it in `backend/app.js` (`createApp()`), and (optionally) seed it.
* **When protecting a route:** never compare `role === 'admin'` inside a handler — add a permission code to `backend/rbac/permissions.js` (if it is new) and guard the route with `requirePermission('<resource>:<action>')` from `backend/middleware/rbac.js`. Add the permission to each role that should hold it, then cover it in `backend/tests/`.
* **When changing the shop catalogue:** the source of truth is MongoDB (`Product` model). Shop items are created/edited/deleted from the admin studio (`/admin` → "Shop catalogue", `products:*` permissions); the hardcoded `backend/seed-products.js` seeder was removed on purpose — never re-add manual catalogue data, and never insert products from `server.js`.
* **Verify with the automated tests:** `cd backend && npm test` runs the RBAC unit + API tests; `verify_ui.py` (Playwright) is a separate front-end smoke test that opens the auth modal.
