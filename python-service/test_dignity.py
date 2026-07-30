from dignity import classify_dignity, _DEBILITATION
from yogas import _EXALT


def test_sun_in_aries_is_exalted():
    assert classify_dignity("sun", 0) == "exalted"


def test_sun_in_leo_is_own_sign():
    assert classify_dignity("sun", 4) == "own"


def test_sun_in_libra_is_debilitated():
    # Libra is 7 signs (180 deg) from Aries, Sun's exaltation sign.
    assert classify_dignity("sun", 6) == "debilitated"


def test_saturn_in_libra_is_exalted():
    assert classify_dignity("saturn", 6) == "exalted"


def test_saturn_in_aries_is_debilitated():
    # Aries is 7 signs from Libra, Saturn's exaltation sign.
    assert classify_dignity("saturn", 0) == "debilitated"


def test_moon_in_taurus_is_exalted():
    assert classify_dignity("moon", 1) == "exalted"


def test_moon_in_scorpio_is_debilitated():
    assert classify_dignity("moon", 7) == "debilitated"


def test_mercury_in_taurus_is_neutral():
    # Taurus is neither Mercury's own sign (Gemini/Virgo), exaltation (Virgo),
    # nor debilitation (Pisces) — the "says nothing" middle tier.
    assert classify_dignity("mercury", 1) == "neutral"


def test_debilitation_table_is_mechanically_derived_from_exaltation():
    for planet, exalt_sign in _EXALT.items():
        assert _DEBILITATION[planet] == (exalt_sign + 6) % 12


def test_rahu_is_always_neutral_v1_limitation():
    # v1 documented limitation: Rahu/Ketu have no _OWN/_EXALT entries
    # (classical texts disagree across traditions) — regression guard so
    # this can't silently change without a deliberate decision.
    assert classify_dignity("rahu", 0) == "neutral"
    assert classify_dignity("rahu", 6) == "neutral"


def test_ketu_is_always_neutral_v1_limitation():
    assert classify_dignity("ketu", 0) == "neutral"
    assert classify_dignity("ketu", 6) == "neutral"


def test_planet_key_is_case_insensitive():
    assert classify_dignity("Sun", 0) == "exalted"
    assert classify_dignity("SATURN", 6) == "exalted"
