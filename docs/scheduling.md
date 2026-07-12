# Scheduling the daily scrape

1. Open Task Scheduler → Create Basic Task.
2. Name: "Home Search Assistant — Daily Scrape". Trigger: Daily, pick a time (e.g. 7:00 AM).
3. Action: "Start a program".
   - Program/script: `C:\Program Files\nodejs\npm.cmd`
   - Add arguments: `run scrape`
   - Start in: `C:\Users\user\Desktop\claude\מתווך` (the main project checkout — NOT the `.worktrees` folder, which is a temporary dev branch; once this feature is merged, scheduling should point at the real project root)
4. Finish, then right-click the task → Run, to confirm it works.
5. Check the app's health status (visible on every page, top of the layout) or query the `ScrapeRun` table directly afterward for a new row.

## Known limitation

As of this writing, Yad2 blocks automated access via Radware Bot Manager (confirmed during Task 12's development — both a plain HTTP request and a real Playwright headless browser were challenged, not just naive scrapers). The pipeline detects this and records it as a clearly failed `ScrapeRun` with an "anti-bot"/"Radware" error message, rather than silently reporting a quiet day — but until this is resolved (e.g. by finding a different data source, or Yad2 relaxing its bot detection), scheduled runs are likely to fail rather than find real listings. Check the health status periodically to see whether this is still the case.

Also note: `ANTHROPIC_API_KEY` must be set to a real key in `.env.local` (or wherever the scheduled task's environment reads from) for listing scoring and preference learning to work — without it, listings that do get scraped will be saved unscored.
