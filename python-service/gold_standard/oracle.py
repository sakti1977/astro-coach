"""Independent oracles for natal positions, Vimshottari dasha, and classical
yoga/dosha detection.

Natal positions come from pyswisseph (Swiss Ephemeris) with Lahiri ayanamsha
and the SIDEREAL flag — the same published ephemeris the app wraps via
kerykeion, but *not* via kerykeion or chart.py. Dasha timing is closed-form
Vimshottari arithmetic. Yoga/dosha detection restates the classical rules
used as this product's definition (BPHS Pancha Mahapurusha; Gaja Kesari;
Budhaditya; Chandra Mangal; Kemadruma; Visha; Kuja/Manglik; Kaal Sarp
hemisphere; one common Pitru reading).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import swisseph as swe

GOLD_DIR = Path(__file__).resolve().parent

# IAU mean sidereal year in days — the conversion this product uses to turn
# classical Vimshottari *years* into civil dates. Duplicated here on purpose
# (do not import dasha.py).
SIDEREAL_YEAR_DAYS = 365.25636

DASHA_SEQUENCE = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]
DASHA_YEARS = {
    "Ketu": 7, "Venus": 20, "Sun": 6, "Moon": 10, "Mars": 7,
    "Rahu": 18, "Jupiter": 16, "Saturn": 19, "Mercury": 17,
}
NAKSHATRA_LORDS = [
    "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu",
    "Jupiter", "Saturn", "Mercury",
] * 3
NAKSHATRA_NAMES = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashirsha", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishtha",
    "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
]
SIGN_ABBR = [
    "Ari", "Tau", "Gem", "Can", "Leo", "Vir",
    "Lib", "Sco", "Sag", "Cap", "Aqu", "Pis",
]

SWE_BODIES = {
    "sun": swe.SUN,
    "moon": swe.MOON,
    "mercury": swe.MERCURY,
    "venus": swe.VENUS,
    "mars": swe.MARS,
    "jupiter": swe.JUPITER,
    "saturn": swe.SATURN,
    "rahu": swe.TRUE_NODE,
}

_OWN = {
    "sun": {4}, "moon": {3}, "mars": {0, 7}, "mercury": {2, 5},
    "jupiter": {8, 11}, "venus": {1, 6}, "saturn": {9, 10},
}
_EXALT = {
    "sun": 0, "moon": 1, "mars": 9, "mercury": 5,
    "jupiter": 3, "venus": 11, "saturn": 6,
}
_KUJA_HOUSES = {1, 2, 4, 7, 8, 12}

SWE_FLAGS = swe.FLG_SWIEPH | swe.FLG_SIDEREAL | swe.FLG_SPEED


def local_to_julian_day(year: int, month: int, day: int, hour: int, minute: int, tz_str: str) -> float:
    dt = datetime(year, month, day, hour, minute, tzinfo=ZoneInfo(tz_str))
    utc = dt.astimezone(ZoneInfo("UTC"))
    ut_hours = utc.hour + utc.minute / 60.0 + utc.second / 3600.0 + utc.microsecond / 3.6e9
    return swe.julday(utc.year, utc.month, utc.day, ut_hours)


def _nakshatra(abs_pos: float) -> dict:
    nak_size = 360.0 / 27.0
    idx = int(abs_pos / nak_size) % 27
    pos_in_nak = abs_pos % nak_size
    pada = int(pos_in_nak / (nak_size / 4.0)) + 1
    return {"num": idx, "name": NAKSHATRA_NAMES[idx], "pada": pada, "lord": NAKSHATRA_LORDS[idx]}


def _sign_num(abs_pos: float) -> int:
    return int(abs_pos / 30.0) % 12


def _body(abs_pos: float, speed: float, asc_sign: int) -> dict:
    sign_num = _sign_num(abs_pos)
    house = ((sign_num - asc_sign) % 12) + 1
    return {
        "sign": SIGN_ABBR[sign_num],
        "sign_num": sign_num,
        "degree": round(abs_pos % 30.0, 4),
        "abs_pos": round(abs_pos % 360.0, 4),
        "house": house,
        "retrograde": bool(speed < 0),
        "nakshatra": _nakshatra(abs_pos),
    }


def compute_natal(birth: dict) -> dict:
    """Lahiri sidereal natal from Swiss Ephemeris. Whole-sign houses from true Lagna."""
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    jd = local_to_julian_day(
        birth["year"], birth["month"], birth["day"],
        birth["hour"], birth["minute"], birth["tz_str"],
    )
    cusps, ascmc = swe.houses_ex(jd, birth["lat"], birth["lng"], b"P", swe.FLG_SIDEREAL)
    asc_abs = ascmc[0] % 360.0
    asc_sign = _sign_num(asc_abs)

    planets = {}
    for key, body in SWE_BODIES.items():
        xx, _ = swe.calc_ut(jd, body, SWE_FLAGS)
        planets[key] = _body(xx[0], xx[3], asc_sign)

    # True south node is 180° from true node; speed sign matches the node pair
    # as reported by Swiss Ephemeris / kerykeion (not the classical "always Rx").
    xx_rahu, _ = swe.calc_ut(jd, swe.TRUE_NODE, SWE_FLAGS)
    planets["ketu"] = _body((xx_rahu[0] + 180.0) % 360.0, xx_rahu[3], asc_sign)

    return {
        "julian_day_ut": jd,
        "ayanamsha_lahiri": round(swe.get_ayanamsa_ut(jd), 6),
        "ascendant": {
            "sign": SIGN_ABBR[asc_sign],
            "sign_num": asc_sign,
            "degree": round(asc_abs % 30.0, 4),
            "abs_pos": round(asc_abs, 4),
        },
        "planets": planets,
        "moon_nakshatra": _nakshatra(planets["moon"]["abs_pos"]),
        "yogas": [y["name"] for y in detect_yogas_classical(planets, asc_sign)],
        "doshas": [d["name"] for d in detect_doshas_classical(planets, asc_sign)],
    }


def vimshottari_balance(moon_abs_pos: float) -> tuple[str, float]:
    nak_size = 360.0 / 27.0
    idx = int(moon_abs_pos / nak_size) % 27
    lord = NAKSHATRA_LORDS[idx]
    fraction_elapsed = (moon_abs_pos % nak_size) / nak_size
    balance = DASHA_YEARS[lord] * (1.0 - fraction_elapsed)
    return lord, balance


def vimshottari_mahadashas(moon_abs_pos: float, birth_date: date) -> list[dict]:
    """Closed-form Vimshottari mahadashas (no antardasha expansion)."""
    start_lord, balance_years = vimshottari_balance(moon_abs_pos)
    start_idx = DASHA_SEQUENCE.index(start_lord)
    current = datetime.combine(birth_date, datetime.min.time())
    out = []
    for i in range(9):
        lord = DASHA_SEQUENCE[(start_idx + i) % 9]
        years = balance_years if i == 0 else float(DASHA_YEARS[lord])
        end = current + timedelta(days=years * SIDEREAL_YEAR_DAYS)
        out.append({
            "lord": lord,
            "classical_years": DASHA_YEARS[lord],
            "balance_years": round(years, 6),
            "start": current.date().isoformat(),
            "end": end.date().isoformat(),
        })
        current = end
    return out


def _dignified(key: str, sign_num: int) -> bool:
    return sign_num in _OWN.get(key, set()) or sign_num == _EXALT.get(key, -1)


def _kendra_from(planet_sign: int, ref_sign: int) -> bool:
    return ((planet_sign - ref_sign) % 12) in {0, 3, 6, 9}


def _house_from(ref_sign: int, target_sign: int) -> int:
    return ((target_sign - ref_sign) % 12) + 1


def detect_yogas_classical(planets: dict, asc_sign_num: int) -> list[dict]:
    yogas: list[dict] = []
    mahapurusha = [
        ("mars", "Ruchaka"),
        ("mercury", "Bhadra"),
        ("jupiter", "Hamsa"),
        ("venus", "Malavya"),
        ("saturn", "Sasa"),
    ]
    for key, name in mahapurusha:
        p = planets.get(key)
        if p and _dignified(key, p["sign_num"]) and _kendra_from(p["sign_num"], asc_sign_num):
            yogas.append({"name": name, "planets": [key]})

    jup, moon = planets.get("jupiter"), planets.get("moon")
    if jup and moon and _kendra_from(jup["sign_num"], moon["sign_num"]):
        yogas.append({"name": "Gaja Kesari", "planets": ["jupiter", "moon"]})

    sun, mer = planets.get("sun"), planets.get("mercury")
    if sun and mer and sun["sign_num"] == mer["sign_num"]:
        yogas.append({"name": "Budhaditya", "planets": ["sun", "mercury"]})

    mar = planets.get("mars")
    if moon and mar and moon["sign_num"] == mar["sign_num"]:
        yogas.append({"name": "Chandra Mangal", "planets": ["moon", "mars"]})

    if moon:
        adj = {(moon["sign_num"] - 1) % 12, (moon["sign_num"] + 1) % 12}
        has_neighbor = any(
            v["sign_num"] in adj
            for k, v in planets.items()
            if k not in {"moon", "rahu", "ketu"}
        )
        if not has_neighbor:
            yogas.append({"name": "Kemadruma", "planets": ["moon"]})

    sat = planets.get("saturn")
    if sat and moon and sat["sign_num"] == moon["sign_num"]:
        yogas.append({"name": "Visha Yoga", "planets": ["saturn", "moon"]})

    return yogas


def detect_doshas_classical(planets: dict, asc_sign_num: int) -> list[dict]:
    out: list[dict] = []
    mars, moon = planets.get("mars"), planets.get("moon")
    if mars:
        from_lagna = mars.get("house") in _KUJA_HOUSES
        from_moon = moon is not None and _house_from(moon["sign_num"], mars["sign_num"]) in _KUJA_HOUSES
        if from_lagna or from_moon:
            out.append({"name": "Manglik (Kuja) Dosha", "planets": ["mars"]})

    rahu = planets.get("rahu")
    seven = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"]
    if rahu and all(p in planets for p in seven):
        rel = [((planets[p]["abs_pos"] - rahu["abs_pos"]) % 360) for p in seven]
        if all(r <= 180 for r in rel) or all(r >= 180 for r in rel):
            out.append({"name": "Kaal Sarp Dosha", "planets": ["rahu", "ketu"]})

    sun, ketu = planets.get("sun"), planets.get("ketu")
    if sun and rahu and ketu:
        ninth = [k for k in ("rahu", "ketu") if planets[k].get("house") == 9]
        sun_with_node = sun["sign_num"] in (rahu["sign_num"], ketu["sign_num"])
        if ninth or sun_with_node:
            out.append({"name": "Pitru Dosha", "planets": ["sun", "rahu", "ketu"]})

    return out
