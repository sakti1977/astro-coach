from datetime import datetime, timedelta, date

# Vimshottari dasha sequence and durations (years)
DASHA_SEQUENCE = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]
DASHA_YEARS = {"Ketu": 7, "Venus": 20, "Sun": 6, "Moon": 10, "Mars": 7,
               "Rahu": 18, "Jupiter": 16, "Saturn": 19, "Mercury": 17}
TOTAL_YEARS = 120

# Sidereal year (mean), not the Gregorian calendar-average 365.25 — this app's
# chart/transit/dasha math is sidereal (Lahiri) throughout; the day-length
# used to turn dasha years into calendar days should match.
YEAR_DAYS = 365.25636

NAKSHATRA_LORDS = [
    "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu",
    "Jupiter", "Saturn", "Mercury",
] * 3


class DashaConsistencyError(Exception):
    """Raised when computed dasha periods don't internally reconcile (a
    sub-period's days don't sum to its parent's span, or periods gap/overlap).
    This app previously shipped a silent date-truncation bug that produced
    exactly this kind of drift — inaccurate dasha timing directly undermines
    user trust, so a recurrence must fail loudly (500) rather than silently
    serve wrong dates. See _verify_consistency, called at the end of
    calculate_dashas."""


def _nakshatra_lord(moon_abs_pos: float) -> str:
    nak_size = 360 / 27
    idx = int(moon_abs_pos / nak_size) % 27
    return NAKSHATRA_LORDS[idx]


def _dasha_balance_years(moon_abs_pos: float) -> tuple[str, float]:
    """Returns (starting_dasha_lord, balance_years_remaining)."""
    nak_size = 360 / 27
    idx = int(moon_abs_pos / nak_size) % 27
    lord = NAKSHATRA_LORDS[idx]
    pos_in_nak = moon_abs_pos % nak_size
    fraction_elapsed = pos_in_nak / nak_size
    balance = DASHA_YEARS[lord] * (1 - fraction_elapsed)
    return lord, balance


def _years_to_days(years: float) -> float:
    return years * YEAR_DAYS


def calculate_dashas(moon_abs_pos: float, birth_date: date) -> dict:
    start_lord, balance_years = _dasha_balance_years(moon_abs_pos)
    start_idx = DASHA_SEQUENCE.index(start_lord)

    mahadashas = []
    # HARNESS-01 fix: accumulate in full `datetime` precision (fractional
    # days) throughout, and only format to a day-resolution string at output
    # time. Previously `current_date` was a plain `date`, and `date +
    # timedelta(days=x.y)` silently DROPS the fractional-day remainder on
    # every addition — `date` has no sub-day resolution to hold it. With 9
    # mahadashas x 9 antardashas x 9 pratyantardashas = 729 chained
    # additions, that per-step truncation compounded into multi-day drift
    # (verified: 3-5 days per mahadasha's antardasha sum vs. its own span) —
    # this is what was reported as "pratyantardasha not accurate." `datetime`
    # arithmetic preserves the fractional remainder exactly at every step;
    # only the final display rounds to a day, so nothing compounds.
    current_date = datetime.combine(birth_date, datetime.min.time())

    # First dasha (partial)
    end_date = current_date + timedelta(days=_years_to_days(balance_years))
    antars = _antardasha(start_lord, current_date, balance_years)
    mahadashas.append({
        "lord": start_lord,
        "years": DASHA_YEARS[start_lord],
        "balance_years": round(balance_years, 4),
        "start": current_date.date().isoformat(),
        "end": end_date.date().isoformat(),
        "antardashas": antars,
    })
    current_date = end_date

    # Remaining dashas (full)
    for i in range(1, 9):
        lord = DASHA_SEQUENCE[(start_idx + i) % 9]
        years = DASHA_YEARS[lord]
        end_date = current_date + timedelta(days=_years_to_days(years))
        antars = _antardasha(lord, current_date, years)
        mahadashas.append({
            "lord": lord,
            "years": years,
            "balance_years": years,
            "start": current_date.date().isoformat(),
            "end": end_date.date().isoformat(),
            "antardashas": antars,
        })
        current_date = end_date

    _verify_consistency(mahadashas)

    today = date.today()
    current_maha = next((d for d in mahadashas if d["start"] <= str(today) <= d["end"]), mahadashas[0])
    current_antar = next(
        (a for a in current_maha["antardashas"] if a["start"] <= str(today) <= a["end"]),
        current_maha["antardashas"][0] if current_maha["antardashas"] else None
    )

    return {
        "mahadashas": mahadashas,
        "current_maha": current_maha["lord"],
        "current_antar": current_antar["lord"] if current_antar else "",
        "current_maha_end": current_maha["end"],
        "current_antar_end": current_antar["end"] if current_antar else "",
    }


