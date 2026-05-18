"""LangChain v1 ReAct agent for SkyNova Airlines.

Phase 2: wired with only `sql_query`. Subsequent phases append mongo_query
and handbook_search to the tools list.
"""
from __future__ import annotations

import time
from typing import Any

from langchain.agents import create_agent
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langgraph.errors import GraphRecursionError

from backend.schemas import ChatResponse, ToolCall
from backend.tools.handbook_search import handbook_search
from backend.tools.mongo_query import mongo_query
from backend.tools.sql_query import sql_query

_MAX_ITERATIONS_FALLBACK = (
    "I ran out of reasoning steps before reaching a final answer. "
    "Please rephrase the question or break it into smaller parts."
)

SYSTEM_PROMPT = """You are a SkyNova Airlines analyst. Today is 2026-05-08.

You have three tools available:

- sql_query(sql: str) → JSON. Read-only SELECT against Supabase Postgres.
  Returns a wrapper dict: {rows, truncated, shown, total}. Multi-statements,
  writes, and dangerous keywords are refused (you'll get a "REFUSED: ..."
  string). Postgres errors come back as "ERROR: ..." strings — read them
  and adjust your query.

- mongo_query(collection, operation, filter, projection, pipeline, sort, limit)
  → JSON. Read-only query against MongoDB Atlas. Same wrapper dict shape.
  Allowed collections: support_tickets, flight_reviews, user_activity_logs.
  Allowed aggregation stages: $match, $group, $sort, $limit, $project.
  $where (server-side JS) is blocked. Operations: "find", "aggregate",
  "count_documents".

- handbook_search(query: str, k: int = 4) → JSON. Semantic search over the
  SkyNova passenger handbook (baggage, refunds, delays, loyalty, pets,
  special assistance, boarding, check-in, in-flight, contact). Returns top-k
  chunks with `{content, section, similarity}` per row. Use this for ANY
  policy / how-do-I / what-is-allowed question.

Route by question type:
  - Counting, joining, summing relational facts (customers, flights, bookings,
    airports, aircraft) → sql_query.
  - Tickets, reviews, activity logs → mongo_query.
  - Policies, allowances, rules, how-tos → handbook_search.
  - Multi-part questions may need 2 or 3 tools in one ReAct loop — call them
    in any order, then synthesize the answer.

## SQL schema (5 tables, all in `public`)

`customers`(customer_id PK, first_name, last_name, email, phone, country,
date_of_birth, loyalty_tier, loyalty_miles, created_at)
  loyalty_tier ∈ {'None','Silver','Gold','Platinum'}

`airports`(airport_code PK CHAR(3), airport_name, city, country)

`aircraft`(aircraft_id PK, registration, model, capacity)

`flights`(flight_id PK, flight_number, origin → airports.airport_code,
destination → airports.airport_code, departure_time, arrival_time,
aircraft_id → aircraft, status, base_price_usd)
  status ∈ {'Scheduled','Departed','Arrived','Completed','Delayed','Cancelled'}
  flight_number is NOT unique (same SN401 can run on multiple dates).

`bookings`(booking_id PK, booking_reference UNIQUE, customer_id → customers,
flight_id → flights, seat_number, cabin_class, fare_paid_usd, booking_status,
booked_at)
  cabin_class ∈ {'Economy','PremiumEconomy','Business','First'}
  booking_status ∈ {'Confirmed','CheckedIn','Completed','Cancelled','NoShow'}

## Examples

Q: How many Platinum customers do we have?
A: SELECT COUNT(*) FROM customers WHERE loyalty_tier = 'Platinum';

Q: Total revenue from completed bookings, by cabin class.
A: SELECT cabin_class, SUM(fare_paid_usd) AS revenue FROM bookings
   WHERE booking_status = 'Completed' GROUP BY cabin_class ORDER BY revenue DESC;

Q: Which flights were cancelled and how many bookings were affected?
A: SELECT f.flight_number, f.departure_time, COUNT(b.booking_id) AS affected
   FROM flights f LEFT JOIN bookings b ON b.flight_id = f.flight_id
   WHERE f.status = 'Cancelled' GROUP BY f.flight_id, f.flight_number, f.departure_time;

## MongoDB collections (3 of them in db `skynova`)

`support_tickets` — passenger cases with threaded messages.
  Fields: ticket_id, customer_id (→ SQL customers.customer_id),
  booking_reference (→ SQL bookings.booking_reference, may be null),
  category ∈ {Refund, Complaint, Baggage, Loyalty, SpecialAssistance,
  FlightChange, Other}, priority ∈ {Low, Medium, High},
  status ∈ {Open, InProgress, Resolved}, subject, tags (string[],
  often includes flight number like "SN401"), resolution (only when
  Resolved), created_at, updated_at, messages[{from, at, text}].

`flight_reviews` — post-flight ratings.
  Fields: review_id, customer_id, flight_number (use this, not flight_id),
  booking_reference, rating (1-5), verified_passenger, aspects.{seat, food,
  crew, entertainment, punctuality}, title, comment, posted_at.

`user_activity_logs` — heterogeneous event stream.
  Fields: log_id, customer_id, event_type, device, session_id, timestamp,
  data (shape varies by event_type).

## Example MongoDB queries

Q: List all open support tickets.
A: mongo_query(collection="support_tickets", operation="find",
   filter={"status":"Open"})

Q: Average rating per flight, lowest first.
A: mongo_query(collection="flight_reviews", operation="aggregate",
   pipeline=[
     {"$group": {"_id": "$flight_number", "avg": {"$avg": "$rating"},
                 "n": {"$sum": 1}}},
     {"$sort": {"avg": 1}}
   ])

Q: Tickets tagged for flight SN301.
A: mongo_query(collection="support_tickets", operation="find",
   filter={"tags": "SN301"})

## Example handbook queries

Q: What is our pet travel policy?
A: handbook_search(query="pet travel policy", k=4)

Q: What is the delay compensation policy?
A: handbook_search(query="delay compensation", k=4)

After any tool returns, read the JSON `rows` and answer in plain English —
concise, no raw query syntax in the final answer unless the user explicitly
asked for it. If a tool returns "REFUSED: ..." or "ERROR: ...", read the
reason and adjust the query (e.g. fix a column name, narrow the filter).
"""


