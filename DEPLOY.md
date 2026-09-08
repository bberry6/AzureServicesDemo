# Deploying AzureServicesDemo to Azure App Service

Rebuild runbook. Tears down every Azure resource and recreates it from this
repo, using OIDC federated identity for deployment.

| Setting | Value |
| --- | --- |
| Host | Linux App Service, `NODE:22-lts` |
| Plan SKU | `B1` Basic, Always On enabled |
| Region | `eastus` |
| Resource group | `stw-azuredemo-rg` |
| Plan name | `stwazuredemoplan` |
| App name | `stw-azuredemo` |
| URL | https://stw-azuredemo.azurewebsites.net |
| Deployment | GitHub Actions, OIDC federated credential |
| Source | https://github.com/bberry6/AzureServicesDemo (`master`) |

---

## What changed from the first version of these instructions

Nine corrections, all learned the hard way. Corrections 1, 8 and 9 each broke
the deploy on their own.

1. **Publish-profile auth does not work here.** SCM basic auth is disabled on
   App Service by default now. Publish-profile deployment depends on it, so
   every deploy failed and `wwwroot` was never populated. Everything below
   uses OIDC instead. This was the root cause of the whole outage.
2. **Do not run `az webapp deployment github-actions add`.** The workflow is
   now maintained by hand in this repo. That command overwrites it with a
   publish-profile version and pushes a commit — reintroducing bug #1.
3. **A role assignment step is now required.** It is the one piece of the
   OIDC setup that dies with the resource group and must be recreated.
4. **F1 → B1.** F1 has no Always On, so a demo pauses on cold start, and its
   60 CPU-min/day quota can be exhausted by a crash-looping container — which
   is what produced a hard 403 with `state: QuotaExceeded`.
5. **Names changed** to `stw-azuredemo` / `stw-azuredemo-rg`.
6. **The Entra app registration is not in a resource group.** `az group delete`
   does not touch it. Keeping it means the GitHub secrets stay valid.
7. **A deploy trigger step is needed.** A rebuild involves no code change, so
   nothing pushes automatically. Use an empty commit or `workflow_dispatch`.
8. **GitHub sends an immutable OIDC subject.** This repo has immutable subject
   claims enabled, so the token's subject is
   `repo:bberry6@7839451/AzureServicesDemo@1302016917:ref:refs/heads/master`,
   not the classic `repo:owner/name:ref:...`. A federated credential built on
   the classic form is rejected with `AADSTS700213`.
9. **Do not deploy `node_modules`.** App Service compresses a deployed
   `node_modules` into `node_modules.tar.gz` and records it in
   `oryx-manifest.toml`, but only its own Oryx startup path extracts that
   archive — a custom startup command bypasses it, so requires fail at
   runtime even though the deployment reports success. `server.js` was
   rewritten on Node built-ins so there is nothing to ship.

---

## Prerequisites — verify before the demo

These are already in place and survive the teardown. Confirm, do not recreate.

**In the repo:**

```bash
git ls-files | grep -E "server.js|package.json|workflows"
```

Expect `server.js`, `package.json`, and
`.github/workflows/master_stw-azuredemo.yml`. `server.js` is required because
Node 22 App Service images no longer ship `pm2`, and `dist/` is gitignored so
the runner builds it. `server.js` uses only Node built-ins — the app has no
runtime dependencies, and `node_modules` is deliberately never deployed.

**In Entra ID** — app registration `gh-actions-stw-azuredemo`:

```bash
az ad app show --id 0686e6a9-bda9-4116-9202-cb0623a571c7 --query displayName -o tsv
az ad app federated-credential list --id 0686e6a9-bda9-4116-9202-cb0623a571c7 --query "[].subject" -o tsv
```

Two subjects should come back:

```
repo:bberry6@7839451/AzureServicesDemo@1302016917:ref:refs/heads/master
repo:bberry6/AzureServicesDemo:ref:refs/heads/master
```

The first is the one that actually matters. This repo has GitHub's
**immutable subject claims** enabled, so the OIDC token embeds the numeric
owner ID (`7839451`) and repo ID (`1302016917`) rather than using the
classic `repo:owner/name:ref:...` form. A credential holding only the classic
form fails with `AADSTS700213`. The second is kept as a fallback in case
immutable claims are ever turned off.

