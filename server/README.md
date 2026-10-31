# CommonFund API

The Express API uses MongoDB through the Mongoose models in `models/`. It
provides account registration and login, an authenticated dashboard read, and
group and member writes. Each dashboard query is scoped to the signed-in user.
Sessions are stored in MongoDB, passwords are hashed with Node's `scrypt`, and
state-changing requests require the session's CSRF token.

## Configure and run

1. Start a MongoDB instance.
2. Copy `.env.example` to `.env` and set a long, random `SESSION_SECRET`.
3. Install and start the API:

   ```sh
   npm install
   npm run dev
   ```

4. In another terminal, start the React client:

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
- `GET /api/auth/session` provides the current session and CSRF token.
- `POST /api/auth/register`, `POST /api/auth/login`, and `POST /api/auth/logout`
  manage the account session.
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

JSON writes require an `X-CSRF-Token` header from the auth session endpoint.

## Validate

```sh
npm test
npm audit
```
