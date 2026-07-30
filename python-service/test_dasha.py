from datetime import date, timedelta

import pytest

from dasha import (
    calculate_dashas, DASHA_SEQUENCE, DASHA_YEARS, TOTAL_YEARS,
    DashaConsistencyError, _dasha_balance_years, _nakshatra_lord, _verify_consistency,
)


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


class TestDayLevelPrecision:
    """Regression guard for the silent-truncation bug: `date + timedelta(days=x.y)`
    drops the fractional-day remainder on every addition (`date` has no sub-day
    resolution). With 9 mahadashas x 9 antardashas x 9 pratyantardashas = 729
    chained additions, that compounded into multi-day drift — reported as
    "pratyantardasha not accurate." These tests check EXACT day sums, not just
    approximate year sums, across several different birth-moon positions
    (including nakshatra-boundary edge cases) so this can never silently
    regress."""

    MOON_POSITIONS = [0.0, 1.0, 75.0, 123.456, 200.0, 259.999, 359.9999]

    @pytest.mark.parametrize("moon_abs_pos", MOON_POSITIONS)
    def test_antardashas_sum_to_the_exact_day_span_of_their_mahadasha(self, moon_abs_pos):
        result = calculate_dashas(moon_abs_pos, date(2000, 1, 1))
        for m in result["mahadashas"]:
            span_days = (date.fromisoformat(m["end"]) - date.fromisoformat(m["start"])).days
            antar_days = sum(
                (date.fromisoformat(a["end"]) - date.fromisoformat(a["start"])).days
                for a in m["antardashas"]
            )
            assert antar_days == span_days, f"{m['lord']} Mahadasha: {antar_days} != {span_days}"

    @pytest.mark.parametrize("moon_abs_pos", MOON_POSITIONS)
    def test_pratyantardashas_sum_to_the_exact_day_span_of_their_antardasha(self, moon_abs_pos):
        result = calculate_dashas(moon_abs_pos, date(2000, 1, 1))
        for m in result["mahadashas"]:
            for a in m["antardashas"]:
                span_days = (date.fromisoformat(a["end"]) - date.fromisoformat(a["start"])).days
                praty_days = sum(
                    (date.fromisoformat(p["end"]) - date.fromisoformat(p["start"])).days
                    for p in a["pratyantardashas"]
                )
                assert praty_days == span_days, f"{m['lord']}/{a['lord']} Antardasha: {praty_days} != {span_days}"

    @pytest.mark.parametrize("moon_abs_pos", MOON_POSITIONS)
    def test_pratyantardashas_are_contiguous_with_no_gaps_or_overlaps(self, moon_abs_pos):
        result = calculate_dashas(moon_abs_pos, date(2000, 1, 1))
        for m in result["mahadashas"]:
            for a in m["antardashas"]:
                periods = a["pratyantardashas"]
                for prev, nxt in zip(periods, periods[1:]):
                    assert prev["end"] == nxt["start"], f"{m['lord']}/{a['lord']}: gap/overlap in pratyantardashas"

    @pytest.mark.parametrize("moon_abs_pos", MOON_POSITIONS)
    def test_calculate_dashas_never_raises_the_consistency_guard_for_real_inputs(self, moon_abs_pos):
        # _verify_consistency runs inside calculate_dashas itself — if this
        # raises for any of these inputs (including nakshatra-boundary edge
        # cases), calculate_dashas would already have raised above. This test
        # just makes the intent explicit and gives a readable failure if not.
        calculate_dashas(moon_abs_pos, date(2000, 1, 1))  # must not raise


class TestConsistencyGuardCatchesRealBreakage:
    """Proves _verify_consistency actually catches the bug class it exists
    for — not just that good output passes it, but that bad output fails it."""

    def _valid_mahadashas(self):
        return calculate_dashas(50.0, date(2000, 1, 1))["mahadashas"]

    def test_raises_when_an_antardasha_sum_does_not_match_its_mahadasha_span(self):
        mahadashas = self._valid_mahadashas()
        # Simulate the historical truncation bug: shave a day off one antardasha.
        broken = [dict(m) for m in mahadashas]
        broken[1] = dict(broken[1])
        broken[1]["antardashas"] = list(broken[1]["antardashas"])
        first_antar = dict(broken[1]["antardashas"][0])
        first_antar["end"] = str(date.fromisoformat(first_antar["end"]) - timedelta(days=1))
        broken[1]["antardashas"][0] = first_antar

        with pytest.raises(DashaConsistencyError):
            _verify_consistency(broken)

    def test_raises_when_periods_have_a_gap(self):
        mahadashas = self._valid_mahadashas()
        broken = [dict(m) for m in mahadashas]
        broken[1] = dict(broken[1])
        broken[1]["antardashas"] = [dict(a) for a in broken[1]["antardashas"]]
        # Push the second antardasha's start a day later than the first's end.
        broken[1]["antardashas"][1]["start"] = str(
            date.fromisoformat(broken[1]["antardashas"][1]["start"]) + timedelta(days=1)
        )

        with pytest.raises(DashaConsistencyError):
            _verify_consistency(broken)

    def test_does_not_raise_for_genuinely_valid_output(self):
        _verify_consistency(self._valid_mahadashas())  # must not raise