If you ever recreate the app registration, read the numeric IDs from the API
rather than guessing them:

```bash
curl -s https://api.github.com/repos/bberry6/AzureServicesDemo \
  | jq -r '"repo:\(.owner.login)@\(.owner.id)/\(.name)@\(.id):ref:refs/heads/master"'
```

**In GitHub** — Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| `AZURE_CLIENT_ID` | `0686e6a9-bda9-4116-9202-cb0623a571c7` |
| `AZURE_TENANT_ID` | `38d191bf-b7e8-47a7-9a02-e22147f65181` |
| `AZURE_SUBSCRIPTION_ID` | `07c32350-e22c-49ed-a2ff-d53694e417ad` |

If the `Log in to Azure` step fails, it is nearly always one of these three
missing or mistyped. There should be no `AzureAppService_PublishProfile_*`
secrets left; delete any you find.

---

## Teardown

```bash
az group delete --name stw-azuredemo-rg --yes --no-wait
```

Deletes the plan, the web app, and the role assignment scoped to it.

**Do not** run `az ad app delete`. The app registration and federated
credential live in Entra ID, outside any resource group. Keeping them is what
lets the GitHub secrets stay valid, and it reduces the rebuild to one extra
command.

Deletion is asynchronous. Confirm the group is gone before rebuilding:

```bash
az group exists --name stw-azuredemo-rg   # wait for: false
```

---

## Rebuild

### Step 1 — Sign in and set variables

PowerShell:

```powershell
az login
az account set --subscription "07c32350-e22c-49ed-a2ff-d53694e417ad"

$RG    = "stw-azuredemo-rg"
$LOC   = "eastus"
$PLAN  = "stwazuredemoplan"
$APP   = "stw-azuredemo"
$APPID = "0686e6a9-bda9-4116-9202-cb0623a571c7"
$SUB   = "07c32350-e22c-49ed-a2ff-d53694e417ad"
```

Bash:

```bash
az login
az account set --subscription "07c32350-e22c-49ed-a2ff-d53694e417ad"

RG=stw-azuredemo-rg
LOC=eastus
PLAN=stwazuredemoplan
APP=stw-azuredemo
APPID=0686e6a9-bda9-4116-9202-cb0623a571c7
SUB=07c32350-e22c-49ed-a2ff-d53694e417ad
```

### Step 2 — Confirm the hostname was released

Deleting an App Service usually frees the name within a minute or two, but not
always instantly. Check before creating:

```bash
az rest --method post \
  --url "https://management.azure.com/subscriptions/$SUB/providers/Microsoft.Web/checknameavailability?api-version=2023-12-01" \
  --body "{\"name\":\"$APP\",\"type\":\"Microsoft.Web/sites\"}"
```

Expect `"nameAvailable": true`. If false, wait a minute and retry — do not
rename, or the workflow's `app-name` will no longer match.

### Step 3 — Resource group

```bash
az group create --name $RG --location $LOC
```

### Step 4 — App Service Plan (B1, Linux)

```bash
az appservice plan create \
  --name $PLAN \
  --resource-group $RG \
  --location $LOC \
  --sku B1 \
  --is-linux
```

B1 rather than F1: no daily CPU quota, and Always On is available so the app
does not cold-start mid-demo.

### Step 5 — Web app

```bash
az webapp create \
  --name $APP \
  --resource-group $RG \
  --plan $PLAN \
  --runtime "NODE:22-lts"
```

### Step 6 — Startup command and Always On

```bash
az webapp config set \
  --name $APP \
  --resource-group $RG \
  --startup-file "npm start" \
  --always-on true
```

`npm start` runs `node server.js`, which serves `dist/` on `$PORT` with an
SPA fallback to `index.html`.

### Step 7 — App settings

```bash
az webapp config appsettings set \
  --name $APP \
  --resource-group $RG \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=false \
             WEBSITE_NODE_DEFAULT_VERSION=~22 \
             NODE_ENV=production
```

