from datetime import datetime, timedelta, date
import math

# Vimshottari dasha sequence and durations (years)
DASHA_SEQUENCE = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]
DASHA_YEARS = {"Ketu": 7, "Venus": 20, "Sun": 6, "Moon": 10, "Mars": 7,
               "Rahu": 18, "Jupiter": 16, "Saturn": 19, "Mercury": 17}
TOTAL_YEARS = 120

NAKSHATRA_LORDS = [
    "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu",
    "Jupiter", "Saturn", "Mercury",
] * 3


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


def _years_to_days(years: float) -> int:
    return int(years * 365.25)


def calculate_dashas(moon_abs_pos: float, birth_date: date) -> dict:
    start_lord, balance_years = _dasha_balance_years(moon_abs_pos)
    start_idx = DASHA_SEQUENCE.index(start_lord)

    mahadashas = []
    current_date = birth_date

    # First dasha (partial)
    end_date = current_date + timedelta(days=_years_to_days(balance_years))
    antars = _antardasha(start_lord, current_date, balance_years)
    mahadashas.append({
        "lord": start_lord,
        "years": DASHA_YEARS[start_lord],
        "balance_years": round(balance_years, 4),
        "start": str(current_date),
        "end": str(end_date),
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
            "start": str(current_date),
            "end": str(end_date),
            "antardashas": antars,
        })
        current_date = end_date

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


def _antardasha(maha_lord: str, maha_start: date, maha_years: float) -> list:
    """Compute all antardashas within a mahadasha."""
    maha_idx = DASHA_SEQUENCE.index(maha_lord)
    antars = []
    current = maha_start

    for i in range(9):
        antar_lord = DASHA_SEQUENCE[(maha_idx + i) % 9]
        antar_years = (DASHA_YEARS[antar_lord] / TOTAL_YEARS) * maha_years
        end = current + timedelta(days=_years_to_days(antar_years))
        antars.append({
            "lord": antar_lord,
            "years": round(antar_years, 4),
            "start": str(current),
            "end": str(end),
        })
        current = end

    return antars
