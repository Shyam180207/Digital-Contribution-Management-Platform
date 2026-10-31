# CommonFund — Community Contribution Management

CommonFund helps community savings groups and cooperatives manage members,
contributions, payouts, and supporting receipts in one account-scoped
application.

## Problem Statement

Community funds are often tracked in paper ledgers or disconnected
spreadsheets. This makes it difficult to keep accurate transaction histories,
understand group activity, and ensure that financial records are visible only
to the people authorized to manage them.

## Proposed Solution

CommonFund provides a web dashboard for managing savings groups and their
members, recording contributions and payouts, and reviewing transaction
activity. A React frontend communicates with an authenticated API backed by
MongoDB. The API scopes records to the signed-in user and supports receipt
uploads and optional Google sign-in and AI-generated note suggestions.

## Technology Stack

- **Frontend:** React 19, Vite, JavaScript, CSS
- **API:** Node.js, Express 5
- **Database:** MongoDB with Mongoose
- **Authentication:** username/password with `scrypt` password hashing, JWTs
  in HttpOnly cookies, CSRF protection, and optional Google OAuth
- **Optional AI:** Gemini `generateContent` API; the key is kept on the server
- **Testing:** Node.js built-in test runner and Supertest; Oxlint for client linting
- **Deployment/container configuration:** Render Blueprint, Netlify, Docker,
  Docker Compose, and Nginx

## Architecture Overview

```text
Browser
  └── React single-page application (Vite build)
        └── same-origin /api requests
              └── Express API
                    ├── MongoDB (users, groups, members, transactions)
                    ├── receipt storage (local or configured volume)
                    └── Gemini API (optional note suggestions)
```

In local development, Vite proxies `/api` requests to the API. In the
containerized setup, Nginx serves the frontend and proxies `/api` to Express.
This keeps browser API calls same-origin for cookie-based authentication.
MongoDB references represent user/group/member/transaction relationships;
the API also checks ownership and relationships before reading or changing
records.

## Key Features

- Create an account and sign in with a username and password; Google sign-in
  is optional.
- Create savings groups, manage members, and review the dashboard.
- Record, edit, and delete contributions and payouts.
- Upload, replace, download, and remove transaction receipts.
- Use an optional Gemini suggestion to draft a transaction note; the note
  remains editable.
- Keep transaction and group data scoped to the authenticated account.
- Explore documented API requests in the Bruno collection.

## Installation Instructions

Prerequisites: Node.js 24 (or the version specified in deployment), npm, and a
MongoDB instance. From the repository root:

```sh
git clone https://github.com/Shyam180207/Digital-Contribution-Management-Platform.git
cd Digital-Contribution-Management-Platform
```

### Environment Setup

Copy the server template and configure it before starting the API:

```sh
cp server/.env.example server/.env
```

At minimum, set `MONGODB_URI` to a reachable MongoDB database and
`JWT_SECRET` to a private, random value of at least 32 characters. Keep
`server/.env` and all credentials out of version control. The template also
documents optional `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_REDIRECT_URI`, `GEMINI_API_KEY`, and `GEMINI_MODEL` settings. OAuth
redirect URLs must exactly match the Google Cloud configuration. Gemini
suggestions remain unavailable until a server-side API key is configured;
other application workflows do not require it.

See [server/.env.example](./server/.env.example) and the [API setup and
configuration guide](./server/README.md#configure-and-run) for details.

## Running the Project

Start MongoDB, then run the API in one terminal:

```sh
cd server
npm ci
npm run dev
```

In another terminal, run the frontend:

```sh
cd client
npm ci
npm run dev
```

Open the local URL printed by Vite (normally
[http://localhost:5173](http://localhost:5173)). Vite proxies API requests to
`http://127.0.0.1:3001`. The API health endpoint is
[http://127.0.0.1:3001/api/health](http://127.0.0.1:3001/api/health).

### Run the complete stack with Docker Compose

Install Docker with Compose v2, then from the repository root:

```sh
export JWT_SECRET="$(openssl rand -base64 48)"
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080). Compose starts MongoDB,
the API, and an Nginx-served production frontend. MongoDB data and receipt
files use named volumes. Stop with `Ctrl+C`, then run `docker compose down`.
Use `docker compose down -v` only when intentionally deleting the local data.
Google OAuth and Gemini can be enabled by exporting their environment
variables before starting Compose.

## Tests and Quality Checks

```sh
cd server && npm test
cd ../client && npm test && npm run lint && npm run build
```

The server tests use Node's built-in test runner and Supertest. Client API
tests use Node's built-in test runner. The production frontend build is written
to `client/dist/`.

## Deployment Links and Status

The repository includes [Render configuration](./render.yaml) for the API and
[Netlify configuration](./netlify.toml) for the frontend. The configured API
health-check URL is
[https://commonfund-api.onrender.com/api/health](https://commonfund-api.onrender.com/api/health).
It could not be reached from the development environment during final
preparation, so its availability and database connectivity are **not
verified**. A public Netlify site URL has not been confirmed; the Netlify
configuration currently proxies `/api` to the Render URL above.

Before sharing this project as a live deployment, deploy the Render Blueprint
with a private MongoDB Atlas URI, deploy the frontend to Netlify, set the API's
`CLIENT_ORIGIN` to the assigned frontend origin, and verify health, sign-in,
database-backed group/transaction workflows, and receipt behavior on the
public URLs. See the [Render deployment guide](./server/README.md#deploy-the-backend-to-render)
and [Netlify deployment guide](./client/README.md#deploy-to-netlify). The
Render free plan uses an ephemeral filesystem, so uploaded receipts may be
lost on service restart or redeploy unless persistent storage is configured.

## Folder Structure

```text
client/       React application, tests, Vite and Nginx configuration
server/       Express API, MongoDB models, tests, environment template
bruno/        Bruno API collection and local environment
render.yaml   Render API service blueprint
netlify.toml  Netlify frontend build and API rewrites
docker-compose.yml
              Local MongoDB, API, and frontend services
```

## Future Improvements

- Complete and verify public frontend and backend deployments.
- Use durable object storage for receipt files in production.
- Add end-to-end tests for deployed authentication and core group workflows.
- Add monitoring, backups, and operational alerts for production services.

## Contributors

- [Shyam180207](https://github.com/Shyam180207) — project author
