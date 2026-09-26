# Deploying Kawayan Atlas to Render (Docker, free tier)

Both services run as Docker containers built straight from this repo. Render builds the
images itself, so there is no container registry — which is the only part of the Azure
path in [DEPLOY.md](DEPLOY.md) that costs money.

- **Frontend** (`frontend/`, Next.js 14) → Render Web Service, Docker
- **Backend** (`backend/`, FastAPI) → Render Web Service, Docker
- **Database** → the existing Neon Postgres (nothing to change)

Commands are **Windows PowerShell**, one line each — paste them one at a time.

---

## Cost

**$0.** Everything below is Render's free tier plus Neon's free tier.

The trade-off: a free service **spins down after ~15 minutes idle** and takes up to a
minute to wake. Two services spin down independently, so a cold visitor waits for the
page and then waits again for the first API call. See [Before a demo](#before-a-demo).

Free web services also share a pool of **750 instance-hours/month per account**. That is
plenty while services scale to zero, but it is shared with any other free services on
the same account.

---

## Before you start

1. A [Render](https://render.com) account connected to this GitHub repo (no card needed).
2. Your **Neon connection string** — it is already in `backend/.env` on the
   `DATABASE_URL=` line. Copy it from there. Never commit it.
3. The branch you want to deploy. `render.yaml` lives on **`v2`**, and `v2` is currently
   12 commits ahead of `main`. Render lets you pick the branch, so you do **not** need to
   merge into `main` to deploy.

---

## Step 1 — Generate a signing key

Auth tokens are stateless HMACs, so this key is what stops someone forging a login for
any account. The backend **refuses to start** without it (see [Step 3](#step-3--set-the-backend-environment-variables)).

Generate a fresh one and keep the output somewhere safe:

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
```

---

## Step 2 — Create the services from the blueprint

1. Render Dashboard → **New +** → **Blueprint**.
2. Pick this repository.
3. Set **Branch** to `v2`.
4. Render reads [render.yaml](render.yaml) and proposes two services,
   `kawayan-backend` and `kawayan-frontend`.
5. It will prompt for the variables marked `sync: false`. Fill in the backend ones now
   and leave the rest blank — you cannot know the URLs yet:

   | Service | Variable | Value |
   |---|---|---|
   | backend | `SECRET_KEY` | the key from Step 1 |
   | backend | `DATABASE_URL` | the Neon string from `backend/.env` |
   | backend | `CORS_ORIGINS` | *leave blank — Step 5* |
   | frontend | `NEXT_PUBLIC_API_URL` | *leave blank — Step 4* |

6. **Apply**. The backend builds; the frontend will fail or come up misconfigured until
   Step 4, which is expected.

> **Why the order?** `NEXT_PUBLIC_API_URL` is compiled into the browser bundle at
> **build** time, so the frontend cannot be built until the backend URL exists.

---

## Step 3 — Set the backend environment variables

If you skipped them in Step 2: backend service → **Environment** → add `SECRET_KEY` and
`DATABASE_URL`, then **Save** (this redeploys).

`render.yaml` sets `ENVIRONMENT=production`, which arms the startup check in
`app/config.py`. With `ENVIRONMENT=production` and no `SECRET_KEY`, the process exits
with `Refusing to start: SECRET_KEY is unset`. That is intentional — it fails closed
rather than serving forgeable sessions.

---

## Step 4 — Point the frontend at the backend

Copy the backend's URL from its Render page (it looks like
`https://kawayan-backend.onrender.com`) and confirm it is alive:

```powershell
curl https://kawayan-backend.onrender.com/api/health
```

Expect `{"status":"ok","calculator_enabled":false}`. The first call may take ~1 minute
if the service is cold.

Then: frontend service → **Environment** → set `NEXT_PUBLIC_API_URL` to that URL →
**Save**, then **Manual Deploy → Clear build cache & deploy**.

> Clear the cache. The value is baked in at build time, so a cached build can keep the
> old value.

---

## Step 5 — Let the backend accept the frontend (CORS)

Copy the frontend URL (e.g. `https://kawayan-frontend.onrender.com`), then: backend
service → **Environment** → set `CORS_ORIGINS` to it → **Save**.

No trailing slash. Comma-separate if you add more origins later.

---

## Step 6 — Smoke test

Open the frontend URL and check:

1. **Atlas** lists the 6 bamboo species — proves the DB connection works.
2. **Joints** and **Templates** load.
3. **Design Lab** opens and evaluates a graph.
4. **Log in** → register an account, save a design, log out, log back in, confirm the
   design is still listed — proves accounts and ownership work end to end.
5. **Calculator** stays gated, showing its advisory notice rather than numbers.

---

## Before a demo

Cold starts are the one rough edge of the free tier. Warm both services a minute or two
beforehand:

```powershell
curl https://kawayan-backend.onrender.com/api/health; curl https://kawayan-frontend.onrender.com
```

---

## Troubleshooting

**Backend exits immediately, log says `Refusing to start: SECRET_KEY is unset`**
Working as designed. Set `SECRET_KEY` (Step 1/3).

**Frontend loads but no species, joints, or templates appear**
The API URL did not reach the build. Open the browser devtools Network tab — if requests
go to `127.0.0.1:8020`, the build arg was not applied. `frontend/Dockerfile` declares
`ARG NEXT_PUBLIC_API_URL`, so if Render did not pass the env var into the build, add it
explicitly under the frontend service in `render.yaml`:

```yaml
    dockerBuildArgs:
      NEXT_PUBLIC_API_URL:
        sync: false
```

**Requests fail with a CORS error in the console**
`CORS_ORIGINS` does not exactly match the frontend origin. Check scheme and trailing slash.

**First request hangs ~1 minute**
Normal cold start on the free tier.

---

## Updating after code changes

Push to `v2` and Render redeploys automatically.

**Database migrations do not run automatically.** The Docker `CMD` only starts uvicorn.
The schema is currently at head (`c3d4e5f6a7b8`) and seeded, so nothing is needed today.
If you add a migration later, apply it from your machine against the same Neon database:

```powershell
cd backend
```

```powershell
.venv\Scripts\python.exe -m alembic upgrade head
```

`Base.metadata.create_all()` does run at startup here (it is skipped only on Vercel), but
it only creates *missing tables* — it never adds columns to an existing one. That is why
migrations still matter.

---

## Environment variables reference

| Variable | Service | Value | Notes |
|---|---|---|---|
| `SECRET_KEY` | backend | long random string | **Required.** Startup fails on the default. |
| `DATABASE_URL` | backend | Neon `postgresql+psycopg://...` | From `backend/.env`. |
| `CORS_ORIGINS` | backend | frontend URL | Comma-separated, no trailing slash. |
| `ENVIRONMENT` | backend | `production` | Set in `render.yaml`; arms the key check. |
| `CALCULATOR_ENABLED` | backend | `false` | Keep off until an engineer signs off. |
| `SEED_ON_STARTUP` | backend | `true` | No-op once species exist; only seeds an empty DB. |
| `NEXT_PUBLIC_API_URL` | frontend | backend URL | **Build-time**, not runtime. Rebuild to change. |
