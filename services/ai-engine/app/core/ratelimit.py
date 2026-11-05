from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field


@dataclass
class FixedWindowLimiter:
    """Small in-process limiter for the internal service.

    A single-instance deployment only. For multiple AI Engine replicas this must be
    replaced with a shared limiter (Redis/Postgres). The Go API also protects the
    user-facing endpoint with a per-user generation lock.
    """

    limit: int
    window_seconds: float = 60.0
    _hits: dict[str, deque[float]] = field(default_factory=dict)

    def allow(self, key: str, *, now: float | None = None) -> tuple[bool, float]:
        current = time.monotonic() if now is None else now
        bucket = self._hits.setdefault(key, deque())
        cutoff = current - self.window_seconds
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= self.limit:
            retry_after = max(0.0, self.window_seconds - (current - bucket[0]))
            return False, retry_after
        bucket.append(current)
        return True, 0.0
