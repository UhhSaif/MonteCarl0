# Deploy the public demo

Live: https://montecarl0.onrender.com/ (Render Free). Initial deployment verified on 2026-11-06: health, AAPL history, and simulation API returned HTTP 200.

This repository includes a Docker image and Render Blueprint for one **free** web service. FastAPI serves the compiled React files and `/api` from the same origin. No database or API key is required.

## Render

1. Sign in at https://dashboard.render.com with your own account and connect this GitHub repository.
2. Choose **New → Blueprint**, select `UhhSaif/MonteCarl0`, and use the repository's `render.yaml`.
3. Confirm the service uses the **Free** instance plan before creating it. Do not upgrade or add paid resources.
4. Wait for deployment and check `/api/health`, the homepage, stock search, and a 100-trial simulation.
5. Add the actual successful deployment URL to the README and your résumé. No public URL is claimed until deployment is verified.

Free services sleep after 15 idle minutes and share a monthly 750-instance-hour allowance. Cold starts can delay the first visit. Build and bandwidth quotas also apply: to avoid overage charges, do not add a payment method or enable paid upgrades. If account verification requires billing, stop and review before proceeding.

Official references: https://render.com/docs/free and https://render.com/docs/blueprint-spec.

## Operational limits

`PUBLIC_DEMO=1` enables a shared 60-request/minute budget for API calls other than health checks and CORS preflights. It is intentionally global: one visitor can exhaust it. It resets on restart and assumes the single worker configured in Docker. This is a small portfolio-demo limit, not a distributed abuse-prevention system. Uvicorn limits concurrent connections/tasks to 32. Request validation caps simulations at 10,000 and horizons at 90 days; Yahoo requests use a timeout and successful history is cached for five minutes.

Yahoo may block cloud-provider traffic or throttle requests. A successful health check only establishes that the app is running. Verify real history and simulations on the deployed host; never silently replace missing prices with invented data.

## Local production image

```bash
docker build -t montecarl0 .
docker run --rm -p 8080:8000 -e PUBLIC_DEMO=1 montecarl0
```

Open http://localhost:8080. The normal two-terminal development setup remains unchanged.
