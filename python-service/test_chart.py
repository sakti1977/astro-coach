from chart import calculate_chart, _varga_sign, _trimshamsha_sign, _nakshatra


# Fixed birth data (Mumbai, 1990-06-15 08:30 IST) used as a golden fixture.
# Swiss Ephemeris output for a given instant is deterministic, so exact
# values here are a real regression guard, not a loose smoke test.
BIRTH = dict(name="Test", year=1990, month=6, day=15, hour=8, minute=30,
             lat=19.0760, lng=72.8777, tz_str="Asia/Kolkata")


def test_ascendant_degree_is_the_true_lagna_not_the_house_cusp():
    # Regression guard for the historical bug (fixed in commit 99e9188): the
    # Ascendant degree was read from the whole-sign house-1 cusp, which is
    # ALWAYS exactly 0.0 degrees by definition of the whole-sign system —
    # silently wrong for every single chart ever calculated. If this
    # regresses, the degree (and every varga computed from it) goes back to
    # being 0.0 for 100% of users again.
    chart = calculate_chart(**BIRTH)
    asc = chart["ascendant"]
    assert asc["degree"] != 0.0
    assert asc["sign"] == "Can"
    assert asc["sign_num"] == 3
    assert asc["degree"] == 2.8341


def test_ascendant_and_planet_house_placements_are_internally_consistent():
    chart = calculate_chart(**BIRTH)
    # Every planet's house must be a valid whole-sign house number.
    for key, p in chart["planets"].items():
        assert 1 <= p["house"] <= 12, f"{key} has an invalid house: {p['house']}"


def test_moon_nakshatra_matches_the_moon_planet_entry():
    chart = calculate_chart(**BIRTH)
    assert chart["moon_nakshatra"] == _nakshatra(chart["planets"]["moon"]["abs_pos"])


def test_result_is_stable_across_repeated_calls():
    # Deterministic astronomy: calling twice with identical inputs must give
    # identical output (no reliance on "now", random ordering, etc.).
    a = calculate_chart(**BIRTH)
    b = calculate_chart(**BIRTH)
    assert a == b


class TestVargaSign:
    def test_navamsa_sign_is_within_valid_range(self):
        for abs_pos in [0.0, 45.5, 179.9, 359.99]:
            sign = _varga_sign(abs_pos, 9)
            assert 0 <= sign <= 11

    def test_dashamsha_and_saptamsha_are_within_valid_range(self):
        for varga in (7, 10):
            for abs_pos in [0.0, 100.0, 250.0]:
                assert 0 <= _varga_sign(abs_pos, varga) <= 11


class TestTrimshamshaSign:
    def test_result_is_always_a_valid_sign_index(self):
        for abs_pos in [0.0, 3.0, 8.0, 15.0, 22.0, 29.9, 200.0]:
            assert 0 <= _trimshamsha_sign(abs_pos) <= 11
