# Deploying Kawayan Atlas (free tier, $0)

This deploys the **Release 1 demo** — full-stack, no login — entirely on free tiers:

| Piece | Service | Free? |
|---|---|---|
| Database | **Neon** Postgres | Free, no card, no expiry |
| Backend (FastAPI) | **Azure Container Apps** | Free monthly grant, scales to zero |
| Frontend (Next.js) | **Azure Static Web Apps** *or* **Vercel** | Free tier |

> **Why not Azure Postgres?** Azure's managed Postgres has no free-forever tier — that's
> the one paid piece we route around by using Neon. See PLAN.md §6.
>
> You run every command below — they need **your** accounts and logins, which is why this
> is a guide rather than something already deployed. Nothing here needs a credit card if
> you stay on the free tiers named.

---

## Before you start

Create these free accounts (no card needed for the free tiers):
- [Neon](https://neon.tech) — Postgres
- [Azure](https://azure.microsoft.com/free) — grab **[Azure for Students](https://azure.microsoft.com/en-us/resources/students)** first if still eligible (before Sept 2026)
- A GitHub account (you likely have one) — for the frontend deploy
- Install the **Azure CLI** (`az`) and log in: `az login`

**Day-one cost guard:** in the Azure portal, set a **billing alert / budget** at, say, ₱100
before doing anything else.

---

## Step 1 — Database (Neon)

1. Create a Neon project → it gives you a connection string like:
   `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`
2. Convert it to the SQLAlchemy + psycopg form by inserting the driver:
   ```
   postgresql+psycopg://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
   Keep this string safe — it's `DATABASE_URL`.

That's the whole database step. The tables and seed data are created automatically on the
backend's first boot (Step 2 sets `SEED_ON_STARTUP=true`).

---

## Step 2 — Backend (Azure Container Apps)

From the `backend/` directory. Container Apps can build the image from source, so you
don't even need Docker running locally.

```bash
# one-time: install the extension
az extension add --name containerapp --upgrade

# variables — edit these
RG=kawayan-rg
LOC=southeastasia
ENVNAME=kawayan-env
APPNAME=kawayan-api
DATABASE_URL='postgresql+psycopg://USER:PASS@HOST/neondb?sslmode=require'

az group create -n $RG -l $LOC
az containerapp env create -n $ENVNAME -g $RG -l $LOC

# build from the Dockerfile in this folder and deploy, with env vars
az containerapp up \
  -n $APPNAME -g $RG --environment $ENVNAME \
  --source . \
  --target-port 8000 --ingress external \
  --env-vars \
    DATABASE_URL="$DATABASE_URL" \
    SEED_ON_STARTUP=true \
    CORS_ORIGINS="https://REPLACE_WITH_FRONTEND_URL" \
    CALCULATOR_ENABLED=false
```

`az containerapp up` prints the app's URL, e.g. `https://kawayan-api.<hash>.southeastasia.azurecontainerapps.io`.
Test it:

```bash
curl https://kawayan-api.<hash>.southeastasia.azurecontainerapps.io/api/health
# {"status":"ok","calculator_enabled":false}
```

Note the URL — it's your `NEXT_PUBLIC_API_URL`. (You'll come back and fix `CORS_ORIGINS`
once you know the frontend URL — Step 4.)

> **Alternative — [Render](https://render.com):** New Web Service → connect the repo →
> root `backend/`, environment Docker. Add the same env vars. Also free (spins down when
> idle; first request after idle is a slow cold start).

---

## Step 3 — Frontend (choose one)

### Option A — Vercel (simplest, SSR just works)
1. Push this repo to GitHub.
2. On [Vercel](https://vercel.com): New Project → import the repo → **Root Directory =
   `frontend`**. It auto-detects Next.js.
3. Add an Environment Variable:
   `NEXT_PUBLIC_API_URL = https://kawayan-api.<hash>.southeastasia.azurecontainerapps.io`
4. Deploy. You get a URL like `https://kawayan-atlas.vercel.app`.

### Option B — Azure Static Web Apps (all-Azure)
1. Push the repo to GitHub.
2. Azure portal → **Create a resource → Static Web App** (Free plan).
3. Link your GitHub repo/branch. Build settings:
   - **App location:** `/frontend`
   - **Output location:** *(leave blank — the Next.js preset handles it)*
   - Build preset: **Next.js**
4. After creation, add application setting
   `NEXT_PUBLIC_API_URL = https://kawayan-api.<hash>...azurecontainerapps.io`, then
   re-run the generated GitHub Action.

Azure auto-creates the deploy workflow in `.github/workflows/`; let it manage that file.

---

## Step 4 — Wire CORS and finish

The backend must allow the real frontend origin. Update the backend env var to the URL
from Step 3 and it will redeploy:

```bash
az containerapp update -n $APPNAME -g $RG \
  --set-env-vars CORS_ORIGINS="https://kawayan-atlas.vercel.app"
```

Open the frontend URL. The landing gallery, atlas, and Design Studio should all load live
data from the backend. Done — a full-stack demo on $0.

---

## Later (Release 2)

- **Accounts/login:** add an auth provider (Azure AD B2C free tier, or self-rolled JWT).
- **Alembic migrations:** for schema changes past the demo, switch from `create_all` /
  `SEED_ON_STARTUP` to proper migrations (`alembic revision --autogenerate` / `upgrade`).
- **Turn the calculator on:** only after your brother (SME) reviews the numeric rules —
  then set `CALCULATOR_ENABLED=true` and replace the placeholder formulas.
- **Custom domain + outgrowing free tiers:** if Neon/Container Apps free limits pinch,
  migrate the DB to Azure Database for PostgreSQL (Postgres→Postgres, straightforward).
