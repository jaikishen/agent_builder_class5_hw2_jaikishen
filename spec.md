# SkyNova Airlines Agent
A ReAct agent (gpt-4o-mini) that answers passenger service and operations questions for SkyNova Airlines. The agent uses three data sources and picks the right tool for each question.

There are 3 data sources - 
- **SQL (Supabase Postgres)** — relational facts: customers, airports,  aircraft, flights, bookings.
- **MongoDB Atlas** — semi-structured records: support tickets, flight  reviews, user activity logs.
- **Vector search (pgvector inside Supabase)** — passenger handbook  policies (baggage, refunds, delays, loyalty, etc.).

The data is internally consistent. Every customer_id in MongoDB maps to a row in customers. Every booking_reference in tickets matches bookings.booking_reference. Ticket events line up with flight statuses (SN301 was cancelled and three customers filed tickets; SN401 was delayed and five reviews mention the delay).

The agent reads a question, picks the right tool(s) — sometimes 1, sometimes 3 — and produces an answer. The frontend shows the *reasoning trail* (which tools fired, with what arguments) above the answer, so you can see how it arrived at the conclusion.

## Example questions the agent should answer

These need two or three tools in a single ReAct loop:

1. **"Customer 3 complained about flight SN401. What is our delay compensation policy, what did they actually fly, and what is the ticket status?"**
   Tools used: RAG (handbook section 3.5) + SQL (bookings join   flights) + Mongo (support_tickets).

2. **"For SN301, who was affected, what is our cancellation policy, and what did the affected passengers say?"**
   Tools used: SQL (bookings on flight 5) + RAG (handbook section 3.4) + Mongo (tickets and reviews).

3. **"How much has Aarav Mehta spent with us this year, what tier is he, and what miles bonus should his Business class trip have earned per the program?"**
   Tools used: SQL (sum fares for customer 1) + RAG (loyalty earn rates) + Mongo (TCK-1007 about missing miles).

4. **"Aisha Khan has a wheelchair assistance request. What is the cut off for booking that, and is her flight still scheduled?"**
   Tools used: RAG (section 5.1) + SQL (flight for booking
   SKYA4H5KF) + Mongo (TCK-1009 status).

5. **"Which flights had the lowest average ratings recently, and what   did passengers complain about?"**
   Tools used: Mongo (aggregate `flight_reviews`) + Mongo
   (`support_tickets` filtered by the same flight numbers).

Single source questions are also fair game:

- "How many Platinum customers do we have?" -> SQL only.
- "What is our pet travel policy?" -> RAG only.
- "List all open support tickets." -> Mongo only.

1. Langchain V1 docs - refer the latest one always; 
2. FastAPI service to wrap agent in API; 
3. Create a React UI - use 
4. No Auth needed right now. 
Ensure to use Superpowers

## TECH STACK: 

# Backend 	
* Python 3.11 · FastAPI · LangChain v1 ReAct agent (create_agent), using OpenAI gpt-4o-mini by default. · LangGraph runtime · psycopg3 · pymongo · pydantic-settings
* FastAPI server with a single POST /chat endpoint.
* Three tools, each with Pydantic-typed arguments:
    1. sql_query: read-only SELECT against Supabase Postgres (or any Postgres). Must reject writes, multi-statements, and dangerous keywords. Auto-injects a LIMIT if missing. Has a statement timeout.

    2. mongo_query: typed args against MongoDB Atlas (or local Mongo). Has a collection whitelist. Caps the result count. If aggregation is allowed, restrict it to safe stages ($match, $group, $sort, $limit, $project). No server-side JS.

    3. handbook_search: vector RAG over pgvector using text-embedding-3-small. Returns top-k chunks with their section labels.
    The endpoint returns {answer, tool_calls, warnings, elapsed_ms}. Yes, you must include tool_calls in the response so the frontend can show what the agent actually did.

# Frontend
* Vite · React 19 · TypeScript · Tailwind v4 · react-markdown · lucide-react
* The UI must show three things: the user's question, the agent's final answer, and the tool call trace (which tool was called, with what arguments, and what came back).
* No auth required. No streaming required. No multi-turn memory required. Single turn is fine.

Models
	OpenAI gpt-4o-mini (chat)
    text-embedding-3-small (RAG)

Data	
* Supabase Postgres (5 seed tables, ~103 rows) 
* MongoDB Atlas (3 seed collections, 87 docs) 
* pgvector documents table (31 handbook chunks)


Tests
* pytest, organized into unit/, integration/, and e2e/ folders. 
* pytest-cov · 
* Mock the LLM at the unit level. LangChain's GenericFakeChatModel works well for this (unit level mocking)
* At least one e2e test that runs a real question through the full agent loop.

Reference architecture
Browser -> React UI -> FastAPI -> LangChain v1 ReAct agent -> [sql_query | mongo_query | handbook_search] -> live store
The agent never connects to the data stores directly. Every read goes through one of the three typed tools. 

## API reference
 
### `GET /health`

**Response (200):**
```json
{ "ok": true }
```



### `GET /chat`
**Request**
{ "message": "How many Platinum customers do we have?" }

**Response**
{
  "answer": "There are 4 Platinum customers.",
  "tool_calls": [
    {
      "tool": "sql_query",
      "input": { "sql": "SELECT COUNT(*) AS n FROM customers WHERE loyalty_tier = 'Platinum'" },
      "output_preview": "[{\"n\": 4}]"
    }
  ],
  "warnings": [],
  "elapsed_ms": 1842
}

## Failure modes
422 — empty / missing message
500 — unhandled exception. Body includes a request_id for log correlation; full traceback stays server-side.
200 with warnings: ["max_iterations_reached"] — the agent ran out of reasoning steps. The answer field carries a graceful fallback message rather than a partial transcript.

## Security notes
* SQL is read-only at the regex layer. Even if the LLM tries to DELETE, the tool refuses before reaching Postgres. Defense in depth: the documents table also has RLS enabled with no policies, and the agent connects via the postgres role over a server-side connection — never through PostgREST as anon.
* Mongo aggregation is whitelisted. $lookup, $out, $merge, $accumulator, $function, and $where are all blocked recursively.
* Service-role keys are intentionally absent. Only the legacy anon JWT and the modern publishable key are referenced by .env. Backend writes go directly through the Postgres role for the migration step; runtime only reads.
* .env is gitignored, along with node_modules/, .venv/, .coverage, and the agent_builder_nlsql/ reference checkout.