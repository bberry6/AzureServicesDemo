# Deploying AzureServicesDemo to Azure App Service

**Target configuration**

| Setting | Value |
| --- | --- |
| Host | Linux App Service, `NODE:22-lts` |
| Plan SKU | `F1` (Free) |
| Region | `eastus` |
| Resource group | `rg-azureservicesdemo` |
| App name | `azureservicesdemo-bberry` |
| URL | https://azureservicesdemo-bberry.azurewebsites.net |
| Deployment | GitHub Actions, OIDC federated identity |
| Source | https://github.com/bberry6/AzureServicesDemo (`master`) |

---

## Step 0 — Push the serving glue first

`dist/` is gitignored, so the GitHub Actions runner builds it. The app also needs
`server.js` (Express + SPA fallback) because Node 22 App Service images no longer
ship `pm2`. Commit and push these before running anything below:

```bash
git add server.js package.json package-lock.json DEPLOY.md
git commit -m "Add Express static server for App Service"
git push origin master
```

## Step 1 — Sign in and set variables

PowerShell:

```powershell
az login
az account set --subscription "<SUBSCRIPTION_ID_OR_NAME>"

$RG     = "rg-azureservicesdemo"
$LOC    = "eastus"
$PLAN   = "asp-azureservicesdemo"
$APP    = "azureservicesdemo-bberry"
$REPO   = "bberry6/AzureServicesDemo"
$BRANCH = "master"
```

Bash:

```bash
az login
az account set --subscription "<SUBSCRIPTION_ID_OR_NAME>"

RG=rg-azureservicesdemo
LOC=eastus
PLAN=asp-azureservicesdemo
APP=azureservicesdemo-bberry
REPO=bberry6/AzureServicesDemo
BRANCH=master
```

## Step 2 — Confirm the hostname is free

`*.azurewebsites.net` is a global namespace, so check before you create.

```bash
SUB=$(az account show --query id -o tsv)
az rest --method post \
  --url "https://management.azure.com/subscriptions/$SUB/providers/Microsoft.Web/checknameavailability?api-version=2023-12-01" \
  --body "{\"name\":\"$APP\",\"type\":\"Microsoft.Web/sites\"}"
```

Expect `"nameAvailable": true`. If it comes back false, change `$APP`.

## Step 3 — Create the resource group

```bash
az group create --name $RG --location $LOC
```

## Step 4 — Create the App Service Plan (Linux, Free)

```bash
az appservice plan create \
  --name $PLAN \
  --resource-group $RG \
  --location $LOC \
  --sku F1 \
  --is-linux
```

`--is-linux` is required. F1 caps you at 60 CPU-minutes/day and 1 GB storage,
and does **not** support Always On — the app cold-starts after ~20 min idle.

## Step 5 — Create the web app

```bash
az webapp create \
  --name $APP \
  --resource-group $RG \
  --plan $PLAN \
  --runtime "NODE:22-lts"
```

Confirm the runtime string is still current with:
`az webapp list-runtimes --os linux --query "[?starts_with(@,'NODE')]" -o tsv`

## Step 6 — Set the startup command

```bash
az webapp config set \
  --name $APP \
  --resource-group $RG \
  --startup-file "npm start"
```

`npm start` runs `node server.js`, which serves `dist/` on `$PORT`.

## Step 7 — Configure app settings

```bash
az webapp config appsettings set \
  --name $APP \
  --resource-group $RG \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=false \
             WEBSITE_NODE_DEFAULT_VERSION=~22 \
             NODE_ENV=production
```

Oryx build is off because GitHub Actions already builds and ships
`dist/` plus production `node_modules`.

## Step 8 — Force HTTPS

```bash
az webapp update --name $APP --resource-group $RG --https-only true
```

## Step 9 — Enable logging (do this before first deploy)

```bash
az webapp log config \
  --name $APP \
  --resource-group $RG \
  --application-logging filesystem \
  --docker-container-logging filesystem \
  --level information
```

## Step 10 — Wire up GitHub Actions with OIDC

```bash
az webapp deployment github-actions add \
  --name $APP \
  --resource-group $RG \
  --repo $REPO \
  --branch $BRANCH \
  --runtime "NODE:22-lts" \
  --login-with-github
```

This creates an Entra app registration with a federated credential scoped to
`bberry6/AzureServicesDemo:ref:refs/heads/master`, grants it Contributor on the
app, writes `.github/workflows/master_azureservicesdemo-bberry.yml`, and pushes
that commit. It needs rights to create app registrations in your tenant.

`git pull` afterward to get the workflow file locally.

### Recommended: trim the generated workflow

The generated workflow zips the whole working directory, dev dependencies
included (~200 MB against F1's 1 GB). Replace the build job's steps with:

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npm prune --omit=dev
      - uses: actions/upload-artifact@v4
        with:
          name: node-app
          path: |
            dist
            node_modules
            server.js
            package.json
```

## Step 11 — Verify

```bash
az webapp show --name $APP --resource-group $RG --query defaultHostName -o tsv
curl -I https://$APP.azurewebsites.net
az webapp log tail --name $APP --resource-group $RG
```

First request after a deploy is slow — F1 has no Always On.

## Step 12 — Tear down

```bash
az group delete --name $RG --yes --no-wait
```

---

## Redeploying

Push to `master`. The workflow rebuilds and redeploys. To force a deploy without
a code change:

```bash
gh workflow run "master_azureservicesdemo-bberry.yml" --ref master
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| 503 / "Application Error" | `az webapp log tail` — usually `dist/` missing from the package or `npm start` failing |
| Blank page, 200 on `/` | Assets 404ing; confirm `dist/assets/` shipped in the artifact |
| Deep links 404 | SPA fallback in `server.js` not reached — check `express.static` path |
| Deploy auth failure | Federated credential subject must match the branch exactly (`refs/heads/master`) |
| App sleeps constantly | Expected on F1. `az appservice plan update --sku B1` then `--always-on true` |
