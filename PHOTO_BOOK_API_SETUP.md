Lulu Photo Book API — Setup & Integration Guide
================================================

Lulu's Print API lets you auto-submit photo books for printing. Free to use —
you only pay for actual print jobs and shipping.

Registration (one-time, free)
-----------------------------

1. Create a Lulu account: https://www.lulu.com/register
2. Go to the developer portal: https://developers.lulu.com/user-profile/api-keys
3. Generate an **API Key** and **API Secret**
4. (Optional) Create a separate **sandbox account** for testing:
   https://developers.sandbox.lulu.com/user-profile/api-keys

API Details
-----------

- **Base URLs:**
  - Production: https://api.lulu.com
  - Sandbox:    https://api.sandbox.lulu.com

- **Auth:** OpenID Connect (client_credentials grant) using your key + secret
- **Docs:** https://api.lulu.com/docs/

- **Key Endpoints:**
  - POST /auth/token              — Get bearer token
  - GET  /print-jobs/print-job-cost-calculations — Estimate cost
  - POST /print-jobs/             — Submit a print job
  - GET  /print-jobs/{id}/        — Check job status
  - GET  /shipping-options        — Get shipping rates & options
  - GET  /pod-packages            — List available book SKUs

- **Pricing calculator:** https://www.lulu.com/sell/print-on-demand-calculator

Integration Steps (what the code does)
---------------------------------------

1. **Authenticate** — Get a bearer token using API key + secret
2. **Pick product** — Choose a PodPackageId (book size, binding, paper) via
   the pricing calculator or pod-packages endpoint
3. **Upload PDF** — Generate a print-ready PDF from the storybook content.
   Host it at a URL accessible to Lulu (or upload to cloud storage)
4. **Submit order** — POST /print-jobs with the PDF URLs, PodPackageId,
   quantity, shipping address, and contact email
5. **Pay** — Pay for the print job via the developer portal or API
6. **Ship** — Lulu prints and ships directly to the address

Book Sizes (photo book friendly)
----------------------------------
- 8×8" Square Hardcover  — ~$8–12 cost
- 8.5×11" Portrait       — ~$10–15 cost
- 11×8.5" Landscape      — ~$12–17 cost
- 9×7" Portrait          — ~$9–13 cost

(You set your own retail markup; Lulu charges wholesale.)

After You Get the API Key
--------------------------

Add these to `server/.env`:
  LULU_API_KEY=your-api-key
  LULU_API_SECRET=your-api-secret
  LULU_ENV=sandbox          # or "production" when ready
