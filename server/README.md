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
loopback and exits with a configuration or database connection error instead
of falling back to in-memory or demo data.

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

## Validate

```sh
npm test
npm audit
```
