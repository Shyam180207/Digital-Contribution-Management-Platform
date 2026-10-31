# CommonFund client

The React frontend for CommonFund, a community contribution management
platform. The dashboard reads account data from the authenticated Express API.

## Run locally

Start MongoDB and the API first; see [`../server/README.md`](../server/README.md).
Then run:

```sh
npm install
npm run dev
```

The Vite development server proxies API requests to the local Express server.
Register an account to create groups and view account-scoped data.

## Available scripts

- `npm run dev` starts the Vite development server.
- `npm run build` creates the production build in `dist/`.
- `npm run preview` serves the production build locally.
- `npm run lint` checks the client source with Oxlint.
