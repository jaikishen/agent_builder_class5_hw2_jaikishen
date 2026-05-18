# SkyNova Data - Schema Definitions for NL → Query Agents

This document is the canonical reference for the SkyNova datasets. Use
it as schema context when you build agents that translate natural
language into SQL (Supabase / Postgres) or MongoDB queries.

---

## 0. How to use this document

Three common patterns - pick the one that fits your agent design:

### Pattern A - Static system-prompt context *(simplest)*

Paste the schema sections (1.x and 2.x) into the agent's **system
prompt**. The LLM uses the schema text as in-context grounding when
generating queries. Works well up to a few thousand tokens of schema -
cheap, deterministic, no extra round-trips.

```python
SYSTEM_PROMPT = f"""
You are an airline data analyst. You can call sql_query and mongo_query
tools. Use the schema below to write correct queries.

## SQL schema
{open('SCHEMA.md').read().split('## 1.')[1].split('## 2.')[0]}

## MongoDB schema
{open('SCHEMA.md').read().split('## 2.')[1].split('## 3.')[0]}
"""
```

### Pattern B - `describe_schema` tool *(more flexible)*

Expose a tool the agent can call mid-loop:

```python
@tool
def describe_schema(store: str, table_or_collection: str) -> str:
    """store is 'sql' or 'mongo'. Returns the schema description for one table/collection."""
    ...
```

Now the agent reasons: *"I need ticket data → call `describe_schema('mongo', 'support_tickets')` → then call `mongo_query(...)`."* This keeps the system prompt small and demonstrates ReAct tool composition.

### Pattern C - Retrieval-augmented schema *(production scale)*

Chunk this doc, embed it, retrieve top-k relevant sections per
question. Overkill for SkyNova (5 tables, 3 collections) but the
correct pattern at hundreds-of-tables scale.

> **Highest-leverage trick:** append 3-5 worked **NL → query** examples
> (sections 1.7 and 2.5 below) to whatever schema context you use.
> Few-shot examples beat verbose schema descriptions almost every time.

---

## 1. Supabase (PostgreSQL) - relational store

All tables live in the `public` schema. Foreign keys are enforced.
`CHECK` constraints on status/tier columns are documented inline.

### 1.1 Table summary

| Table       | Rows | Purpose                                                              |
|-------------|------|----------------------------------------------------------------------|
| `customers` | 25   | Passenger profiles, loyalty tier and miles balance                   |
| `airports`  | 8    | Airport reference (IATA code, city, country)                         |
| `aircraft`  | 5    | Fleet inventory                                                      |
| `flights`   | 15   | Scheduled and operated flights with status                           |
| `bookings`  | 50   | Passenger → flight reservations, cabin class, fare paid              |

### 1.2 `customers`

Every passenger who has booked or holds a SkyNova Rewards account.
`customer_id` is the join key into MongoDB.

| Column          | Type                    | Notes                                                  |
|-----------------|-------------------------|--------------------------------------------------------|
| `customer_id`   | `SERIAL PRIMARY KEY`    | Stable identifier; appears in all MongoDB collections  |
| `first_name`    | `TEXT NOT NULL`         |                                                        |
| `last_name`     | `TEXT NOT NULL`         |                                                        |
| `email`         | `TEXT UNIQUE NOT NULL`  | Login + correspondence                                 |
| `phone`         | `TEXT`                  |                                                        |
| `country`       | `TEXT`                  | Country of residence                                   |
| `date_of_birth` | `DATE`                  |                                                        |
| `loyalty_tier`  | `TEXT`                  | One of `None`, `Silver`, `Gold`, `Platinum` (CHECK)    |
| `loyalty_miles` | `INT DEFAULT 0`         | Current redeemable miles                               |
| `created_at`    | `TIMESTAMP DEFAULT NOW()` |                                                      |

**Sample:** `(13, 'Aisha', 'Khan', 'aisha.khan@example.ae', 'United Arab Emirates', 'Platinum', 198000)`

### 1.3 `airports`

Reference table - small and stable.

