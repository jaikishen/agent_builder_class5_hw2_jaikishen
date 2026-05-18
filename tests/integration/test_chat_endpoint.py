"""Integration test for POST /chat — fake LLM + real Supabase via sql_query."""
from __future__ import annotations

from langchain_core.language_models import GenericFakeChatModel
from langchain_core.messages import AIMessage


class FakeChatWithTools(GenericFakeChatModel):
    """GenericFakeChatModel + no-op bind_tools so create_agent accepts it."""
    def bind_tools(self, tools, **kwargs):  # type: ignore[override]
        return self


def test_chat_endpoint_returns_envelope_with_real_tool_call():
    """End-to-end: client POSTs a question, fake LLM emits a sql_query tool call,
    real Postgres returns the count, fake LLM phrases the final answer."""
    from fastapi.testclient import TestClient

    from backend.app import app, get_model

    fake = FakeChatWithTools(messages=iter([
        AIMessage(
            content="",
            tool_calls=[{
                "name": "sql_query",
                "args": {"sql": "SELECT COUNT(*) AS n FROM customers"},
                "id": "call_1",
            }],
        ),
        AIMessage(content="There are 25 customers in total."),
    ]))

    app.dependency_overrides[get_model] = lambda: fake
    try:
        client = TestClient(app)
        r = client.post("/chat", json={"message": "How many customers do we have?"})
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 200, r.text
    data = r.json()
    assert "25" in data["answer"]
    assert len(data["tool_calls"]) == 1
    tc = data["tool_calls"][0]
    assert tc["tool"] == "sql_query"
    assert tc["input"] == {"sql": "SELECT COUNT(*) AS n FROM customers"}
    assert '"n": 25' in tc["output_preview"]
    assert data["warnings"] == []
    assert isinstance(data["elapsed_ms"], int)
