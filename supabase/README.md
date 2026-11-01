# Local Supabase development

This directory contains the Supabase CLI config, versioned database migrations, and synthetic seed records. It does not connect to or create a hosted Supabase project.

## Prerequisites

- Node.js 20 or later for the Supabase CLI.
- Docker Desktop (or another Docker-compatible runtime) running on Windows.

## Start the local stack

From the repository root in PowerShell:

```powershell
npm.cmd install --save-dev supabase
npx.cmd supabase start
```

The CLI prints local API/database URLs and development keys. Open Supabase Studio at `http://127.0.0.1:54323`. The first `start` downloads the local Supabase containers.

To stop the local services, use `npx.cmd supabase stop`. To reapply migrations and synthetic seeds from a clean local database, use `npx.cmd supabase db reset`; this deletes local database contents.

The seed uses only `example.test` identities and never creates logins, push tokens, or real incident/location records. Auth signup is disabled by default in this local config; create test auth users through the local Studio/Auth tooling and add customer memberships only through a future privileged onboarding function.

## Current API boundary

The initial migration grants authenticated clients tenant-scoped read access for managers and denies direct table writes. Future authenticated Edge Functions must validate the caller's tenant membership and role, then perform incident lifecycle, employee onboarding, device, acknowledgement, location, and manual safety mutations. Keep Supabase secret/service-role keys server-side. The Expo app and browser must never receive them.

This schema is an initial design to validate, not a production security review. It needs migration application, RLS policy tests, and review before a hosted project contains employee data.
