"""Detect classical Vedic yogas from a Whole-Sign natal chart (Lahiri ayanamsha)."""

# Own signs per planet (sign_num 0-indexed: Aries=0 … Pisces=11)
_OWN: dict[str, set[int]] = {
    "sun":     {4},        # Leo
    "moon":    {3},        # Cancer
    "mars":    {0, 7},     # Aries, Scorpio
    "mercury": {2, 5},     # Gemini, Virgo
    "jupiter": {8, 11},    # Sagittarius, Pisces
    "venus":   {1, 6},     # Taurus, Libra
    "saturn":  {9, 10},    # Capricorn, Aquarius
}

# Exaltation signs per planet
_EXALT: dict[str, int] = {
    "sun":     0,   # Aries
    "moon":    1,   # Taurus
    "mars":    9,   # Capricorn
    "mercury": 5,   # Virgo
    "jupiter": 3,   # Cancer
    "venus":   11,  # Pisces
    "saturn":  6,   # Libra
}


def _dignified(key: str, sign_num: int) -> bool:
    return sign_num in _OWN.get(key, set()) or sign_num == _EXALT.get(key, -1)


def _kendra_from(planet_sign: int, ref_sign: int) -> bool:
    """True if planet_sign is in a Kendra (H1, 4, 7, 10) relative to ref_sign."""
    return ((planet_sign - ref_sign) % 12) in {0, 3, 6, 9}


def detect_yogas(planets: dict, asc_sign_num: int) -> list[dict]:
    """
    Returns list of yoga dicts:
      {"name": str, "planets": [str, ...], "description": str,
       "strength": "strong" | "moderate" | "challenging"}
    """
    yogas: list[dict] = []

    # ── Pancha Mahapurusha Yogas (5 great-person yogas) ──────────────────────
    for planet_key, yoga_name, description in [
        ("mars",    "Ruchaka",
         "Exceptional willpower, courage, and executive leadership. Mars amplifies ambition and physical vitality."),
        ("mercury", "Bhadra",
         "Mastery of communication, intellect, and commerce. Sharp analytical and oratorical gifts."),
        ("jupiter", "Hamsa",
         "Deep wisdom, spiritual insight, and natural authority. A calling toward teaching or guiding others."),
        ("venus",   "Malavya",
         "Charisma, aesthetic refinement, and magnetic relationships. Prosperity and beauty flow naturally."),
        ("saturn",  "Sasa",
         "Discipline, endurance, and mastery built through sustained effort. Durable achievement over time."),
    ]:
        p = planets.get(planet_key)
        if p and _dignified(planet_key, p["sign_num"]) and _kendra_from(p["sign_num"], asc_sign_num):
            yogas.append({
                "name": yoga_name,
                "planets": [planet_key],
                "description": description,
                "strength": "strong",
            })

    # ── Gaja Kesari ────────────────────────────────────────────────────────────
    jup  = planets.get("jupiter")
    moon = planets.get("moon")
    if jup and moon and _kendra_from(jup["sign_num"], moon["sign_num"]):
        yogas.append({
            "name": "Gaja Kesari",
            "planets": ["jupiter", "moon"],
            "description": "Jupiter in Kendra from Moon — wisdom, public reputation, and long-term prosperity. "
                           "Often found in respected advisors and community leaders.",
            "strength": "moderate",
        })

    # ── Budhaditya (Sun + Mercury same sign) ──────────────────────────────────
    sun = planets.get("sun")
    mer = planets.get("mercury")
    if sun and mer and sun["sign_num"] == mer["sign_num"]:
        yogas.append({
            "name": "Budhaditya",
            "planets": ["sun", "mercury"],
            "description": "Sun and Mercury conjunct — focused intellect fused with personal identity. "
                           "Communication and self-expression are natural strengths.",
            "strength": "moderate",
        })

    # ── Chandra Mangal (Moon + Mars same sign) ────────────────────────────────
    mar = planets.get("mars")
    if moon and mar and moon["sign_num"] == mar["sign_num"]:
        yogas.append({
            "name": "Chandra Mangal",
            "planets": ["moon", "mars"],
            "description": "Moon and Mars conjunct — high emotional intensity, entrepreneurial drive, and courage. "
                           "Requires conscious management of reactivity.",
            "strength": "moderate",
        })

    # ── Kemadruma (Moon isolated — no adjacent planets) ───────────────────────
    if moon:
        adj = {(moon["sign_num"] - 1) % 12, (moon["sign_num"] + 1) % 12}
        has_neighbor = any(
            v["sign_num"] in adj
            for k, v in planets.items()
            if k not in {"moon", "rahu", "ketu"}
        )
        if not has_neighbor:
            yogas.append({
                "name": "Kemadruma",
                "planets": ["moon"],
                "description": "Moon stands alone with no adjacent planets — a path walked independently. "
                               "Strong self-reliance; benefit from deliberately building community and routine.",
                "strength": "challenging",
            })

    # ── Visha Yoga (Saturn + Moon same sign) ─────────────────────────────────
    sat = planets.get("saturn")
    if sat and moon and sat["sign_num"] == moon["sign_num"]:
        yogas.append({
            "name": "Visha Yoga",
            "planets": ["saturn", "moon"],
            "description": "Saturn conjunct Moon — emotional maturity forged through hardship. "
                           "A serious, introspective nature with deep endurance and capacity for long-term discipline.",
            "strength": "challenging",
        })

    return yogas
