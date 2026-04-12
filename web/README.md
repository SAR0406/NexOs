# NexOS Web App

This is the implementation scaffold for NexOS (AI Chief of Staff), built with Next.js App Router.

## Run locally

```bash
npm install
npm run dev
```

App: `http://localhost:3000`

## Included MVP surface

- Landing page (`/`)
- Dashboard (`/dashboard`)
- Chat page (`/chat`)
- Alerts page (`/alerts`)
- Settings page (`/settings`)
- API routes:
  - `POST /api/onboarding`
  - `POST /api/chat`
  - `GET /api/alerts`
  - `GET|POST /api/actions`
  - `GET /api/briefing`

## Notes

Current implementation uses a local mock data layer (`src/lib/mock-data.ts`) to provide end-to-end product flow while external integrations are wired in future iterations.
