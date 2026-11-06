"""HTTP validation and response mapping. Provider logic lives in services/."""
import os
from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.services.market_data import MarketDataError, get_history, get_stock, search_stocks
from backend.schemas import MonteCarloRequest
from backend.services.monte_carlo import SimulationError, run_monte_carlo

app = FastAPI(title="MonteCarl0 API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[s.strip() for s in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if s.strip()],
    allow_methods=["GET", "POST"], allow_headers=["*"],
)


@app.exception_handler(MarketDataError)
def market_error(request: Request, exc: MarketDataError):
    return JSONResponse(status_code=exc.status, content={"detail": str(exc)})


@app.exception_handler(RequestValidationError)
def validation_error(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={
        "detail": "Invalid request parameters.",
        "errors": [{"field": ".".join(map(str, error["loc"])), "message": error["msg"]}
                   for error in exc.errors()],
    })


@app.exception_handler(SimulationError)
def simulation_error(request: Request, exc: SimulationError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.post("/api/simulations/monte-carlo")
def monte_carlo(parameters: MonteCarloRequest):
    # A synchronous route runs in FastAPI's worker thread pool, not its event loop.
    return run_monte_carlo(parameters)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/search")
def search(q: str = Query(default="", max_length=80)):
    return search_stocks(q)


@app.get("/api/stocks/{ticker}/history")
def history(ticker: str, period: str = "1y"):
    return get_history(ticker, period)


@app.get("/api/stocks/{ticker}")
def stock(ticker: str):
    return get_stock(ticker)


# Single-origin deployment: API routes take precedence over built frontend files.
if os.getenv("PUBLIC_DEMO") == "1":
    from backend.demo_limits import limit_demo_requests
    app.middleware("http")(limit_demo_requests)

if os.getenv("STATIC_DIR"):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=os.environ["STATIC_DIR"], html=True), name="frontend")