| Column         | Type                | Notes                  |
|----------------|---------------------|------------------------|
| `airport_code` | `CHAR(3) PRIMARY KEY` | IATA code (DEL, LHR…) |
| `airport_name` | `TEXT NOT NULL`     |                        |
| `city`         | `TEXT NOT NULL`     |                        |
| `country`      | `TEXT NOT NULL`     |                        |

Codes seeded: DEL, BOM, LHR, JFK, DXB, SIN, NRT, CDG.

### 1.4 `aircraft`

| Column         | Type                  | Notes                          |
|----------------|-----------------------|--------------------------------|
| `aircraft_id`  | `SERIAL PRIMARY KEY`  |                                |
| `registration` | `TEXT UNIQUE NOT NULL`| Tail number, e.g. `VT-SNA`     |
| `model`        | `TEXT NOT NULL`       | e.g. `Airbus A350-900`         |
| `capacity`     | `INT NOT NULL`        | Total seats                    |

### 1.5 `flights`

A row per operated/scheduled flight (not per route - same flight number on different days = different rows).

| Column            | Type                 | Notes                                                                            |
|-------------------|----------------------|----------------------------------------------------------------------------------|
| `flight_id`       | `SERIAL PRIMARY KEY` |                                                                                  |
| `flight_number`   | `TEXT NOT NULL`      | e.g. `SN401`. Not unique across rows (same number on different dates).           |
| `origin`          | `CHAR(3) FK → airports` |                                                                              |
| `destination`     | `CHAR(3) FK → airports` |                                                                              |
| `departure_time`  | `TIMESTAMP NOT NULL` | Local time of origin airport                                                     |
| `arrival_time`    | `TIMESTAMP NOT NULL` | Local time of destination airport                                                |
| `aircraft_id`     | `INT FK → aircraft`  |                                                                                  |
| `status`          | `TEXT`               | One of `Scheduled`, `Departed`, `Arrived`, `Completed`, `Delayed`, `Cancelled`   |
| `base_price_usd`  | `NUMERIC(8,2)`       | Reference Economy fare; actual fare lives on the booking                         |

**Domain notes:**
- Today (in this dataset) = **2026-05-08**.
- `Cancelled` flights still have rows in `bookings`; those bookings have status `Cancelled`.
- `SN401` was operationally delayed ~2hrs on 2026-05-01 but `status` is `Completed` (delay is captured in support tickets / reviews, not as a flight attribute).

### 1.6 `bookings`

A passenger on a flight. The fact table - most analytics will join through here.

| Column              | Type                  | Notes                                                                                  |
|---------------------|-----------------------|----------------------------------------------------------------------------------------|
| `booking_id`        | `SERIAL PRIMARY KEY`  |                                                                                        |
| `booking_reference` | `TEXT UNIQUE NOT NULL`| 9-char code (`SKY7A2K9F`); appears in MongoDB tickets/logs                             |
| `customer_id`       | `INT FK → customers`  |                                                                                        |
| `flight_id`         | `INT FK → flights`    |                                                                                        |
| `seat_number`       | `TEXT`                |                                                                                        |
| `cabin_class`       | `TEXT`                | One of `Economy`, `PremiumEconomy`, `Business`, `First` (CHECK)                        |
| `fare_paid_usd`     | `NUMERIC(8,2)`        | Actual amount charged                                                                  |
| `booking_status`    | `TEXT`                | One of `Confirmed`, `CheckedIn`, `Completed`, `Cancelled`, `NoShow` (CHECK)            |
| `booked_at`         | `TIMESTAMP`           |                                                                                        |

**Indexes:** `bookings(customer_id)`, `bookings(flight_id)`, `flights(origin, destination)`.

### 1.7 ER summary

```
customers ─< bookings >─ flights ─> airports (origin / destination)
                            └────> aircraft
```

`<` = "many bookings per customer", `>` = "many bookings per flight".

### 1.8 Sample NL → SQL

> Use these as few-shot examples in your agent's prompt. They cover
> filtering, joins, aggregation, time, and free-text matching - the
> patterns that appear in 90% of NL questions.

