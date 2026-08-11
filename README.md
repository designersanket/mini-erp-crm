# Mini ERP + CRM Operations Portal

A small ERP/CRM system for a wholesale/distribution company, built as a Full Stack Developer case study.
It covers customers (CRM), products & inventory, and sales challans with real stock-deduction business logic,
used by Admin, Sales, Warehouse, and Accounts roles.

---

## 1. Tech Stack

**Backend:** Node.js, TypeScript, Express.js, MySQL (via `mysql2`), JWT auth, `express-validator`
**Frontend:** React + TypeScript (Vite), React Router, Axios, plain CSS (no UI framework, hand-built admin theme)
**Database:** MySQL (schema in `backend/schema.sql`)

---

## 2. Project Structure

```
mini-erp-crm/
├── backend/
│   ├── src/
│   │   ├── config/         # env loader, MySQL pool
│   │   ├── middleware/      # auth (JWT), role guard, validation, error handler
│   │   ├── controllers/     # route handlers (auth, users, customers, products, challans)
│   │   ├── routes/          # Express routers per module
│   │   ├── utils/           # ApiError, asyncHandler, JWT signer, challan number generator
│   │   ├── db/seed.ts        # seeds demo users + sample data
│   │   ├── types/           # shared TypeScript types
│   │   ├── app.ts           # Express app (middleware + route wiring)
│   │   └── server.ts        # entry point
│   ├── schema.sql           # full MySQL schema (run this first)
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/client.ts     # axios instance with JWT interceptor
│   │   ├── context/AuthContext.tsx
│   │   ├── components/       # Layout (sidebar), ProtectedRoute
│   │   ├── pages/             # Login, Dashboard, Customers, Products, Challans, Users
│   │   └── styles/global.css
│   ├── package.json
│   └── .env.example
├── postman_collection.json   # importable Postman collection, all endpoints
└── README.md                 # this file
```

---

## 3. Architecture (short explanation)

- **Backend** is a layered REST API: `routes` → `controllers` → raw parameterized SQL via a `mysql2` connection
  pool (`config/db.ts`). No ORM was used deliberately, to keep the schema and queries explicit and easy to review.
- **Auth** is stateless JWT. `authenticate` middleware verifies the token and attaches `req.user`; `authorize(...roles)`
  restricts specific routes to specific roles (e.g. only `admin`/`warehouse` can create products).
- **Business-critical writes** (challan confirm/cancel, manual stock movements) run inside MySQL transactions
  with `SELECT ... FOR UPDATE` row locks, so stock can never go negative even under concurrent requests, and a
  failure at any step rolls back the whole operation.
- **Challans store a snapshot** of each product's name/SKU/price at the moment it's added (`challan_items` table),
  so historical challans stay accurate even if a product is later renamed or repriced — while `product_id` is
  still kept as a live reference.
- **Frontend** is a single-page app behind a `ProtectedRoute` gate; the Axios client attaches the JWT to every
  request and force-redirects to `/login` on a 401.

---

## 4. Database Design Summary

| Table | Purpose |
|---|---|
| `users` | login + role (`admin`, `sales`, `warehouse`, `accounts`) |
| `customers` | CRM records (lead/active/inactive, type, follow-up date) |
| `customer_notes` | one-to-many follow-up notes per customer |
| `products` | inventory master (SKU, price, current stock, min alert, location) |
| `stock_movements` | append-only ledger of every IN/OUT change, with reason + who + when |
| `challans` | sales challan header (auto number, status, customer) |
| `challan_items` | line items with **snapshotted** product name/SKU/price + quantity |

Full DDL with indexes and foreign keys is in [`backend/schema.sql`](backend/schema.sql).

---

## 5. Local Setup

### Prerequisites
- Node.js 18+
- MySQL 8+ (or MariaDB 10.6+) running locally, or a free hosted instance (see §7)

### Step 1 — Create the database and load the schema
```bash
mysql -u root -p -e "CREATE DATABASE mini_erp_crm CHARACTER SET utf8mb4;"
mysql -u root -p mini_erp_crm < backend/schema.sql
```

### Step 2 — Backend
```bash
cd backend
cp .env.example .env
# edit .env: set DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET to your own values
npm install
npm run seed     # creates 1 demo login per role + sample products/customer
npm run dev       # starts on http://localhost:5000
```

### Step 3 — Frontend
```bash
cd frontend
cp .env.example .env
# edit .env if your backend isn't on http://localhost:5000
npm install
npm run dev       # starts on http://localhost:5173
```

Open `http://localhost:5173` and log in with any of the seeded demo accounts below.

### Demo login credentials (all roles, password is the same)
| Role | Email | Password |
|---|---|---|
| Admin | admin@example.com | Password@123 |
| Sales | sales@example.com | Password@123 |
| Warehouse | warehouse@example.com | Password@123 |
| Accounts | accounts@example.com | Password@123 |

---

## 6. Environment Variables

**backend/.env**
```
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=mini_erp_crm
JWT_SECRET=replace_this_with_a_long_random_string
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5173
```

**frontend/.env**
```
VITE_API_BASE_URL=http://localhost:5000
```

Neither `.env` file is committed — only the `.env.example` templates are, per standard practice.

---

## 7. Deployment

No live/hosted deployment is included with this submission (see "Known limitations" below); the project runs
fully locally following §5. The intended free-tier deployment path, if hosted, would be:

- **Frontend:** Vercel or Netlify — `npm run build` in `frontend/` produces a static `dist/` folder; set
  `VITE_API_BASE_URL` to the deployed backend URL as a build-time environment variable.
