# Backend README

This README documents a few environment and runtime tips for the backend service.

## Environment

- Copy `.env.example` to `.env` and fill in real credentials.
- Important env vars:
  - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — database connection parts.
  - `SHARED_PASSWORD` — Optional. When set, mutating API requests (POST/PUT/PATCH/DELETE) to `/api/*` must include the header `X-SHARED-PASSWORD: <value>` or the `?shared_password=<value>` query parameter.
  - `ALLOWED_ORIGINS` — comma-separated allowed CORS origins.

## Dependencies

Dependencies are pinned in `requirements.txt`. We include both `pydantic` and `pydantic-settings` to support environments using either Pydantic v1 or v2.

Install via:

```bash
pip install -r requirements.txt
```

## Running

Start the server from the `backend` folder:

```bash
uvicorn app.main:app --reload --port 8000
```

## Notes

- Do NOT commit `.env` to source control. Add it to `.gitignore`.
- For local dev without MySQL, consider adding a `DATABASE_URL` pointing to a local SQLite file (we can add this as an improvement).