def _verify_consistency(mahadashas: list) -> None:
    """The runtime harness: every sub-period's days must sum EXACTLY to its
    parent's own span, and periods at each level must be contiguous (no
    gaps/overlaps). Raises DashaConsistencyError instead of returning
    silently-wrong dates if this is ever violated."""
    for m in mahadashas:
        _verify_span_matches_children(m["lord"], m["start"], m["end"], m["antardashas"], "Mahadasha", "antardashas")
        _verify_contiguous(m["lord"], m["antardashas"], "antardashas")
        for a in m["antardashas"]:
            label = f"{m['lord']}/{a['lord']}"
            _verify_span_matches_children(label, a["start"], a["end"], a["pratyantardashas"], "Antardasha", "pratyantardashas")
            _verify_contiguous(label, a["pratyantardashas"], "pratyantardashas")


def _verify_span_matches_children(label: str, start: str, end: str, children: list, level_name: str, children_name: str) -> None:
    span_days = (date.fromisoformat(end) - date.fromisoformat(start)).days
    children_days = sum(
        (date.fromisoformat(c["end"]) - date.fromisoformat(c["start"])).days for c in children
    )
    if span_days != children_days:
        raise DashaConsistencyError(
            f"{label} {level_name} spans {span_days} days but its {children_name} sum to "
            f"{children_days} days (drift {span_days - children_days:+d}) — dasha date arithmetic "
            f"is inconsistent, refusing to serve inaccurate timing."
        )


def _verify_contiguous(label: str, periods: list, children_name: str) -> None:
    for prev, nxt in zip(periods, periods[1:]):
        if prev["end"] != nxt["start"]:
            raise DashaConsistencyError(
                f"{label}: gap/overlap in {children_name} between {prev['lord']} (ends {prev['end']}) "
                f"and {nxt['lord']} (starts {nxt['start']}) — dasha timeline is not contiguous, "
                f"refusing to serve inaccurate timing."
            )


def _antardasha(maha_lord: str, maha_start: datetime, maha_years: float) -> list:
    """Compute all antardashas within a mahadasha."""
    maha_idx = DASHA_SEQUENCE.index(maha_lord)
    antars = []
    current = maha_start

    for i in range(9):
        antar_lord = DASHA_SEQUENCE[(maha_idx + i) % 9]
        antar_years = (DASHA_YEARS[antar_lord] / TOTAL_YEARS) * maha_years
        end = current + timedelta(days=_years_to_days(antar_years))

        # Calculate pratyantardashas (third level)
        pratyantars = _pratyantardasha(antar_lord, current, antar_years)

        antars.append({
            "lord": antar_lord,
            "years": round(antar_years, 4),
            "start": current.date().isoformat(),
            "end": end.date().isoformat(),
            "pratyantardashas": pratyantars,
        })
        current = end

    return antars


def _pratyantardasha(antar_lord: str, antar_start: datetime, antar_years: float) -> list:
    """Compute all pratyantardashas (third level) within an antardasha."""
    antar_idx = DASHA_SEQUENCE.index(antar_lord)
    pratyantars = []
    current = antar_start

    for i in range(9):
        pratyantar_lord = DASHA_SEQUENCE[(antar_idx + i) % 9]
        pratyantar_years = (DASHA_YEARS[pratyantar_lord] / TOTAL_YEARS) * antar_years
        end = current + timedelta(days=_years_to_days(pratyantar_years))
        pratyantars.append({
            "lord": pratyantar_lord,
            "years": round(pratyantar_years, 6),
            "start": current.date().isoformat(),
            "end": end.date().isoformat(),
        })
        current = end

    return pratyantars
