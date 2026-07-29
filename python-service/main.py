import os
import hmac

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import date
from typing import Optional

from chart import calculate_chart
from dasha import calculate_dashas
from transits import calculate_transits

app = FastAPI(title="Astro Coach Ephemeris Service")

# SEC-01: shared-secret auth so anyone who learns the deployed URL can't call
# /calculate, /dasha, /transits directly and bypass the Next.js rate limiter.
# Set EPHEMERIS_SHARED_SECRET the same in both this service (Railway/Render)
# and the Next.js app (server-only env var, never NEXT_PUBLIC_*). If unset,
# auth is skipped — this keeps local dev (`./start.sh`) working with zero
# extra setup, but MUST be set in any deployment reachable from the internet.
_SHARED_SECRET = os.getenv("EPHEMERIS_SHARED_SECRET", "")


def _verify_secret(x_ephemeris_secret: Optional[str] = Header(default=None)) -> None:
    if not _SHARED_SECRET:
        return
    if not x_ephemeris_secret or not hmac.compare_digest(x_ephemeris_secret, _SHARED_SECRET):
        raise HTTPException(status_code=401, detail="Invalid or missing service credentials")

# SCALE-03: restrict CORS to known origins instead of wildcard.
# In Railway → Variables set ALLOWED_ORIGINS to your Vercel domain,
# e.g. "https://your-app.vercel.app" (comma-separated for multiple).
# Defaults to localhost for local development.
_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001")
ALLOWED_ORIGINS = [o.strip() for o in _raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],       # only what the service actually uses
    allow_headers=["Content-Type", "X-Ephemeris-Secret"],
)


class ChartRequest(BaseModel):
    name: str
    year: int
    month: int
    day: int
    hour: int
    minute: int
    lat: float
    lng: float
    tz_str: str


class DashaRequest(BaseModel):
    moon_abs_pos: float
    birth_year: int
    birth_month: int
    birth_day: int


class TransitRequest(BaseModel):
    natal_asc_sign_num: int
    tz_str: str = "UTC"
    natal_moon_sign_num: Optional[int] = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/calculate", dependencies=[Depends(_verify_secret)])
def calculate(req: ChartRequest):
    try:
        return calculate_chart(
            req.name, req.year, req.month, req.day,
            req.hour, req.minute, req.lat, req.lng, req.tz_str,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/dasha", dependencies=[Depends(_verify_secret)])
def dasha(req: DashaRequest):
    try:
        birth = date(req.birth_year, req.birth_month, req.birth_day)
        return calculate_dashas(req.moon_abs_pos, birth)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/transits", dependencies=[Depends(_verify_secret)])
def transits(req: TransitRequest):
    try:
        return calculate_transits(req.natal_asc_sign_num, req.tz_str, req.natal_moon_sign_num)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