**Q: "How many platinum customers do we have?"**
```sql
SELECT COUNT(*) FROM customers WHERE loyalty_tier = 'Platinum';
```

**Q: "Total revenue from completed bookings, by cabin class."**
```sql
SELECT cabin_class, SUM(fare_paid_usd) AS revenue
FROM bookings
WHERE booking_status = 'Completed'
GROUP BY cabin_class
ORDER BY revenue DESC;
```

**Q: "List Aisha Khan's upcoming flights."**
```sql
SELECT f.flight_number, f.origin, f.destination, f.departure_time, b.booking_status
FROM bookings b
JOIN customers c ON c.customer_id = b.customer_id
JOIN flights   f ON f.flight_id   = b.flight_id
WHERE c.first_name = 'Aisha' AND c.last_name = 'Khan'
  AND f.departure_time > NOW()
  AND b.booking_status IN ('Confirmed','CheckedIn')
ORDER BY f.departure_time;
```

**Q: "Which flights were cancelled and how many bookings were affected?"**
```sql
SELECT f.flight_number, f.departure_time, COUNT(b.booking_id) AS affected
FROM flights f
LEFT JOIN bookings b ON b.flight_id = f.flight_id
WHERE f.status = 'Cancelled'
GROUP BY f.flight_id, f.flight_number, f.departure_time;
```

**Q: "Top 5 customers by total spend in the last 90 days."**
```sql
SELECT c.customer_id, c.first_name || ' ' || c.last_name AS name,
       SUM(b.fare_paid_usd) AS spend
FROM bookings b
JOIN customers c ON c.customer_id = b.customer_id
WHERE b.booked_at >= NOW() - INTERVAL '90 days'
  AND b.booking_status IN ('Confirmed','CheckedIn','Completed')
GROUP BY c.customer_id, name
ORDER BY spend DESC
LIMIT 5;
```

**Q: "Routes (origin → destination) ranked by number of completed flights."**
```sql
SELECT origin || '→' || destination AS route, COUNT(*) AS n
FROM flights
WHERE status = 'Completed'
GROUP BY route
ORDER BY n DESC;
```

**Q: "Average load factor on the A350 (capacity 325) - completed flights only."**
```sql
SELECT f.flight_number, COUNT(b.booking_id)::FLOAT / a.capacity AS load_factor
FROM flights f
JOIN aircraft a ON a.aircraft_id = f.aircraft_id
LEFT JOIN bookings b
       ON b.flight_id = f.flight_id
      AND b.booking_status IN ('CheckedIn','Completed')
WHERE a.model LIKE 'Airbus A350%' AND f.status = 'Completed'
GROUP BY f.flight_id, f.flight_number, a.capacity
ORDER BY load_factor DESC;
```

**Q: "Customers who flew SN401 on 2026-05-01."**
```sql
SELECT c.customer_id, c.first_name, c.last_name
FROM bookings b
JOIN flights   f ON f.flight_id = b.flight_id
JOIN customers c ON c.customer_id = b.customer_id
WHERE f.flight_number = 'SN401'
  AND f.departure_time::DATE = DATE '2026-05-01'
  AND b.booking_status IN ('Completed','NoShow');
```

---

## 2. MongoDB - document store

Database `skynova`, three collections, schema-less but consistent shape
within each collection. `customer_id` and `booking_reference` always
match a row in the SQL store.

### 2.1 Collection summary

| Collection           | Docs | Why MongoDB?                                                  |
|----------------------|------|---------------------------------------------------------------|
| `support_tickets`    | 20   | Variable-length nested `messages[]` thread per ticket         |
| `flight_reviews`     | 27   | Optional rating aspects; some fields are nullable             |
| `user_activity_logs` | 40   | Heterogeneous `data` payload - different shape per event_type |

### 2.2 `support_tickets`

A passenger-raised case (refund, baggage claim, complaint, etc.) with a
threaded conversation.

