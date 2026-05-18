"""Unit tests for backend.agent — LLM is always mocked (GenericFakeChatModel)."""
from __future__ import annotations


from langchain_core.language_models import GenericFakeChatModel


class FakeChatWithTools(GenericFakeChatModel):
    """GenericFakeChatModel + a no-op bind_tools so create_agent can use it.

    The real ChatOpenAI uses bind_tools to tell the model about available
    functions. The fake doesn't care — it returns canned messages regardless.
    """
    def bind_tools(self, tools, **kwargs):  # type: ignore[override]
        return self


def _fake_llm(messages):
    """Build a FakeChatWithTools that yields the given AIMessages in order."""
    return FakeChatWithTools(messages=iter(messages))


def test_run_agent_returns_chat_response_with_direct_answer():
    """When the LLM answers without calling any tool, run_agent returns the answer
    and empty tool_calls/warnings."""
    from langchain_core.messages import AIMessage

    from backend.agent import run_agent
    from backend.schemas import ChatResponse

    fake = _fake_llm([AIMessage(content="Hello back!")])
    result = run_agent("hi", model=fake)

    assert isinstance(result, ChatResponse)
    assert result.answer == "Hello back!"
    assert result.tool_calls == []
    assert result.warnings == []
    assert isinstance(result.elapsed_ms, int)
    assert result.elapsed_ms >= 0


def test_run_agent_warns_on_max_iterations(monkeypatch):
    """If the agent never stops calling tools, `max_iterations_reached` warning
    is added and the answer is a graceful fallback (not a partial transcript)."""
    from langchain_core.messages import AIMessage

    from backend.agent import run_agent
    from backend.tools import sql_query as sql_query_mod

    monkeypatch.setattr(
        sql_query_mod.sql_query, "func",
        lambda sql: '{"rows":[{"x":1}],"truncated":false,"shown":1,"total":1}',
    )

    # 100 tool-call messages — more than enough to exceed any reasonable cap.
    looping = [
        AIMessage(
            content="",
            tool_calls=[{"name": "sql_query", "args": {"sql": f"SELECT {i}"}, "id": f"call_{i}"}],
        )
        for i in range(100)
    ]
    fake = FakeChatWithTools(messages=iter(looping))

    result = run_agent("loop forever", model=fake, max_iterations=2)

    assert "max_iterations_reached" in result.warnings, (
        f"expected warning, got {result.warnings!r}"
    )
    assert result.answer, "answer should be a fallback string, not empty"


def test_run_agent_records_tool_calls(monkeypatch):
    """When the LLM emits a tool call, run_agent transcribes it into ToolCall.

    We mock sql_query so the unit test stays offline.
    """
    from langchain_core.messages import AIMessage

    from backend.agent import run_agent
    from backend.tools import sql_query as sql_query_mod

    # Override the actual SQL execution with a canned JSON string the LLM would see.
    canned_output = '{"rows":[{"n":4}],"truncated":false,"shown":1,"total":1}'
    monkeypatch.setattr(
        sql_query_mod.sql_query, "func",
        lambda sql: canned_output,
    )

    sql_tool_call = {
        "name": "sql_query",
        "args": {"sql": "SELECT COUNT(*) AS n FROM customers WHERE loyalty_tier = 'Platinum'"},
        "id": "call_1",
    }
    fake = _fake_llm([
        AIMessage(content="", tool_calls=[sql_tool_call]),
        AIMessage(content="There are 4 Platinum customers."),
    ])

    result = run_agent("How many Platinum customers do we have?", model=fake)

    assert result.answer == "There are 4 Platinum customers."
    assert len(result.tool_calls) == 1
    tc = result.tool_calls[0]
    assert tc.tool == "sql_query"
    assert tc.input == {"sql": "SELECT COUNT(*) AS n FROM customers WHERE loyalty_tier = 'Platinum'"}
    assert "n" in tc.output_preview and "4" in tc.output_preview
