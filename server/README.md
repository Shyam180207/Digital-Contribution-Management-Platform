# CommonFund API

The Express API uses MongoDB through the Mongoose models in `models/`. It
provides account registration and login, an authenticated dashboard read, and
group and member writes. Each dashboard query is scoped to the signed-in user.
Authentication uses short-lived JWTs in HttpOnly cookies. CSRF protection uses
a separate readable cookie and requires its value in the `X-CSRF-Token` header
for state-changing requests. Passwords are hashed with Node's `scrypt`.
Usernames are case-insensitive, and passwords must contain 10–128 characters.

## Data relationships

MongoDB documents use Mongoose `ObjectId` references: a user owns savings
groups, each group contains members and transactions, and each transaction
references its group, member, and creating user. The models expose inverse
`groups`, `members`, and `transactions` virtuals for population without
duplicating relationship IDs. API write operations verify group ownership and
that a transaction's member belongs to the same group; MongoDB references are
not foreign keys and do not enforce those checks by themselves.

## Configure and run

1. Start a MongoDB instance.
2. Copy `.env.example` to `.env` and set a strong, random `JWT_SECRET` of at
   least 32 characters. Keep it private; changing it invalidates issued tokens.
3. To enable Google sign-in, create an OAuth 2.0 Web application client in
   Google Cloud Console. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
   `GOOGLE_REDIRECT_URI`; the redirect URI must exactly match the authorized
   redirect URI configured with Google. For local development, use the example
   callback URI from `.env.example`.
4. Install and start the API:

   ```sh
   npm install
   npm run dev
   ```

5. In another terminal, start the React client:

   ```sh
   cd ../client
   npm install
   npm run dev
   ```

Vite proxies `/api` requests to `http://127.0.0.1:3001`. The API listens on
loopback by default and exits with a configuration or database connection error
instead of falling back to in-memory or demo data. Set `HOST=0.0.0.0` when
running behind a hosting provider's web proxy.

## API endpoints

- `GET /api/health` reports whether MongoDB is connected.
- `GET /api/auth/session` provides the current user and CSRF token.
- `POST /api/auth/register`, `POST /api/auth/login`, and `POST /api/auth/logout`
  manage authentication using JWT cookies. The token is not returned in JSON.
- `GET /api/auth/google` starts Google OAuth, and
  `GET /api/auth/google/callback` verifies Google's response and signs the user
  into the same JWT-cookie authentication flow. Google accounts are identified
  by Google's stable subject claim; their generated CommonFund username is not
  their email address.
- `GET /api/dashboard`, `GET /api/groups`, and `GET /api/members` read data
  belonging to the authenticated account.
- `GET /api/groups/:groupId/members` and
  `GET /api/groups/:groupId/transactions` read records from a group owned by
  the authenticated account.
- `GET /api/transactions` lists transactions across the authenticated
  account's groups.
- `POST /api/groups` creates a group owned by the authenticated account.
- `POST /api/groups/:groupId/members` adds a member only to an owned group.
- `POST /api/groups/:groupId/transactions` records a contribution or payout
  for a member of an owned group. Amounts use integer minor currency units
  (for example, `1250` represents 12.50).
- `PUT /api/groups/:groupId/transactions/:transactionId` replaces a
  transaction's member, kind, amount, and note within an owned group.
- `DELETE /api/groups/:groupId/transactions/:transactionId` deletes a
  transaction only when it belongs to a group owned by the signed-in user.
- `POST`, `GET`, and `DELETE /api/groups/:groupId/transactions/:transactionId/receipt`
  upload, download, or remove a receipt for a transaction in an owned group.
  Receipts are limited to 5 MB and PDF, JPEG, PNG, or WebP; downloads are
  authenticated and sent as attachments.

JSON writes require an `X-CSRF-Token` header from the auth session endpoint.
The authentication cookie is HttpOnly, SameSite=Lax, and Secure in production.
JWTs expire after one hour; users can refresh the session endpoint to validate
the current token and retrieve their user profile.
Receipt files are stored under `server/uploads/receipts` by default, which is
excluded from version control. Set `RECEIPT_STORAGE_DIR` to use a persistent
storage volume in deployment.

## Deploy the backend to Render

The repository-root [`render.yaml`](../render.yaml) defines a free Node web
service rooted at `server/`. In Render, sign in with your account, choose
**New > Blueprint**, connect this repository and deploy the Blueprint. It runs
`npm ci`, starts the API with `npm start`, and checks `/api/health`. The
Blueprint binds the API to `0.0.0.0`, uses Render's `PORT`, enables production
cookie settings, and generates a private `JWT_SECRET`.

Before creating the service, prepare a MongoDB Atlas database and enter its
connection URI as `MONGODB_URI` in Render's private Blueprint prompt or service
environment settings. Do not use the local `mongodb://127.0.0.1` example. Allow
connections from the Render service's outbound IP addresses in Atlas; avoid
opening the database to all IP addresses. After deployment, check
`https://<service-name>.onrender.com/api/health`; it should return 200 with
`{"status":"ok"}` when MongoDB is reachable.

This Blueprint deploys the API only, not the React client. If the client is
hosted separately, set `CLIENT_ORIGIN` to its exact HTTPS origin in Render.
Google sign-in is optional; to enable it, set `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in Render, and register the
exact callback URL `https://<service-name>.onrender.com/api/auth/google/callback`
with Google.

The selected free plan uses an ephemeral filesystem. Receipt uploads are
available, but stored files may be lost when the service restarts or redeploys.
The MongoDB records remain persistent; use a paid persistent disk or external
object storage if receipt files must survive service replacement.

## Run the complete app with Docker

The repository-root [`docker-compose.yml`](../docker-compose.yml) runs MongoDB,
the API, and the production React client behind Nginx. Follow the
[Docker Compose instructions](../README.md#run-with-docker-compose) from the
repository root. The API container binds to `0.0.0.0`; its database URI points
to the Compose MongoDB service. Local MongoDB and receipt files are persisted
using named volumes.

## Bruno collection

The [`bruno/`](../bruno/) folder contains a Bruno collection documenting all
21 API endpoints, including authentication, Google OAuth, group and transaction
operations, and receipt uploads. Open that folder as a collection in Bruno and
select the **Local** environment. Set a unique local username and password, and
set `receiptFile` to an absolute path to a PDF, JPEG, PNG, or WebP file before
sending the receipt upload request.

Start with **Health**, then **Get session and CSRF token**, and register or log
in. Bruno's cookie jar keeps the JWT and CSRF cookies; response scripts save the
CSRF token and the IDs returned by group, member, and transaction creation in
the Local environment. These scripts update `Local.bru`; do not commit local
credentials or values written while testing. Google OAuth must be completed in
a browser; its callback template is included for route reference and should not
be sent manually.

## Validate

```sh
npm test
npm audit
```