**Document shape:**
```jsonc
{
  "ticket_id": "TCK-1005",                      // string, unique
  "customer_id": 3,                             // int, FK → SQL customers.customer_id
  "booking_reference": "SKY9C2L4N",             // string | null, FK → SQL bookings.booking_reference
  "category": "Complaint",                      // Refund | Complaint | Baggage | Loyalty | SpecialAssistance | FlightChange | Other
  "priority": "High",                           // Low | Medium | High
  "status": "Resolved",                         // Open | InProgress | Resolved
  "subject": "SN401 delay caused missed connection",
  "tags": ["delay", "missed-connection", "SN401", "compensation"],   // free-form string array
  "resolution": "15,000 SkyNova miles + USD 150 meal voucher issued.", // present only when status=Resolved
  "created_at": ISODate("2026-05-01T13:20:00Z"),
  "updated_at": ISODate("2026-05-03T11:00:00Z"),
  "messages": [                                 // ordered, append-only
    { "from": "customer" | "agent",
      "at":   ISODate("..."),
      "text": "..." }
  ]
}
```

**Indexes:** `customer_id`, `status`.

**Domain notes:**
- `tags` often contains the affected flight number - useful for free-text-style queries.
- `resolution` is absent on `Open` and `InProgress` tickets.
- `booking_reference` may be `null` for general inquiries (e.g. `TCK-1012`).

### 2.3 `flight_reviews`

Post-flight ratings. One document per (customer, flight) pair.

**Document shape:**
```jsonc
{
  "review_id": "REV-2016",
  "customer_id": 3,
  "flight_number": "SN401",
  "booking_reference": "SKY9C2L4N",
  "rating": 2,                                  // overall, 1-5
  "verified_passenger": true,
  "aspects": {                                  // any sub-rating may be null
    "seat": 3, "food": 3, "crew": 4,
    "entertainment": 4, "punctuality": 1
  },
  "title": "2hr delay killed my connection",
  "comment": "Plane was nice. The 2 hour ATC delay cost me ...",
  "posted_at": ISODate("2026-05-02T23:00:00Z")
}
```

**Indexes:** `customer_id`, `flight_number`.

**Domain notes:**
- `aspects.entertainment` is `null` on narrow-body flights (B737/A320 have no seat-back IFE).
- Use `flight_number` (not `flight_id`) - Mongo doesn't store the SQL surrogate key.

### 2.4 `user_activity_logs`

Heterogeneous event stream. `event_type` determines the shape of the
`data` sub-document.

**Document shape:**
```jsonc
{
  "log_id": "LOG-3007",
  "customer_id": 3,
  "event_type": "file_ticket",                  // see table below
  "device": "web",                              // ios | android | web
  "session_id": "sess-jw-9201",
  "timestamp": ISODate("2026-05-01T13:20:00Z"),
  "data": { "ticket_id": "TCK-1005", "category": "Complaint" }   // shape varies by event_type
}
```

**`data` shape per event_type:**

| event_type        | data fields                                                         |
|-------------------|---------------------------------------------------------------------|
| `login`           | `ip`, `city?`                                                       |
| `search`          | `origin`, `destination`, `depart_date`, `cabin`                     |
| `view_flight`     | `flight_number`, `depart_date?`                                     |
| `view_booking`    | `booking_reference`                                                 |
| `page_view`       | `page`, `ticket_id?`                                                |
| `check_in`        | `booking_reference`, `flight_number`, `seat`                        |
| `file_ticket`     | `ticket_id`, `category`                                             |
| `leave_review`    | `review_id`, `flight_number`, `rating`                              |
| `cancel_booking`  | `booking_reference`, `reason`, `refund_status`                      |
| `redeem_miles`    | `miles_redeemed`, `reward`                                          |

**Indexes:** `customer_id`, `timestamp DESC`.

### 2.5 Sample NL → MongoDB query

**Q: "List all open or in-progress tickets, newest first."**
```js
db.support_tickets
  .find({ status: { $in: ["Open", "InProgress"] } })
  .sort({ created_at: -1 });
```

