import dataclasses
from datetime import datetime

from kaalavidya import Panchanga

# Static practical framing per window — the product's coaching identity never
# hands the user a bare "auspicious/inauspicious" verdict. Every window pairs
# the classical reading with something actually actionable.
AUSPICIOUS_NOTES = {
    "Brahma Muhurta": "Traditionally the best window for meditation, study, or deep focused work — mind is quiet before the day's noise starts.",
    "Abhijit Muhurta": "The midday power window — well suited to decisive, high-stakes actions: signing something, a hard conversation, a firm decision.",
    "Amrit Kalam": "A gentle, nourishing window — good for rest, healing conversations, or anything that benefits from a calmer register.",
    "Vijaya": "Associated with overcoming obstacles — a good window to push through something you've been stuck on.",
    "Godhuli": "The dusk transition window — traditionally used for closing rituals and winding the day down deliberately.",
}
INAUSPICIOUS_NOTES = {
    "Rahu Kala": "Classically avoided for starting new ventures. If you must act during this window, favor routine tasks over new beginnings.",
    "Yamagandam": "Traditionally avoided for auspicious starts — better suited to administrative or low-stakes tasks.",
    "Gulika Kala": "Considered a heavier window — better for finishing existing work than starting something new.",
    "Durmuhurta": "A minor inauspicious window — worth avoiding for major decisions if your schedule has flexibility.",
    "Varjyam": "Traditionally avoided for important beginnings — shift the timing slightly if you can.",
}


def _jsonable(value):
    """Recursively convert kaalavidya dataclasses/datetimes into plain JSON-safe values."""
    if isinstance(value, datetime):
        return value.isoformat()
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return {k: _jsonable(v) for k, v in dataclasses.asdict(value).items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    return value


def _window(period, notes: dict) -> dict | None:
    """Normalize a single TimePeriod (or the first of a list of them) into
    {name, starts_at, ends_at, note}, attaching the practical framing note."""
    if period is None:
        return None
    item = period[0] if isinstance(period, list) else period
    if item is None:
        return None
    data = _jsonable(item)
    # kaalavidya sometimes suffixes the name with an ordinal, e.g.
    # "Durmuhurta (4/15)" for one of several Durmuhurta windows in a day —
    # match on the part before that suffix so the note lookup doesn't
    # silently miss.
    base_name = data.get("name", "").split(" (")[0]
    data["note"] = notes.get(base_name, "")
    return data


def calculate_muhurta(year: int, month: int, day: int, lat: float, lng: float, tz_str: str, city: str = "") -> dict:
    """Panchang + auspicious/inauspicious timing windows for a given date and place."""
    p = Panchanga(
        year=year, month=month, day=day,
        latitude=lat, longitude=lng,
        timezone=tz_str, city=city or "Unknown", lang="en",
    )
    r = p.compute()

    auspicious = [
        w for w in (
            _window(r.brahma_muhurta, AUSPICIOUS_NOTES),
            _window(r.abhijit_muhurta, AUSPICIOUS_NOTES),
            _window(r.amrit_kalam, AUSPICIOUS_NOTES),
            _window(r.vijaya_muhurta, AUSPICIOUS_NOTES),
            _window(r.godhuli_muhurta, AUSPICIOUS_NOTES),
        ) if w is not None
    ]

    inauspicious = [
        w for w in (
            _window(r.rahu_kala, INAUSPICIOUS_NOTES),
            _window(r.yamagandam, INAUSPICIOUS_NOTES),
            _window(r.gulika_kala, INAUSPICIOUS_NOTES),
            _window(r.durmuhurta, INAUSPICIOUS_NOTES),
            _window(r.varjyam, INAUSPICIOUS_NOTES),
        ) if w is not None
    ]

    return {
        "date": f"{year:04d}-{month:02d}-{day:02d}",
        "vara": r.vara,
        "vara_lord": r.vara_lord,
        "sunrise": r.sun.sunrise.isoformat() if getattr(r.sun, "sunrise", None) else None,
        "sunset": r.sun.sunset.isoformat() if getattr(r.sun, "sunset", None) else None,
        "tithi": _jsonable(r.tithi),
        "nakshatra": _jsonable(r.nakshatra),
        "yoga": _jsonable(r.yoga),
        "karana": _jsonable(r.karana),
        "auspicious": auspicious,
        "inauspicious": inauspicious,
    }
