from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import date

from chart import calculate_chart
from dasha import calculate_dashas
from transits import calculate_transits

app = FastAPI(title="Astro Coach Ephemeris Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/calculate")
def calculate(req: ChartRequest):
    try:
        return calculate_chart(
            req.name, req.year, req.month, req.day,
            req.hour, req.minute, req.lat, req.lng, req.tz_str,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/dasha")
def dasha(req: DashaRequest):
    try:
        birth = date(req.birth_year, req.birth_month, req.birth_day)
        return calculate_dashas(req.moon_abs_pos, birth)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/transits")
def transits(req: TransitRequest):
    try:
        return calculate_transits(req.natal_asc_sign_num, req.tz_str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
