"""Process-wide demo request budget; intentionally independent of spoofable IP headers."""
from collections import deque
from threading import Lock
from time import monotonic
from starlette.responses import JSONResponse


class DemoBudget:
    def __init__(self, limit=60, window=60, clock=monotonic):
        self.limit, self.window, self.clock = limit, window, clock
        self.requests = deque()
        self.lock = Lock()

    def allow(self):
        with self.lock:
            now = self.clock()
            while self.requests and self.requests[0] <= now-self.window:
                self.requests.popleft()
            if len(self.requests) >= self.limit:
                return False
            self.requests.append(now)
            return True


budget = DemoBudget()


async def limit_demo_requests(request, call_next):
    if request.url.path.startswith('/api/') and request.url.path != '/api/health' and request.method != 'OPTIONS':
        if not budget.allow():
            return JSONResponse(status_code=429, content={'detail': 'The shared demo is busy. Please retry in one minute.'}, headers={'Retry-After': '60'})
    return await call_next(request)
