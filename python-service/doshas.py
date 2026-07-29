"""Detect classical Vedic doshas (afflictions) — the combinations users of a
remedial coaching app ask about first (Manglik, Kaal Sarp, Pitru, Sade Sati).

Kept separate from yogas.py (auspicious/neutral combinations) because doshas
are specifically the target of remedial work — this module's output feeds
directly into remedies.py.

Where a dosha's classical definition varies by school (Pitru Dosha especially
has several competing traditions), the `description` field says so explicitly
rather than asserting one lineage's rule as universal fact.
"""

_KUJA_HOUSES = {1, 2, 4, 7, 8, 12}


def _house_from(ref_sign_num: int, target_sign_num: int) -> int:
    """1-12 house of target_sign_num counted from ref_sign_num (whole-sign)."""
    return ((target_sign_num - ref_sign_num) % 12) + 1


def _manglik_dosha(planets: dict, asc_sign_num: int) -> dict | None:
    mars = planets.get("mars")
    moon = planets.get("moon")
    if not mars:
        return None

    from_lagna = mars["house"] in _KUJA_HOUSES
    from_moon = moon is not None and _house_from(moon["sign_num"], mars["sign_num"]) in _KUJA_HOUSES

    if not (from_lagna or from_moon):
        return None

    refs = []
    if from_lagna:
        refs.append(f"H{mars['house']} from Lagna")
    if from_moon:
        refs.append(f"H{_house_from(moon['sign_num'], mars['sign_num'])} from Moon")

    severity = "strong" if (from_lagna and from_moon) else "moderate"

    return {
        "name": "Manglik (Kuja) Dosha",
        "planets": ["mars"],
        "houses_involved": refs,
        "description": (
            f"Mars in a Kuja Dosha house ({', '.join(refs)}) — classically read as intensity, "
            "friction, or delay in marriage/partnership timing, and a tendency toward conflict "
            "in close relationships until consciously channeled. Traditionally weighed most "
            "heavily in marriage compatibility (Kundali matching); its effect is commonly "
            "considered reduced or cancelled when both partners share it, or when Mars is "
            "otherwise well-dignified — this detection does not evaluate those cancellation "
            "rules, only the raw placement."
        ),
        "strength": severity,
    }


def _kaal_sarp_dosha(planets: dict) -> dict | None:
    rahu = planets.get("rahu")
    if not rahu:
        return None

    seven = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"]
    positions = [planets[p]["abs_pos"] for p in seven if p in planets]
    if len(positions) < 7:
        return None

    rel = [((pos - rahu["abs_pos"]) % 360) for pos in positions]
    all_one_side = all(r <= 180 for r in rel)
    all_other_side = all(r >= 180 for r in rel)

    if not (all_one_side or all_other_side):
        return None

    return {
        "name": "Kaal Sarp Dosha",
        "planets": ["rahu", "ketu"],
        "houses_involved": [],
        "description": (
            "All seven classical planets fall within one hemisphere of the Rahu-Ketu axis — "
            "classically read as a life that feels shadowed by unseen obstacles or a persistent "
            "sense of being 'held back' until a specific turning point, often tied to the Rahu "
            "Mahadasha or a major Rahu/Ketu transit. Traditionally softens significantly after "
            "roughly age 42, or once consciously worked with rather than feared."
        ),
        "strength": "challenging",
    }


def _pitru_dosha(planets: dict, asc_sign_num: int) -> dict | None:
    sun = planets.get("sun")
    rahu = planets.get("rahu")
    ketu = planets.get("ketu")
    if not sun or not rahu or not ketu:
        return None

    ninth_house_occupants = [
        key for key in ("rahu", "ketu")
        if planets[key]["house"] == 9
    ]
    sun_with_node = sun["sign_num"] in (rahu["sign_num"], ketu["sign_num"])

    if not (ninth_house_occupants or sun_with_node):
        return None

    reasons = []
    if ninth_house_occupants:
        reasons.append(f"{'/'.join(p.title() for p in ninth_house_occupants)} in H9 (house of father, ancestry, dharma)")
    if sun_with_node:
        reasons.append("Sun conjunct a lunar node")

    return {
        "name": "Pitru Dosha",
        "planets": ["sun", "rahu", "ketu"],
        "houses_involved": ["H9"] if ninth_house_occupants else [],
        "description": (
            f"{'; '.join(reasons)} — one common (not universally agreed) reading of ancestral-karma "
            "affliction: unresolved patterns or obligations inherited from the paternal line, "
            "sometimes felt as recurring blocks in the same life area across generations. "
            "Different Jyotish schools define this dosha differently — treat this as one lens, "
            "not a definitive diagnosis."
        ),
        "strength": "moderate",
    }


def detect_doshas(planets: dict, asc_sign_num: int) -> list[dict]:
    """Returns list of dosha dicts (only those actually present in this chart)."""
    candidates = [
        _manglik_dosha(planets, asc_sign_num),
        _kaal_sarp_dosha(planets),
        _pitru_dosha(planets, asc_sign_num),
    ]
    return [d for d in candidates if d is not None]