- **Backend:** Render or Railway — set the environment variables from §6 in the platform's dashboard (never
  commit real secrets), build command `npm install && npm run build`, start command `npm start`.
- **Database:** a managed free MySQL instance (e.g. Railway MySQL, Aiven free tier, or PlanetScale) — apply
  `backend/schema.sql` to it the same way as in §5, then point `DB_HOST`/`DB_USER`/etc. at it.
- AWS deployment (EC2 + RDS) was treated as the optional bonus per the brief and was not attempted in the
  48-hour window in favor of completing all core modules correctly.

### How the server would be set up in production
1. Provision the MySQL database and run `schema.sql` against it.
2. Deploy `backend/` as a Node process (`npm run build && npm start`), with all secrets injected as environment
   variables by the hosting platform — never hardcoded.
3. Deploy `frontend/` as a static build, configured with the live backend URL.
4. Point CORS_ORIGIN on the backend at the live frontend URL.

---

## 8. API Overview

All endpoints are prefixed with the backend base URL (e.g. `http://localhost:5000`). Full request/response
examples are in [`postman_collection.json`](postman_collection.json) — import it directly into Postman.

| Method | Endpoint | Roles | Notes |
|---|---|---|---|
| POST | `/auth/login` | public | returns JWT + user |
| GET | `/auth/me` | any authenticated | current user |
| GET/POST | `/users` | admin | manage employee accounts |
| DELETE | `/users/:id` | admin | deactivate account |
| GET | `/customers` | any | search, filter by status/type, paginated |
| GET | `/customers/:id` | any | detail + follow-up notes |
| POST/PUT | `/customers` `/customers/:id` | admin, sales | create/edit |
| POST | `/customers/:id/notes` | admin, sales | add follow-up note |
| GET | `/products` | any | search, `low_stock=true` filter, paginated |
| POST/PUT | `/products` `/products/:id` | admin, warehouse | create/edit |
| GET/POST | `/products/:id/movements` | any / admin+warehouse | stock ledger + manual IN/OUT adjustment |
| GET | `/challans` | any | filter by status/customer, paginated |
| POST | `/challans` | admin, sales | create as Draft or Confirmed |
| PUT | `/challans/:id` | admin, sales | edit line items (Draft only) |
| POST | `/challans/:id/confirm` | admin, sales, warehouse | reduces stock, blocks if insufficient |
| POST | `/challans/:id/cancel` | admin, sales | cancels; restores stock if was confirmed |

All endpoints validate input (`express-validator`), return proper HTTP status codes (400/401/403/404/409/500),
and JSON error bodies of the shape `{ success: false, message, details? }`.

---

## 9. Key Business Logic (Sales Challan → Stock)

- Confirming a challan (or creating one directly as `confirmed`) runs in a DB transaction: it locks the
  relevant product rows, validates **every** line item has enough stock, and only then deducts stock and
  writes `stock_movements` rows — all or nothing.
- If any line item's quantity exceeds `current_stock`, the API returns `400` with a clear message and **no**
  stock is touched.
- Cancelling a **confirmed** challan reverses the stock (adds it back) and logs a reversal movement; cancelling
  a **draft** challan has no stock impact since none was ever deducted.
- Only `draft` challans can be edited or confirmed; confirmed/cancelled challans are immutable.

---

## 10. Assumptions Made

- "Simple JWT-based authentication" was interpreted literally — no refresh tokens/sessions, just a signed JWT
  with an 8-hour expiry, per the brief's own suggestion.
- User account creation is admin-only (there's no public self-registration), matching an internal-tool context.
- Manual stock adjustments (`POST /products/:id/movements`) were added beyond the literal spec to make the
  "stock movement log" requirement fully testable/demonstrable independent of the challan flow (e.g. logging
  purchase-order receipts or damage write-offs), and are restricted to `admin`/`warehouse`.
- Currency is displayed as ₹ (INR) since the domain (GST field, wholesale/distributor customer types) implies
  an Indian business context; this is purely a UI label and not enforced anywhere in the data model.
- "Warehouse" role was given permission to confirm challans (not just Sales/Admin), since in practice it's
  often the warehouse team that finalizes dispatch — this can be tightened by editing `authorize(...)` in
  `challans.routes.ts` if a stricter interpretation is preferred.

---

## 11. Known Limitations / Incomplete Parts

- **No live deployment** is included with this submission — the app is fully functional locally (see §5),
  and Postman collection + this README serve as the required substitute per the brief's own fallback option.
- **No automated test suite** (unit/integration tests) was written given the 48-hour window; manual testing
  was done via Postman and the UI.
- **No PDF export** for challans/invoices (listed as a bonus in the brief, not attempted).
- **No Docker setup or CI/CD pipeline** (also listed as bonus items).
- **No file/image upload** (e.g. product images to S3) — not required by the core spec.
- Challan numbering (`CH-YYYY-NNNNNN`) is computed from a `COUNT(*)` within the transaction; it is safe under
  the row-locking used for stock but is not backed by a dedicated atomic sequence table, so under very high
  concurrent challan creation there is a theoretical (small) chance of a numbering gap — never a duplicate,
  since the column is `UNIQUE` and would raise a `409` instead.
- Password reset / "forgot password" flow is not implemented (out of scope for the brief).

---

## 12. Test Credentials Recap

| Role | Email | Password |
|---|---|---|
| Admin | admin@example.com | Password@123 |
| Sales | sales@example.com | Password@123 |
| Warehouse | warehouse@example.com | Password@123 |
| Accounts | accounts@example.com | Password@123 |
