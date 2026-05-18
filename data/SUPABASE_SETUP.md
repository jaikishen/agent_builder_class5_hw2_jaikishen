# Loading the SkyNova SQL seed into Supabase

End-to-end steps to get `supabase_seed.sql` running in a Supabase
Postgres database.

---

## 1. Create / open a Supabase project

1. Go to <https://supabase.com> and sign in (GitHub login is easiest).
2. **New project** → pick an org, give it a name (e.g. `skynova`), set
   a strong DB password (save it - you'll need it later), pick a region
   close to you, then **Create**.
3. Wait ~1 minute for it to provision.

---

## 2. Run the SQL

**Easiest path - SQL Editor in the dashboard:**

1. Left sidebar → **SQL Editor** → **+ New query**.
2. Open `supabase_seed.sql`, copy the **entire** file.
3. Paste into the editor → click **Run** (or `⌘+Return` / `Ctrl+Enter`).
4. You should see `Success. No rows returned` (the script is mostly DDL
   + INSERTs; trailing `setval` calls return rows, harmless).

The script begins with `DROP TABLE IF EXISTS …`, so it is safe to
re-run if anything goes wrong.

**Alternative - `psql` from your terminal:**

```bash
# Connection string is in: Project Settings → Database → Connection string → URI
psql "$SUPABASE_DB_URL" -f supabase_seed.sql
```

---

## 3. Verify the data loaded

In the SQL Editor, run these (together or one at a time):

```sql
SELECT COUNT(*) AS customers FROM customers;     -- expect 25
SELECT COUNT(*) AS airports  FROM airports;      -- expect 8
SELECT COUNT(*) AS aircraft  FROM aircraft;      -- expect 5
SELECT COUNT(*) AS flights   FROM flights;       -- expect 15
SELECT COUNT(*) AS bookings  FROM bookings;      -- expect 50

SELECT loyalty_tier, COUNT(*) FROM customers GROUP BY 1 ORDER BY 1;
SELECT status,       COUNT(*) FROM flights   GROUP BY 1 ORDER BY 1;
```

You can also click **Table Editor** in the left sidebar to browse the
rows visually and confirm relationships look right.

---

## 4. Save credentials for the agent

Later when the ReAct agent connects, you will need one or both of:

- **Database URL** (for direct SQL access):
  Project Settings → **Database** → **Connection string** → URI tab →
  copy. Replace `[YOUR-PASSWORD]` with the password from step 1.
- **Supabase API keys** (if you use the `supabase-py` client):
  Project Settings → **API** → copy the *Project URL* and the
  *anon* public key (or *service_role* for full access from a backend).

Stash them in a `.env` file at the project root (do **not** commit it):

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_DB_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

Add `.env` to `.gitignore` if it isn't already.

---

## 5. Troubleshooting

| Symptom | Likely cause / fix |
|--------|---------------------|
| `permission denied for schema public` | Make sure you are running in the SQL Editor (uses the service role) or your `psql` URL uses the `postgres` user from Project Settings. |
| `relation "customers" already exists` | Re-run the script; the leading `DROP TABLE IF EXISTS` clauses will clean up. |
| Counts off in step 3 | The query failed mid-way. Look for the first error in the SQL Editor output and fix that section. |
| FK error on `INSERT INTO bookings` | Indicates `flights` or `customers` did not seed. Run those `INSERT` blocks again, then re-run the bookings block. |

---

Once step 3 returns the expected counts, the SQL store is ready and the
agent can hit it via either the Postgres connection string or the
Supabase REST API.
