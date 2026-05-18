# SkyNova Airlines Agent
Build a ReAct agent (gpt-4o-mini) that answers passenger service and operations questions for SkyNova Airlines. The agent draws on three data sources and picks the right tool for each question.

There are 3 data sources - 
1. Supabase (SQL) 
2. MongoDB (NoSQL)
3. PDF (RAG) 

The data is internally consistent. Every customer_id in MongoDB maps to a row in customers. Every booking_reference in tickets matches bookings.booking_reference. Ticket events line up with flight statuses (SN301 was cancelled and three customers filed tickets; SN401 was delayed and five reviews mention the delay).

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

Tech Stack: 
1. Langchain V1 docs - refer the latest one always; 
2. FastAPI service to wrap agent in API; 
3. Create a React UI - use color palette (Primary #111827 / Secondary #2563EB / Background #FAFAFA / Surface #FFFFFF / Accent #38BDF8);
4. No Auth needed right now. 
Ensure to use Superpowers