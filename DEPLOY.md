# Deploying Kawayan Atlas to Azure (Tier 1 — demo / low-traffic)

> **This path costs ~$5/month** for the Azure Container Registry. For the same Docker
> containers at **$0**, see [DEPLOY-RENDER.md](DEPLOY-RENDER.md) — Render builds the images
> from the repo, so there is no registry to pay for.

This guide stands the app up on **Azure Container Apps** (both frontend and backend,
each scale-to-zero) with the database on **Neon**. It's built for occasional demo use:
when nobody's hitting it, compute scales to zero and costs ~nothing.

- **Frontend** (`frontend/`, Next.js 14) → Azure Container App
- **Backend** (`backend/`, FastAPI) → Azure Container App
- **Database** → Neon Postgres (keep your existing one)

Commands below are for **Windows PowerShell**. Each is a single line — paste them one at a time.

---

## Cost, honestly

- **Container Apps compute:** ~$0 for demo traffic (monthly free grant + scale-to-zero).
- **Azure Container Registry (Basic):** ~$5/month while it exists (fixed daily cost — the one
  thing that isn't free).
- **Neon:** $0 on the free tier.

So expect **~$5/month** while deployed. To pay **$0 between demos**, delete the whole
resource group when you're done (see [Teardown](#teardown)) and redeploy in ~10 minutes next time.

---

## Prerequisites

1. An Azure account ([free signup](https://azure.microsoft.com/free/) gives $200 credit for 30 days).
2. **Azure CLI** installed: `winget install Microsoft.AzureCLI` (restart the terminal after).
3. Your **Neon** connection string (from the Neon dashboard → Connection Details, the
   `postgresql://...` URL).
4. Log in and register the Container Apps provider (once per subscription):

```powershell
az login
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
```

---

## Step 0 — Set variables for this session

Edit the first three values, then paste the block.

```powershell
$DB   = "postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"   # your Neon URL
$LOC  = "southeastasia"                                            # closest region to PH
$RG   = "kawayan-rg"
$ACR  = "kawayanacr$(Get-Random -Maximum 9999)"                   # must be globally unique
$ENV  = "kawayan-env"
$SECRET = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
```

`$SECRET` is a fresh random signing key. The backend **refuses to start** in production on the
built-in default, so this must be a real value.

---

## Step 1 — Resource group, registry, environment

```powershell
az group create --name $RG --location $LOC
az acr create --resource-group $RG --name $ACR --sku Basic --admin-enabled true
az containerapp env create --name $ENV --resource-group $RG --location $LOC
```

---

## Step 2 — Build and deploy the backend

Build the backend image in the cloud (no local Docker needed):

```powershell
az acr build --registry $ACR --image kawayan-backend:latest ./backend
```

Deploy it. `SEED_ON_STARTUP=true` seeds the species data on first boot if the DB is empty;
`ENVIRONMENT=production` activates the secret-key safety check.

```powershell
az containerapp create --name kawayan-backend --resource-group $RG --environment $ENV --image "$ACR.azurecr.io/kawayan-backend:latest" --registry-server "$ACR.azurecr.io" --target-port 8000 --ingress external --min-replicas 0 --max-replicas 2 --env-vars "DATABASE_URL=$DB" "SECRET_KEY=$SECRET" "ENVIRONMENT=production" "CALCULATOR_ENABLED=false" "SEED_ON_STARTUP=true"
```

Grab the backend URL — you'll need it for the frontend build:

```powershell
$BACKEND = "https://" + (az containerapp show --name kawayan-backend --resource-group $RG --query "properties.configuration.ingress.fqdn" -o tsv)
$BACKEND
```

Sanity check (may take a few seconds on first cold start):

```powershell
curl "$BACKEND/api/health"
```

Expect `{"status":"ok","calculator_enabled":false}`.

---

## Step 3 — Build and deploy the frontend

`NEXT_PUBLIC_API_URL` is baked into the browser bundle **at build time**, so it's passed as a
build argument here — pointing at the backend from Step 2:

```powershell
az acr build --registry $ACR --image kawayan-frontend:latest --build-arg NEXT_PUBLIC_API_URL=$BACKEND ./frontend
```

```powershell
az containerapp create --name kawayan-frontend --resource-group $RG --environment $ENV --image "$ACR.azurecr.io/kawayan-frontend:latest" --registry-server "$ACR.azurecr.io" --target-port 3000 --ingress external --min-replicas 0 --max-replicas 2
```

Get the public URL people will visit:

```powershell
$FRONTEND = "https://" + (az containerapp show --name kawayan-frontend --resource-group $RG --query "properties.configuration.ingress.fqdn" -o tsv)
$FRONTEND
```

---

## Step 4 — Let the backend accept the frontend (CORS)

Now that the frontend URL exists, allow it through CORS:

```powershell
az containerapp update --name kawayan-backend --resource-group $RG --set-env-vars "CORS_ORIGINS=$FRONTEND"
```

Open `$FRONTEND` in a browser — the atlas, templates, and design lab should all load.

---

## Demo tip — avoid the cold-start pause

With scale-to-zero, the first request after an idle period takes a few seconds to wake.
Before presenting, warm both apps by opening the site (or run):

```powershell
curl "$BACKEND/api/health"; curl $FRONTEND
```

Do this a minute or two before your demo and it'll respond instantly when your audience hits it.

---

## Updating after code changes

Rebuild and the app picks up the new image on its next revision:

```powershell
az acr build --registry $ACR --image kawayan-backend:latest ./backend
az containerapp update --name kawayan-backend --resource-group $RG --image "$ACR.azurecr.io/kawayan-backend:latest"
```

Same pattern for the frontend (remember the `--build-arg` on the `acr build`).

---

## Teardown

To stop all charges (including the ~$5/mo registry), delete the resource group:

```powershell
az group delete --name $RG --yes --no-wait
```

Everything above is scripted, so redeploying for the next demo is just re-running Steps 0–4.

---

## Environment variables reference

| Variable | Where | Value | Notes |
|---|---|---|---|
| `DATABASE_URL` | backend | Neon `postgresql://...` | Required in production. |
| `SECRET_KEY` | backend | long random string | Required — startup fails on the default. |
| `ENVIRONMENT` | backend | `production` | Enables the secret-key safety check. |
| `CORS_ORIGINS` | backend | frontend URL | Comma-separated; no trailing slash. |
| `CALCULATOR_ENABLED` | backend | `false` | Keep off until an engineer signs off. |
| `SEED_ON_STARTUP` | backend | `true` (first deploy) | Seeds species if the DB is empty; can set `false` afterward. |
| `NEXT_PUBLIC_API_URL` | frontend | backend URL | **Build-time** arg, not runtime. |
