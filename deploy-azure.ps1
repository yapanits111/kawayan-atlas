<#
.SYNOPSIS
  Deploy Kawayan Atlas (frontend + backend) to Azure Container Apps.

.DESCRIPTION
  Stands up a resource group, container registry, and Container Apps environment,
  then cloud-builds and deploys both apps (scale-to-zero) against a Neon database.
  Safe to re-run for a fresh deploy after `.\deploy-azure.ps1 -Teardown`.

  Prerequisites (do these once, yourself):
    1. Install Azure CLI:  https://aka.ms/installazurecliwindows
    2. az login
    3. Have your Neon connection string ready.

.EXAMPLE
  .\deploy-azure.ps1 -DatabaseUrl "postgresql://user:pass@host/db?sslmode=require"

.EXAMPLE
  .\deploy-azure.ps1 -Teardown        # delete everything, stop all charges
#>
param(
  [string]$DatabaseUrl,
  [string]$Location      = "southeastasia",
  [string]$ResourceGroup = "kawayan-rg",
  [string]$Registry      = "",
  [string]$Environment   = "kawayan-env",
  [switch]$Teardown
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

# --- Teardown path -----------------------------------------------------------
if ($Teardown) {
  Write-Host "Deleting resource group '$ResourceGroup' (this stops all charges)..." -ForegroundColor Yellow
  az group delete --name $ResourceGroup --yes --no-wait
  Write-Host "Requested. Resources will be removed in the background." -ForegroundColor Green
  return
}

# --- Preflight ---------------------------------------------------------------
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
  throw "Azure CLI not found. Install it from https://aka.ms/installazurecliwindows, then run 'az login'."
}
try { az account show -o none 2>$null } catch { throw "Not logged in. Run 'az login' first." }
if (-not $?) { throw "Not logged in. Run 'az login' first." }
if (-not $DatabaseUrl) { throw "Provide your Neon URL: -DatabaseUrl 'postgresql://...'" }

# Registry names must be globally unique and alphanumeric.
if (-not $Registry) { $Registry = "kawayanacr" + (Get-Random -Maximum 99999) }
# Fresh 48-char random signing key (backend refuses to start on the default in production).
$Secret = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})

Write-Host "Region=$Location  ResourceGroup=$ResourceGroup  Registry=$Registry" -ForegroundColor Cyan

# --- Providers (idempotent) --------------------------------------------------
az extension add --name containerapp --upgrade --only-show-errors | Out-Null
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait

# --- Infrastructure ----------------------------------------------------------
az group create --name $ResourceGroup --location $Location -o none
az acr create --resource-group $ResourceGroup --name $Registry --sku Basic --admin-enabled true -o none
az containerapp env create --name $Environment --resource-group $ResourceGroup --location $Location -o none

# --- Backend -----------------------------------------------------------------
Write-Host "Building backend image..." -ForegroundColor Cyan
az acr build --registry $Registry --image kawayan-backend:latest "$here/backend" -o none

Write-Host "Deploying backend..." -ForegroundColor Cyan
az containerapp create --name kawayan-backend --resource-group $ResourceGroup --environment $Environment `
  --image "$Registry.azurecr.io/kawayan-backend:latest" --registry-server "$Registry.azurecr.io" `
  --target-port 8000 --ingress external --min-replicas 0 --max-replicas 2 `
  --env-vars "DATABASE_URL=$DatabaseUrl" "SECRET_KEY=$Secret" "ENVIRONMENT=production" "CALCULATOR_ENABLED=false" "SEED_ON_STARTUP=true" `
  -o none

$backend = "https://" + (az containerapp show --name kawayan-backend --resource-group $ResourceGroup --query "properties.configuration.ingress.fqdn" -o tsv)
Write-Host "Backend: $backend" -ForegroundColor Green

# --- Frontend (API URL is baked in at build time) ----------------------------
Write-Host "Building frontend image (API=$backend)..." -ForegroundColor Cyan
az acr build --registry $Registry --image kawayan-frontend:latest --build-arg NEXT_PUBLIC_API_URL=$backend "$here/frontend" -o none

Write-Host "Deploying frontend..." -ForegroundColor Cyan
az containerapp create --name kawayan-frontend --resource-group $ResourceGroup --environment $Environment `
  --image "$Registry.azurecr.io/kawayan-frontend:latest" --registry-server "$Registry.azurecr.io" `
  --target-port 3000 --ingress external --min-replicas 0 --max-replicas 2 `
  -o none

$frontend = "https://" + (az containerapp show --name kawayan-frontend --resource-group $ResourceGroup --query "properties.configuration.ingress.fqdn" -o tsv)

# --- Let the backend accept the frontend origin (CORS) -----------------------
az containerapp update --name kawayan-backend --resource-group $ResourceGroup --set-env-vars "CORS_ORIGINS=$frontend" -o none

Write-Host ""
Write-Host "==================== DEPLOYED ====================" -ForegroundColor Green
Write-Host "  App:      $frontend" -ForegroundColor Green
Write-Host "  API:      $backend" -ForegroundColor Green
Write-Host "  Registry: $Registry  (note this to redeploy/teardown)" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host "Tip: open the App URL once a minute before a demo to warm it up."
