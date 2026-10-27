"""HTTP validation and response mapping. Provider logic lives in services/."""
import os
from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.services.market_data import MarketDataError, get_history, get_stock, search_stocks

app = FastAPI(title="MonteCarl0 API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[s.strip() for s in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if s.strip()],
    allow_methods=["GET"], allow_headers=["*"],
)


@app.exception_handler(MarketDataError)
def market_error(request: Request, exc: MarketDataError):
    return JSONResponse(status_code=exc.status, content={"detail": str(exc)})


@app.exception_handler(RequestValidationError)
def validation_error(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": "Invalid request parameters."})


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
