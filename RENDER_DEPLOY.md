# Render deployment

1. Apply `database/supabase/schema.sql` and `runtime.sql` to a rehearsal project.
2. Stop the old bot, back up and run `npm run db:migrate`, then `npm run db:validate`.
3. Create the service from `render.yaml`. Use an always-on Node service and one
   instance: build `npm ci --omit=dev`, start `npm start`, Node 22.12+.
4. Fill private Discord, Supabase and external Lavalink environment variables.
5. Set `WEB_URL` to the exact public HTTPS origin; register
   `WEB_URL/api/auth/callback` in Discord OAuth. Set the OAuth client secret.
6. Render supplies `PORT`; the app binds `0.0.0.0` at that port. No persistent disk
   is needed in Supabase mode. Lavalink runs separately on its own host.
7. Confirm `/health`, `/ready`, Discord commands, OAuth, settings save and audio.

The functional dashboard and bot share one service/process. Set `WEB_ENABLED=false`
for a bot-only deployment with health endpoints. `npm run start:web` is only the
standalone frontend/login shell, not a separate production controller.

Drain/stop the old instance before replacement. The database rejects another writer
while its 90-second lease is active. Configure deployment sequencing accordingly;
this compatibility architecture does not support overlapping writers or replicas.
The blueprint has been inspected locally, not deployed to a live Render account.