**Q: "Average rating per flight, lowest first."**
```js
db.flight_reviews.aggregate([
  { $group: { _id: "$flight_number", avg: { $avg: "$rating" }, n: { $sum: 1 } } },
  { $sort: { avg: 1 } }
]);
```

**Q: "Most common complaint categories last 30 days."**
```js
db.support_tickets.aggregate([
  { $match: { created_at: { $gte: ISODate("2026-04-08T00:00:00Z") } } },
  { $group: { _id: "$category", n: { $sum: 1 } } },
  { $sort: { n: -1 } }
]);
```

**Q: "Find tickets that mention 'delay' (in subject, tags, or messages)."**
```js
db.support_tickets.find({
  $or: [
    { subject: /delay/i },
    { tags: "delay" },
    { "messages.text": /delay/i }
  ]
});
```

**Q: "Recent search activity for customer 13 - unique destinations."**
```js
db.user_activity_logs.distinct("data.destination", {
  customer_id: 13, event_type: "search"
});
```

**Q: "Tickets filed against flight SN301 with their resolutions."**
```js
db.support_tickets.find(
  { tags: "SN301" },
  { ticket_id: 1, customer_id: 1, status: 1, resolution: 1, _id: 0 }
);
```

---

## 3. Cross-store joins

The agent will often need to combine SQL facts with MongoDB context.
Two keys span both stores - these are the join keys to use:

| Key                 | SQL location                       | MongoDB location                                                              |
|---------------------|------------------------------------|-------------------------------------------------------------------------------|
| `customer_id`       | `customers.customer_id`            | `support_tickets.customer_id`, `flight_reviews.customer_id`, `user_activity_logs.customer_id` |
| `booking_reference` | `bookings.booking_reference`       | `support_tickets.booking_reference`, `user_activity_logs.data.booking_reference` |
| `flight_number`     | `flights.flight_number`            | `flight_reviews.flight_number`, `support_tickets.tags[]`                       |

There is no foreign-key enforcement across stores - your agent must do
the joining client-side after each tool call. Pattern:

1. **Resolve the entity in SQL first** (get `customer_id` / `booking_reference`).
2. **Then query MongoDB** with that key.
3. Combine results in the LLM's reasoning step.

### 3.1 Example multi-tool flow

> *"What did Aisha Khan complain about, and what's the policy that applies?"*

| Step | Tool       | Query                                                                                          | Result                                  |
|------|------------|------------------------------------------------------------------------------------------------|-----------------------------------------|
| 1    | sql_query  | `SELECT customer_id FROM customers WHERE first_name='Aisha' AND last_name='Khan';`             | `13`                                    |
| 2    | mongo_query| `db.support_tickets.find({customer_id: 13})`                                                   | `TCK-1009` - wheelchair assistance      |
| 3    | rag_lookup | `"wheelchair assistance request cut-off"`                                                      | Handbook §5.1: 48 hours before departure |
| 4    | sql_query  | `SELECT flight_number, status, departure_time FROM flights f JOIN bookings b ... booking_reference='SKYA4H5KF';` | SN801, Scheduled, 2026-05-20 |

The final answer composes facts from all three steps - exactly what
the schema doc + few-shot examples should make easy for the agent.

---

## 4. Tips for prompting an NL → query agent

1. **Always pass schema *plus* 3-5 worked examples** (sections 1.8, 2.5).
   Examples carry more weight than schema text per token.
2. **Constrain the output format.** Tell the LLM to return *only* the
   query (no prose) so your tool can execute it directly. A JSON-mode
   wrapper like `{"query": "SELECT ..."}` is even more reliable.
3. **Reject queries that don't reference any seeded table/collection.**
   This catches hallucinated tables before you execute them.
4. **Always run with a `LIMIT`** (SQL) or `.limit(N)` (Mongo) injected
   server-side to cap blast radius if the LLM forgets.
5. **Return schemas of *all* tables the agent might need**, even if a
   given question only touches one - the agent often needs to discover
   the join path.
6. **Log the generated query alongside the natural-language input** -
   this is your gold for fine-tuning or for building a retrieval-based
   few-shot index later.
