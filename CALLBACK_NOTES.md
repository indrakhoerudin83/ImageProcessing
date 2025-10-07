# Callback setup

Set environment variables:

- KIE_CALLBACK_URL=https://imageprocessing-production-3f2d.up.railway.app/api/kie/callback
- KIE_CALLBACK_TOKEN=<choose_a_secret>

The backend will auto-fill callBackUrl if not provided in `/api/kie/create-task`.
Frontend will poll `/api/kie/result?job_id=...` until the callback is received, then render the returned image_url or image_base64.
