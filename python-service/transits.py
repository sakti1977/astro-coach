import warnings
warnings.filterwarnings("ignore")

from kerykeion import AstrologicalSubject
from datetime import datetime, timezone
import pytz

from chart import _nakshatra, HOUSE_MAP, _planet_data
from remedies import attach_remedies


def _detect_sade_sati(natal_moon_sign_num: int, transit_saturn_sign_num: int) -> dict | None:
    """Saturn transiting the 12th, 1st, or 2nd sign from natal Moon (whole-sign) —
    the classical 7.5-year Sade Sati cycle. Single source of truth for this
    detection; the coach system prompt reads the result rather than recomputing it."""
    dist = ((transit_saturn_sign_num - natal_moon_sign_num) % 12) + 1
    if dist not in (12, 1, 2):
        return None
    phase = {12: "first", 1: "peak", 2: "final"}[dist]
    sade_sati = {
        "name": "Sade Sati",
        "phase": phase,
        "house_from_natal_moon": dist,
        "planets": ["saturn"],
        "strength": "moderate",
        "description": (
            f"Saturn transiting house {dist} from natal Moon ({phase} phase of the 7.5-year cycle) — "
            "a period of pressure, restructuring, and accelerated maturity. Classically read as "
            "hardest when resisted, and as a period that builds durable discipline when met "
            "consciously rather than feared."
        ),
    }
    return attach_remedies([sade_sati], include_traditional=True)[0]


def calculate_transits(natal_asc_sign_num: int, tz_str: str = "UTC", natal_moon_sign_num: int | None = None) -> dict:
    """Calculate current planetary positions (Gochar) relative to natal ascendant."""
    now = datetime.now(pytz.timezone(tz_str))

    # BUGFIX: `now` holds wall-clock hour/minute in `tz_str` (e.g. Asia/Kolkata).
    # Kerykeion interprets the (year, month, day, hour, minute) tuple as local time
    # IN WHATEVER tz_str IS PASSED TO IT and converts to UTC internally — it must
    # receive the same tz_str the wall-clock numbers were drawn from. Previously
    # this passed tz_str="UTC" while feeding it local wall-clock numbers, silently
    # mislabeling e.g. IST (UTC+5:30) time as UTC and shifting every transiting
    # planet (and Sade Sati detection) by up to ~5.5 hours.
    s = AstrologicalSubject(
        "Transit", now.year, now.month, now.day, now.hour, now.minute,
        lat=0.0, lng=0.0, tz_str=tz_str,
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

    # Compute transit house relative to natal ascendant
    for key, p in planets.items():
        transit_sign = p["sign_num"]
        house_from_lagna = ((transit_sign - natal_asc_sign_num) % 12) + 1
        p["house_from_natal_lagna"] = house_from_lagna

    sade_sati = (
        _detect_sade_sati(natal_moon_sign_num, planets["saturn"]["sign_num"])
        if natal_moon_sign_num is not None
        else None
    )

    return {"planets": planets, "calculated_at": now.isoformat(), "sade_sati": sade_sati}
