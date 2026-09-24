# Shared popularity counter

Backend deployed at https://akutkompassen-popularity.hrafnkellstefans.workers.dev on 2026-09-24. Database ID: `460aa263-b423-4b8b-a09c-3566d4c24f06`. Frontend activated after verifying exclusion in the owner’s current browser. Other browsers/devices must opt out separately at /statistik.html. No historical clicks are available. The frontend must never substitute device-local click counts for shared popularity.

Backend: Cloudflare Worker + D1. The public site remains on GitHub Pages. Count each guideline open; client suppresses reopens of the same document within 30 seconds. Anonymous event UUIDs deduplicate delivery; a daily cleanup retains them for approximately 24–48 hours while aggregate counts remain. No search text, full document content, persistent visitor identifier or IP address is stored in D1. Cloudflare processes request IPs for delivery and a short-lived abuse limiter (120/minute per IP/location); this may affect busy shared networks. Public counters are an approximate popularity signal, not clinical recommendations or authenticated visitor analytics.

## Deployment

1. Sign into the intended Cloudflare account. Use the existing D1 database `akutkompassen-popularity` identified above; do not create a duplicate.
2. Copy `wrangler.example.jsonc` to `wrangler.jsonc`; verify the included database ID against the dashboard. Apply `migrations/0001_counts.sql` remotely, then deploy `worker.mjs` with DB, CLICK_LIMITER and daily cron bindings. Keep observability disabled.
3. Verify CORS from https://akutkompassen.se and www; validate database idempotency on a separate test database rather than polluting production counts.
4. Set `../popularity-config.js` to the returned HTTPS Worker origin. Bump asset/cache versions and publish the GitHub Pages changes. `documents.json` is the allowlist; regenerate when adding/removing documents using `adult:<id>` and `barn:<id>` namespaces.
5. BEFORE enabling tracking for the owner, open https://akutkompassen.se/statistik.html in their browser and select exclusion. Verify local setting via rendered status. Repeat on their other browsers/devices and www if used without redirect. Clearing site data removes exclusion. No attempt is made to identify the owner on unknown devices.
6. Recheck live rankings, badges and exclusion. Empty counts produce alphabetical ordering and no badges. Do not seed fabricated counts.

Front end: aggregate counts refreshed on load and return to the tab (at most once per minute). Backend failure preserves the current session's last successful snapshot, or falls back to alphabetical ordering. Click requests fail without preventing opening guidelines; no retry queue or stale local popularity is used. Category winners are computed over the full category; count ties choose the first Swedish alphabetical title, then ID. Owner exclusion still permits reading global rankings.

Validation: `node --test tests/popularity.test.cjs tracking/worker.test.mjs` from repository root. Existing search tests continue to pass.
