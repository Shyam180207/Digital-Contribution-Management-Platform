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

## Deploy to Netlify

The repository-root [`netlify.toml`](../netlify.toml) configures Netlify to use
`client/` as the base directory, run `npm run build`, and publish `dist/`.
Import the GitHub repository in Netlify and use the detected configuration.
The `/api/*` rewrite proxies requests to the Render API at
`https://commonfund-api.onrender.com`, keeping API calls and authentication
cookies same-origin with the frontend. If Render assigns a different service
URL, update the proxy target in `netlify.toml` to that service's HTTPS URL and
redeploy.

After the Netlify site has a URL, set `CLIENT_ORIGIN` on the Render API to the
site's exact HTTPS origin (for example, `https://commonfund.netlify.app`).
For Google sign-in, set `GOOGLE_REDIRECT_URI` to
`<Netlify origin>/api/auth/google/callback` and register that exact callback in
Google Cloud Console. Then set the Netlify site URL as an authorized origin
where applicable. The API must be deployed and reachable before authenticated
frontend features can work.

## Available scripts

- `npm run dev` starts the Vite development server.
- `npm run build` creates the production build in `dist/`.
- `npm run preview` serves the production build locally.
- `npm run lint` checks the client source with Oxlint.
