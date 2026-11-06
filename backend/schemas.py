"""Validated inputs for the simulation API; no provider calls occur here."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.services.market_data import MarketDataError, normalize_ticker


class MonteCarloRequest(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    ticker: str = Field(min_length=1, max_length=20)
    simulations: int = 10_000
    horizon_days: int = 30
    history_period: Literal["6mo", "1y", "3y", "5y"] = "1y"
    target_price: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    seed: int | None = Field(default=None, ge=0, le=2**32 - 1)

    @field_validator("ticker")
    @classmethod
    def valid_ticker(cls, value):
        try:
            return normalize_ticker(value)
        except MarketDataError as exc:
            raise ValueError(str(exc)) from exc

    @field_validator("simulations")
    @classmethod
    def valid_simulations(cls, value):
        if value not in {100, 1_000, 5_000, 10_000}:
            raise ValueError("Choose 100, 1000, 5000, or 10000 simulations.")
        return value

    @field_validator("horizon_days")
    @classmethod
    def valid_horizon(cls, value):
        if value not in {7, 30, 60, 90}:
            raise ValueError("Choose 7, 30, 60, or 90 trading days.")
        return value
