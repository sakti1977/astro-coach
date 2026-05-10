import warnings
warnings.filterwarnings("ignore")

from kerykeion import AstrologicalSubject
from datetime import datetime, date
import math

HOUSE_MAP = {
    "First_House": 1, "Second_House": 2, "Third_House": 3,
    "Fourth_House": 4, "Fifth_House": 5, "Sixth_House": 6,
    "Seventh_House": 7, "Eighth_House": 8, "Ninth_House": 9,
    "Tenth_House": 10, "Eleventh_House": 11, "Twelfth_House": 12,
}

SIGN_NAMES = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]

NAKSHATRA_NAMES = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashirsha", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishtha",
    "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
]

NAKSHATRA_LORDS = [
    "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu",
    "Jupiter", "Saturn", "Mercury",
] * 3  # 27 nakshatras = 3 cycles of 9


def _varga_sign(abs_pos: float, varga: int) -> int:
    """Return varga sign number (0-indexed) from absolute sidereal position."""
    sign_num = int(abs_pos / 30) % 12
    degree_in_sign = abs_pos % 30
    pada = int(degree_in_sign * varga / 30)  # 0 … varga-1

    if varga == 9:  # Navamsa D9
        # Fire(0,4,8)→Aries(0), Earth(1,5,9)→Cap(9), Air(2,6,10)→Lib(6), Water(3,7,11)→Can(3)
        starts = {0:0, 4:0, 8:0, 1:9, 5:9, 9:9, 2:6, 6:6, 10:6, 3:3, 7:3, 11:3}
        start = starts[sign_num]
    elif varga == 10:  # Dashamsha D10
        # Odd signs (0-indexed: 0,2,4,6,8,10) start from same sign; even from 9th
        start = sign_num if sign_num % 2 == 0 else (sign_num + 8) % 12
    elif varga == 7:   # Saptamsha D7
        # Odd signs start from same; even from 7th
        start = sign_num if sign_num % 2 == 0 else (sign_num + 6) % 12
    else:
        start = 0

    return (start + pada) % 12


def _nakshatra(abs_pos: float) -> dict:
    nak_size = 360 / 27
    idx = int(abs_pos / nak_size) % 27
    pos_in_nak = abs_pos % nak_size
    pada = int(pos_in_nak / (nak_size / 4)) + 1
    return {"num": idx, "name": NAKSHATRA_NAMES[idx], "pada": pada, "lord": NAKSHATRA_LORDS[idx]}


def _planet_data(p, subject) -> dict:
    house_num = HOUSE_MAP.get(str(p.house), 0)
    return {
        "sign": p.sign,
        "sign_num": p.sign_num,
        "degree": round(p.position, 4),
        "abs_pos": round(p.abs_pos, 4),
        "house": house_num,
        "retrograde": bool(p.retrograde),
        "nakshatra": _nakshatra(p.abs_pos),
        "d9_sign_num":  _varga_sign(p.abs_pos, 9),
        "d10_sign_num": _varga_sign(p.abs_pos, 10),
        "d7_sign_num":  _varga_sign(p.abs_pos, 7),
    }


def calculate_chart(
    name: str, year: int, month: int, day: int,
    hour: int, minute: int, lat: float, lng: float, tz_str: str,
) -> dict:
    s = AstrologicalSubject(
        name, year, month, day, hour, minute,
        lat=lat, lng=lng, tz_str=tz_str,
        zodiac_type="Sidereal",
        sidereal_mode="LAHIRI",
        houses_system_identifier="W",
        online=False,
    )

    planets = {
        "sun":     _planet_data(s.sun, s),
        "moon":    _planet_data(s.moon, s),
        "mars":    _planet_data(s.mars, s),
        "mercury": _planet_data(s.mercury, s),
        "jupiter": _planet_data(s.jupiter, s),
        "venus":   _planet_data(s.venus, s),
        "saturn":  _planet_data(s.saturn, s),
        "rahu":    _planet_data(s.true_node, s),
        "ketu":    _planet_data(s.true_south_node, s),
    }

    asc = s.first_house
    moon_nak = _nakshatra(s.moon.abs_pos)

    return {
        "ascendant": {
            "sign": asc.sign,
            "sign_num": asc.sign_num,
            "degree": round(asc.position, 4),
            "abs_pos": round(asc.abs_pos, 4),
            "d9_sign_num":  _varga_sign(asc.abs_pos, 9),
            "d10_sign_num": _varga_sign(asc.abs_pos, 10),
            "d7_sign_num":  _varga_sign(asc.abs_pos, 7),
        },
        "planets": planets,
        "moon_nakshatra": moon_nak,
        "birth_data": {
            "name": name, "year": year, "month": month, "day": day,
            "hour": hour, "minute": minute, "lat": lat, "lng": lng, "tz_str": tz_str,
        },
    }
