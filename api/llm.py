"""
Ibn Sina — single LLM provider router.

Every agent calls get_llm(task) instead of constructing a model client.
Fallback chains absorb 429s silently so a rate-limit hit mid-demo
reroutes to the backup provider without anyone noticing.

Prompt-hash disk cache prevents repeated calls for the same input.
"""

from __future__ import annotations

import hashlib
import json
import os
import pathlib

from langchain_core.language_models import BaseChatModel

CACHE_DIR = pathlib.Path(os.getenv("LLM_CACHE_DIR", ".llm_cache"))


def _cache_key(prompt: str) -> str:
    return hashlib.sha256(prompt.encode()).hexdigest()


def read_cache(prompt: str) -> str | None:
    p = CACHE_DIR / f"{_cache_key(prompt)}.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8")).get("response")
    return None


def write_cache(prompt: str, response: str) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    p = CACHE_DIR / f"{_cache_key(prompt)}.json"
    p.write_text(
        json.dumps({"prompt_hash": _cache_key(prompt), "response": response}),
        encoding="utf-8",
    )


def get_llm(task: str = "fast") -> BaseChatModel:
    """Return a model for the given task type.

    task: 'fast'   -> Groq (llama) with Gemini fallback.  Text agents.
          'reason' -> Gemini with Groq fallback.           Synthesis/disposition.
          'vision' -> Gemini only (only free vision API).  CXR reader.
    """
    groq_key = os.getenv("GROQ_API_KEY", "")
    google_key = os.getenv("GOOGLE_API_KEY", "")

    model_fast = os.getenv("MODEL_FAST", "llama-3.3-70b-versatile")
    model_reason = os.getenv("MODEL_REASON", "gemini-2.5-flash")
    model_vision = os.getenv("MODEL_VISION", "gemini-2.5-flash")

    gemini_available = bool(google_key)
    groq_available = bool(groq_key)

    if task == "vision":
        if not gemini_available:
            raise RuntimeError(
                "GOOGLE_API_KEY is required for vision tasks (CXR reading). "
                "Get a free key at aistudio.google.com/apikey"
            )
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=model_vision,
            temperature=0.1,
            google_api_key=google_key,
        )

    if task == "reason":
        if gemini_available:
            from langchain_google_genai import ChatGoogleGenerativeAI

            primary = ChatGoogleGenerativeAI(
                model=model_reason,
                temperature=0.2,
                google_api_key=google_key,
            )
            if groq_available:
                from langchain_groq import ChatGroq

                fallback = ChatGroq(
                    model=model_fast,
                    temperature=0.2,
                    groq_api_key=groq_key,
                )
                return primary.with_fallbacks([fallback])
            return primary

        if groq_available:
            from langchain_groq import ChatGroq

            return ChatGroq(
                model=model_fast,
                temperature=0.2,
                groq_api_key=groq_key,
            )
        raise RuntimeError("At least one of GOOGLE_API_KEY or GROQ_API_KEY is required")

    # task == "fast" (default)
    if groq_available:
        from langchain_groq import ChatGroq

        primary = ChatGroq(
            model=model_fast,
            temperature=0.1,
            groq_api_key=groq_key,
        )
        if gemini_available:
            from langchain_google_genai import ChatGoogleGenerativeAI

            fallback = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash-lite",
                temperature=0.1,
                google_api_key=google_key,
            )
            return primary.with_fallbacks([fallback])
        return primary

    if gemini_available:
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model="gemini-2.5-flash-lite",
            temperature=0.1,
            google_api_key=google_key,
        )

    raise RuntimeError(
        "No LLM provider configured. Set GROQ_API_KEY and/or GOOGLE_API_KEY "
        "in your .env file. Both are free — see .env.example."
    )
