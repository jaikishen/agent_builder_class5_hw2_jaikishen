# Loading the SkyNova NoSQL seed into MongoDB

End-to-end steps for `mongodb_seed.json` → MongoDB. Two paths -
pick **one**.

- **Option A - MongoDB Atlas** (cloud, free tier). Recommended if you
  also used Supabase cloud. No local install.
- **Option B - Local Mongo via Docker.** Fastest if you have Docker
  already and don't want a cloud account.

---

## Option A - MongoDB Atlas (cloud)

### A1. Create an Atlas cluster

1. Go to <https://www.mongodb.com/cloud/atlas/register> and sign up
   (Google login works).
2. **Build a Database** → **M0 (Free)** → pick a cloud
   provider/region close to you → name it `skynova` →
   **Create Deployment**.
3. On the **Security Quickstart** screen:
   - **Username + password**: create a DB user (e.g. `skynova_app`).
     Save the password.
   - **Where would you like to connect from?** → click
     **Add My Current IP Address**. (For a learning project you can
     add `0.0.0.0/0` to allow all IPs - fine for dev, **never** for
     production.)
   - **Finish and Close**.

### A2. Get the connection string

1. Cluster overview → **Connect** → **Drivers** → Driver = Python,
   Version = latest.
2. Copy the SRV URI. Looks like:
   ```
   mongodb+srv://skynova_app:<password>@skynova.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
3. Replace `<password>` with the actual password from step A1.

### A3. Load the data

```bash
uv add pymongo
export MONGODB_URI="mongodb+srv://skynova_app:YOUR_PASSWORD@skynova.xxxxx.mongodb.net/?retryWrites=true&w=majority"
uv run python load_mongodb.py
```

Expected output:
```
  support_tickets: inserted 20 docs
  flight_reviews: inserted 27 docs
  user_activity_logs: inserted 40 docs
Loaded into mongodb+srv://... -> db 'skynova'.
```

The script **drops and recreates** the three collections, so it is
safe to re-run.

### A4. Verify in the Atlas UI

Atlas dashboard → **Browse Collections** → database **`skynova`** →
you should see `support_tickets`, `flight_reviews`,
`user_activity_logs`. Click each to confirm doc counts (20 / 27 / 40).

---

## Option B - Local MongoDB via Docker

### B1. Start a container

```bash
docker run -d --name skynova-mongo -p 27017:27017 mongo:7
```

### B2. Load the data

```bash
uv add pymongo
export MONGODB_URI="mongodb://localhost:27017"
uv run python load_mongodb.py
```

### B3. Verify with mongosh

```bash
brew install mongosh
mongosh
```

```js
use skynova
db.support_tickets.countDocuments()        // 20
db.flight_reviews.countDocuments()         // 27
db.user_activity_logs.countDocuments()     // 40
db.support_tickets.findOne({ status: "Open" })
```

---

## Sanity queries (work for either option)

Run in `mongosh` - local or via Atlas's built-in MongoSH button.

```js
use skynova

// All open / in-progress tickets
db.support_tickets.find(
  { status: { $in: ["Open", "InProgress"] } },
  { ticket_id: 1, customer_id: 1, subject: 1, _id: 0 }
);

// Average rating per flight (worst first)
db.flight_reviews.aggregate([
  { $group: { _id: "$flight_number", avg: { $avg: "$rating" }, n: { $sum: 1 } } },
  { $sort: { avg: 1 } }
]);

// Recent activity for one customer
db.user_activity_logs
  .find({ customer_id: 13 })
  .sort({ timestamp: -1 })
  .limit(10);
```

---

## Save the URI for the agent

Add to your project's `.env` (do **not** commit):

```
MONGODB_URI=mongodb+srv://skynova_app:YOUR_PASSWORD@skynova.xxxxx.mongodb.net/?appName=skynova
MONGODB_DB=skynova
```

Then `.gitignore` should include `.env`.

---

## Troubleshooting

| Symptom                                   | Likely cause / fix                                                           |
|-------------------------------------------|------------------------------------------------------------------------------|
| `ServerSelectionTimeoutError`             | IP not on Atlas allowlist. Atlas → **Network Access** → add your IP.         |
| `Authentication failed`                   | Wrong password or wrong user. Check **Database Access**.                     |
| `pymongo not found`                       | `uv add pymongo` (or `pip install pymongo`).                                 |
| Counts are 0                              | Loader silently skipped. Re-run with `MONGODB_URI` correctly exported.       |
| Want to wipe and re-load                  | The loader already does `drop()` per collection - just re-run it.            |
| Can't see `skynova` DB in Atlas Browse    | Click the refresh icon, or wait 30s after the loader prints success.         |

---

Once `db.support_tickets.countDocuments()` returns `20`, the NoSQL
store is ready. The schema for each collection is documented in
`SCHEMA.md` for use as agent context.
