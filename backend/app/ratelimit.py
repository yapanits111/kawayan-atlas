"""A tiny in-memory sliding-window rate limiter (standard library only).

Good enough to blunt brute-force / abuse on the auth endpoints for a single-instance
backend. On multi-instance or serverless deployments it limits per instance, so a shared
store (e.g. Redis) would be needed for strict global limits — noted, not required here.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict

from fastapi import HTTPException

_hits: dict[str, list[float]] = defaultdict(list)
_lock = threading.Lock()


def check(key: str, limit: int, window_seconds: float) -> None:
    """Record a hit for `key`; raise 429 if more than `limit` hits fell within the window."""
    now = time.time()
    with _lock:
        recent = [t for t in _hits[key] if now - t < window_seconds]
        recent.append(now)
        _hits[key] = recent
        if len(recent) > limit:
            raise HTTPException(
                status_code=429,
                detail="Too many attempts. Please wait a minute and try again.",
            )


def reset() -> None:
    """Clear all counters (used between tests)."""
    with _lock:
        _hits.clear()
