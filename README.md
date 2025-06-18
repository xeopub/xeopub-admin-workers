Application created successfully!

💻 Continue Developing
Change directories: cd cron-worker
Start dev server: pnpm run start
Deploy: pnpm run deploy

📖 Explore Documentation
https://developers.cloudflare.com/workers

🐛 Report an Issue
https://github.com/cloudflare/workers-sdk/issues/new/choose

💬 Join our Community
https://discord.cloudflare.com

npm run cf-typegen
wrangler types

npx wrangler dev --test-scheduled
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"

wrangler d1 migrations list xeocast_db --local
wrangler d1 migrations list xeocast_db --remote
wrangler d1 migrations list xeocast_db --remote --preview

wrangler d1 migrations apply xeocast_db --local
wrangler d1 migrations apply xeocast_db --remote
wrangler d1 migrations apply xeocast_db --remote --preview

wrangler dev --test-scheduled --persist-to ../web-app/.wrangler/state
http://localhost:8787/__scheduled?cron=*+*+*+*+*

wrangler secret put VIDEO_SERVICE_API_KEY