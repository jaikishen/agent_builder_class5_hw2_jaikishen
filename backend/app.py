"""FastAPI application for the SkyNova Airlines agent.

Phase 0: skeleton only. `/chat` returns a contract-shaped stub; the
ReAct agent is wired in phase 2.
"""
from __future__ import annotations

import logging
import time
import uuid
from contextvars import ContextVar

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from langchain_core.language_models import BaseChatModel

from settings import get_settings

from backend.agent import run_agent
from backend.schemas import ChatRequest, ChatResponse

logger = logging.getLogger("skynova")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

settings = get_settings()
logger.info(
    "Settings resolved | model=%s embedding=%s cors_origins=%s",
    settings.model_name, settings.embedding_model, settings.cors_origins,
)

app = FastAPI(title="SkyNova Airlines Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

request_id_var: ContextVar[str] = ContextVar("request_id", default="")


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    token = request_id_var.set(req_id)
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled error | request_id=%s path=%s", req_id, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"error": "internal_server_error", "request_id": req_id},
            headers={"x-request-id": req_id},
        )
    finally:
        request_id_var.reset(token)
    response.headers["x-request-id"] = req_id
    return response


def get_model() -> BaseChatModel:
    """Dependency that returns the chat model. Overridden in tests with a fake."""
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(
        model=settings.model_name,
        api_key=settings.openai_api_key,
        temperature=0,
    )


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, model: BaseChatModel = Depends(get_model)) -> ChatResponse:
    return run_agent(req.message, model=model, history=req.history)