def _build_model() -> BaseChatModel:
    from langchain_openai import ChatOpenAI
    from settings import get_settings
    s = get_settings()
    return ChatOpenAI(model=s.model_name, api_key=s.openai_api_key, temperature=0)


def build_agent(model: BaseChatModel | None = None) -> Any:
    """Return a compiled LangGraph ReAct agent bound to the SkyNova tools."""
    if model is None:
        model = _build_model()
    return create_agent(
        model,
        tools=[sql_query, mongo_query, handbook_search],
        system_prompt=SYSTEM_PROMPT,
    )


def _extract_tool_calls(messages: list) -> list[ToolCall]:
    """Pair each AIMessage tool_call with its ToolMessage result.

    The agent's conversation walks: HumanMessage → AIMessage(tool_calls=...) →
    ToolMessage(tool_call_id=...) → AIMessage(content=final). One ToolCall per
    invocation, in order.
    """
    tool_outputs = {
        m.tool_call_id: m.content
        for m in messages
        if isinstance(m, ToolMessage)
    }
    calls: list[ToolCall] = []
    for m in messages:
        if not isinstance(m, AIMessage):
            continue
        for tc in (m.tool_calls or []):
            name = tc.get("name", "")
            args = tc.get("args", {}) or {}
            call_id = tc.get("id", "")
            output = tool_outputs.get(call_id, "")
            calls.append(ToolCall(
                tool=name,
                input=args,
                output_preview=str(output)[:500],
            ))
    return calls


def _final_answer(messages: list) -> str:
    """Pick the content of the last AIMessage in the conversation."""
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and msg.content:
            content = msg.content
            if isinstance(content, list):
                # Some providers return a list of content blocks.
                parts = [c.get("text", "") if isinstance(c, dict) else str(c) for c in content]
                return "".join(parts).strip()
            return str(content).strip()
    return ""


def run_agent(
    message: str,
    *,
    model: BaseChatModel | None = None,
    max_iterations: int | None = None,
) -> ChatResponse:
    """Run one turn of the ReAct agent against `message`.

    `max_iterations` caps the number of ReAct loop turns. When exceeded, the
    response carries a `max_iterations_reached` warning and a graceful answer
    instead of a partial transcript.
    """
    from settings import get_settings

    if max_iterations is None:
        max_iterations = get_settings().max_iterations

    # Each ReAct turn is two graph steps (model + tools). Add a small buffer.
    recursion_limit = max_iterations * 2 + 1

    agent = build_agent(model=model)
    warnings: list[str] = []

    start = time.perf_counter()
    try:
        result = agent.invoke(
            {"messages": [HumanMessage(content=message)]},
            config={"recursion_limit": recursion_limit},
        )
        messages = result.get("messages", [])
        answer = _final_answer(messages)
    except GraphRecursionError:
        warnings.append("max_iterations_reached")
        messages = []
        answer = _MAX_ITERATIONS_FALLBACK
    elapsed_ms = int((time.perf_counter() - start) * 1000)

    return ChatResponse(
        answer=answer,
        tool_calls=_extract_tool_calls(messages),
        warnings=warnings,
        elapsed_ms=elapsed_ms,
    )