Oryx build stays off — the workflow already produces `dist/`, and the app
has no runtime dependencies to install.

### Step 8 — Force HTTPS

```bash
az webapp update --name $APP --resource-group $RG --https-only true
```

### Step 9 — Enable logging

Before the first deploy, not after. Container logs only capture from the
moment they are switched on, and they are where a failed `npm start` surfaces.

```bash
az webapp log config \
  --name $APP \
  --resource-group $RG \
  --application-logging filesystem \
  --docker-container-logging filesystem \
  --level information
```

### Step 10 — Grant the GitHub identity access to the new app

**This is the step that is easy to forget.** The app registration survived the
teardown, but its role assignment did not — that was scoped to the web app you
just deleted.

```bash
az role assignment create \
  --assignee $APPID \
  --role "Website Contributor" \
  --scope "/subscriptions/$SUB/resourceGroups/$RG/providers/Microsoft.Web/sites/$APP"
```

If this returns `MissingSubscription` or `AuthorizationFailed`, it is almost
always directory propagation. Wait ~30 seconds and rerun; add
`--assignee-principal-type ServicePrincipal` if it persists. Verify:

```bash
az role assignment list --assignee $APPID --all \
  --query "[].{role:roleDefinitionName,scope:scope}" -o table
```

### Step 11 — Trigger a deploy

A rebuild changes no code, so nothing triggers the workflow on its own. Either:

```bash
git commit --allow-empty -m "Trigger deploy after rebuild"
git push origin master
```

or, with the GitHub CLI:

```bash
gh workflow run "master_stw-azuredemo.yml" --ref master
```

### Step 12 — Verify

```bash
curl -I https://stw-azuredemo.azurewebsites.net
```

Expect `HTTP/2 200`. To watch it happen:

```bash
az webapp log tail --name $APP --resource-group $RG
```

Confirm a deployment actually recorded — an empty list here means the workflow
never reached Azure, regardless of what the site returns:

```bash
az rest --method get \
  --url "https://management.azure.com/subscriptions/$SUB/resourceGroups/$RG/providers/Microsoft.Web/sites/$APP/deployments?api-version=2023-12-01" \
  --query "value[].{id:name,status:properties.status,active:properties.active}" -o table
```

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Log in to Azure` step fails | The three `AZURE_*` GitHub secrets are missing or mistyped, or the federated credential subject does not match the branch. Check both. |
| `Publish profile is invalid for app-name and slot-name` | You are on the publish-profile path. SCM basic auth is disabled; switch to OIDC. The message appears for any auth failure, not just a name mismatch. |
| 503, deployment list empty | Nothing ever deployed; `wwwroot` is empty and `npm start` cannot find `package.json`. Look at the Actions run, not at Azure. |
| 503, deployment succeeded | Container is starting, or `npm start` is crashing. `az webapp log tail`. |
| Need to see inside `wwwroot` | `TOKEN=$(az account get-access-token --resource https://management.azure.com/ --query accessToken -o tsv)` then `curl -H "Authorization: Bearer $TOKEN" https://stw-azuredemo.scm.azurewebsites.net/api/vfs/site/wwwroot/` — works with SCM basic auth disabled. |
| 403 `state: QuotaExceeded` | F1 daily CPU quota exhausted, usually by a crash loop. Move to B1: `az appservice plan update --sku B1`. |
| Deep links 404 | SPA fallback in `server.js` not reached; check the `dist` path resolves. |
| `AADSTS700213` on login | The federated credential subject does not match GitHub's immutable form. Compare it against the `subject claim` line printed in the Action log. |
| 503, deployment succeeded, `MODULE_NOT_FOUND` | `node_modules` was deployed and left as `node_modules.tar.gz`. Do not ship it; the app needs no runtime dependencies. |
| Role assignment `MissingSubscription` | Directory propagation after creating the SP. Wait and retry. |

---

## On the shape of this app

This is a purely static SPA — no SSR, no API. Azure Static Web Apps is the
cheaper and more natural host: free tier, no CPU quota, no cold starts, global
CDN, built-in SPA routing, and no `server.js` at all. App Service is the right
call only if a backend is coming later.
