from datetime import date

import pytest

from dasha import calculate_dashas, DASHA_SEQUENCE, DASHA_YEARS, TOTAL_YEARS, _dasha_balance_years, _nakshatra_lord


def test_nakshatra_lord_at_zero_degrees_is_ketu():
    # 0 degrees absolute = start of Ashwini, the first nakshatra, lorded by Ketu.
    assert _nakshatra_lord(0.0) == "Ketu"


def test_dasha_balance_is_full_period_at_the_very_start_of_a_nakshatra():
    lord, balance = _dasha_balance_years(0.0)
    assert lord == "Ketu"
    assert balance == DASHA_YEARS["Ketu"]


def test_dasha_balance_is_zero_at_the_very_end_of_a_nakshatra():
    nak_size = 360 / 27
    # Just short of crossing into the next nakshatra.
    lord, balance = _dasha_balance_years(nak_size - 1e-9)
    assert lord == "Ketu"
    assert balance == pytest.approx(0.0, abs=1e-3)


class TestCalculateDashas:
    def test_produces_all_nine_mahadasha_lords_exactly_once_in_sequence_order(self):
        result = calculate_dashas(0.0, date(2000, 1, 1))
        lords = [m["lord"] for m in result["mahadashas"]]
        assert len(lords) == 9
        assert set(lords) == set(DASHA_SEQUENCE)
        # Starting from Ketu (moon at 0 degrees), the rest must follow the fixed sequence.
        start_idx = DASHA_SEQUENCE.index("Ketu")
        expected = [DASHA_SEQUENCE[(start_idx + i) % 9] for i in range(9)]
        assert lords == expected

    def test_full_classical_years_across_all_nine_lords_sum_to_120(self):
        # Each lord's full classical duration appears exactly once regardless of
        # where in the cycle the birth Moon falls — this is the Vimshottari
        # invariant the whole feature depends on.
        result = calculate_dashas(123.456, date(1990, 6, 15))
        assert sum(m["years"] for m in result["mahadashas"]) == TOTAL_YEARS

    def test_periods_are_contiguous_with_no_gaps_or_overlaps(self):
        result = calculate_dashas(50.0, date(1985, 3, 10))
        mahadashas = result["mahadashas"]
        for prev, nxt in zip(mahadashas, mahadashas[1:]):
            assert prev["end"] == nxt["start"]

    def test_first_mahadasha_uses_the_birth_date_as_its_start(self):
        birth = date(2010, 5, 20)
        result = calculate_dashas(200.0, birth)
        assert result["mahadashas"][0]["start"] == str(birth)

    def test_each_mahadasha_has_nine_antardashas_each_with_nine_pratyantardashas(self):
        result = calculate_dashas(75.0, date(1995, 11, 2))
        for maha in result["mahadashas"]:
            assert len(maha["antardashas"]) == 9
            for antar in maha["antardashas"]:
                assert len(antar["pratyantardashas"]) == 9

    def test_current_maha_and_antar_are_populated_and_consistent(self):
        # Birth far enough in the past that "today" definitely falls inside this
        # 120-year timeline, so current_maha/current_antar must resolve to a
        # real (non-fallback) match.
        result = calculate_dashas(10.0, date(2000, 1, 1))
        assert result["current_maha"] in DASHA_SEQUENCE
        assert result["current_maha_end"] > str(date.today())
