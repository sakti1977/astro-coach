import warnings
warnings.filterwarnings("ignore")

from kerykeion import AstrologicalSubject
from datetime import datetime, timezone
import pytz

from chart import _nakshatra, HOUSE_MAP, _planet_data


def calculate_transits(natal_asc_sign_num: int, tz_str: str = "UTC") -> dict:
    """Calculate current planetary positions (Gochar) relative to natal ascendant."""
    now = datetime.now(pytz.timezone(tz_str))

    s = AstrologicalSubject(
        "Transit", now.year, now.month, now.day, now.hour, now.minute,
        lat=0.0, lng=0.0, tz_str="UTC",
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

    return {"planets": planets, "calculated_at": now.isoformat()}
