# QR Trainer Attendance System

Production-ready QR attendance for personal trainers, built with Next.js, TailwindCSS, Framer Motion, Vercel serverless APIs, Google Sheets, and generated PNG QR codes.

## Features

- Auto client check-ins at `/checkin?clientId=...` with no client button click
- Admin dashboard at `/dashboard`
- Client create, soft delete, disable/enable QR access
- PNG QR download per client
- Live check-in feed with 15-second polling
- Manual attendance entries
- Google Sheets as the primary database
- Structured API responses and retry handling around Sheets writes
- Optional admin token protection for trainer APIs

## Google Sheet

Create one Google Sheet and share it with your Google service account email as Editor.

The app creates and maintains these tabs automatically:

### Clients

| ClientId | Name | QrUrl | Status | CreatedAt |

### CheckIns

| ClientId | Name | Timestamp | Date | ManualOverride |

## Environment Variables

Copy `.env.example` to `.env.local` for local development or add the same keys in Vercel.

```bash
GOOGLE_SHEETS_ID=
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
BASE_URL=https://trainer-checkin-system.vercel.app
ADMIN_API_TOKEN=
```

`ADMIN_API_TOKEN` is optional locally, but strongly recommended in production. When set, the dashboard stores the token in browser localStorage and sends it as `x-admin-token`.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000/dashboard`.

## Vercel Deployment

1. Push this project to GitHub.
2. Import the repo into Vercel.
3. Add the environment variables above.
4. Set `BASE_URL` to your Vercel production URL or custom domain.
5. Deploy.

## API Routes

- `POST /api/create-client`
- `POST /api/checkin`
- `PATCH /api/client`
- `DELETE /api/client?clientId=...`
- `POST /api/manual-entry`
- `GET /api/dashboard`
- `POST /api/qr`

All API responses follow:

```json
{ "success": true, "message": "Done", "data": {} }
```

or:

```json
{ "success": false, "error": "Reason" }
```
