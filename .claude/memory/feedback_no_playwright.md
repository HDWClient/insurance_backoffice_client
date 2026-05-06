---
name: No Playwright for debugging
description: User does not want Playwright used for browser debugging or checking deployed sites
type: feedback
---

Do not use Playwright tools to navigate to or inspect the deployed app. Use curl/aws CLI to diagnose deployment issues instead.

**Why:** User explicitly rejected Playwright browser navigation.
**How to apply:** When diagnosing deploy/cache issues, use `curl -I` for headers and AWS CLI commands only.
