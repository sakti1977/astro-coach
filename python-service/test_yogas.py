from yogas import detect_yogas, _dignified, _kendra_from


def planet(sign_num=0):
    return {"sign_num": sign_num}


def test_kendra_from_identifies_1_4_7_10():
    # Reference sign 0 (Aries): kendras are Aries(0), Cancer(3), Libra(6), Capricorn(9).
    assert _kendra_from(0, 0) is True
    assert _kendra_from(3, 0) is True
    assert _kendra_from(6, 0) is True
    assert _kendra_from(9, 0) is True
    assert _kendra_from(1, 0) is False


def test_dignified_true_for_own_and_exaltation_signs():
    assert _dignified("mars", 0) is True   # Aries, own sign
    assert _dignified("mars", 9) is True   # Capricorn, exaltation
    assert _dignified("mars", 4) is False  # Leo, neither


class TestPanchaMahapurushaYogas:
    def test_mars_dignified_in_kendra_from_lagna_triggers_ruchaka(self):
        planets = {"mars": planet(sign_num=0)}  # Aries: own sign, and a kendra from Aries lagna
        result = detect_yogas(planets, asc_sign_num=0)
        names = [y["name"] for y in result]
        assert "Ruchaka" in names

    def test_dignified_but_not_in_kendra_does_not_trigger(self):
        planets = {"mars": planet(sign_num=1)}  # Taurus: not own/exalted and not a kendra from Aries
        result = detect_yogas(planets, asc_sign_num=0)
        assert result == []

    def test_in_kendra_but_not_dignified_does_not_trigger(self):
        planets = {"mars": planet(sign_num=3)}  # Cancer: a kendra from Aries, but not dignified for Mars
        result = detect_yogas(planets, asc_sign_num=0)
        assert result == []


def test_gaja_kesari_jupiter_in_kendra_from_moon():
    planets = {"jupiter": planet(sign_num=3), "moon": planet(sign_num=0)}
    result = detect_yogas(planets, asc_sign_num=6)
    names = [y["name"] for y in result]
    assert "Gaja Kesari" in names


def test_budhaditya_sun_mercury_conjunction():
    planets = {"sun": planet(sign_num=4), "mercury": planet(sign_num=4)}
    result = detect_yogas(planets, asc_sign_num=6)
    names = [y["name"] for y in result]
    assert "Budhaditya" in names


def test_kemadruma_moon_with_no_adjacent_planets():
    planets = {
        "moon": planet(sign_num=5),
        "sun": planet(sign_num=8),  # far from moon's neighbors (4, 6)
    }
    result = detect_yogas(planets, asc_sign_num=0)
    names = [y["name"] for y in result]
    assert "Kemadruma" in names


def test_kemadruma_does_not_trigger_when_moon_has_a_neighbor():
    planets = {
        "moon": planet(sign_num=5),
        "sun": planet(sign_num=6),  # adjacent to moon
    }
    result = detect_yogas(planets, asc_sign_num=0)
    names = [y["name"] for y in result]
    assert "Kemadruma" not in names


def test_rahu_and_ketu_never_count_as_neighbors_for_kemadruma():
    planets = {
        "moon": planet(sign_num=5),
        "rahu": planet(sign_num=6),  # adjacent, but nodes are excluded from the check
        "ketu": planet(sign_num=4),
    }
    result = detect_yogas(planets, asc_sign_num=0)
    names = [y["name"] for y in result]
    assert "Kemadruma" in names


def test_no_planets_means_no_yogas():
    assert detect_yogas({}, asc_sign_num=0) == []
