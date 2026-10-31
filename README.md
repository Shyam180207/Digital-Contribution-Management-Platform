# CommonFund — Community Contribution Management

CommonFund is a digital contribution management platform for community savings
groups and cooperatives. It replaces scattered paper records with an organized
record of groups, members, contributions, and payouts so that members can track
their shared finances and reduce misunderstandings.

## Run the React app and API

The React client uses the Express API, which stores accounts, groups, members,
and transactions in MongoDB. Configure and start MongoDB and the API using
[server/README.md](./server/README.md), then start the client using
[client/README.md](./client/README.md). The API requires `MONGODB_URI` and a
private `JWT_SECRET`; copy `server/.env.example` to `server/.env` to
configure them locally.

## Run with Docker Compose

Install Docker Desktop (or Docker Engine with Compose v2), then start the full
stack from the repository root:

```sh
export JWT_SECRET="$(openssl rand -base64 48)"
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080). The Compose stack starts
MongoDB, the Express API, and an Nginx-served React build. Nginx proxies `/api`
requests to the API, so the browser uses same-origin authentication cookies.
MongoDB records and uploaded receipts use named Docker volumes and survive
container recreation. Stop the stack with `Ctrl+C`, then run
`docker compose down`; use `docker compose down -v` only when intentionally
removing the local database and receipt data. Set Google OAuth variables in
your shell if you want to test Google sign-in locally.

## Capstone plan

### Day 1: Define the product and data model

Confirm the core workflows, user roles, and contribution/payout rules. Design
the database schema and outline the main screens.

### Day 2: Build account and group management

Implement registration and login, then let users create and manage their
savings groups.

### Day 3: Add member and transaction workflows

Build member management and record contributions and payouts with input
validation.

### Day 4: Show balances and activity

Create a dashboard and group detail view that summarize totals and show a
readable transaction history.

### Day 5: Test core behavior

Test authentication, group ownership, transaction validation, and balance
calculations. Fix issues found in the main workflows.

### Day 6: Improve usability

Refine navigation, forms, feedback messages, and responsive layouts. Review
accessibility and make the interface easier to use on smaller screens.

### Day 7: Prepare the project for review

Run the full test suite, update setup and usage documentation, prepare a demo,
and review the project for submission.

## Mock UX Design

**Public interactive prototype:**
https://raw.githack.com/Shyam180207/Digital-Contribution-Management-Platform/feature/mock-ux-design/static/mock-ux.html

This clickable mock demonstrates the overview, group list, member roster, group workspace, transaction ledger, and settings. Try creating groups, adding members, recording contributions and payouts, searching the ledger, and exporting a sample CSV. Prototype data is for demonstration and resets when the page reloads.
