from doshas import detect_doshas, _manglik_dosha, _kaal_sarp_dosha, _pitru_dosha


def planet(sign_num=0, house=1, abs_pos=0.0):
    return {"sign_num": sign_num, "house": house, "abs_pos": abs_pos}


class TestManglikDosha:
    def test_no_mars_means_no_dosha(self):
        assert _manglik_dosha({}, 0) is None

    def test_neither_lagna_nor_moon_placement_means_no_dosha(self):
        planets = {"mars": planet(sign_num=5, house=5), "moon": planet(sign_num=0)}
        # Mars in house 5 is not a Kuja house; house-from-moon(0 -> 5) = 6, also not.
        assert _manglik_dosha(planets, 0) is None

    def test_lagna_placement_only_is_moderate(self):
        planets = {"mars": planet(sign_num=5, house=7), "moon": planet(sign_num=0)}
        # House from moon(0) to mars(5) = ((5-0)%12)+1 = 6 -> not a Kuja house.
        result = _manglik_dosha(planets, 0)
        assert result is not None
        assert result["strength"] == "moderate"

    def test_lagna_and_moon_placement_together_is_strong(self):
        planets = {"mars": planet(sign_num=8, house=7), "moon": planet(sign_num=2)}
        # House from moon(2) to mars(8) = ((8-2)%12)+1 = 7 -> a Kuja house too.
        result = _manglik_dosha(planets, 0)
        assert result is not None
        assert result["strength"] == "strong"

    def test_missing_moon_still_evaluates_lagna_placement(self):
        planets = {"mars": planet(house=1)}
        result = _manglik_dosha(planets, 0)
        assert result is not None
        assert result["strength"] == "moderate"


class TestKaalSarpDosha:
    SEVEN = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"]

    def _chart(self, positions, rahu_pos=0.0):
        planets = {name: planet(abs_pos=pos) for name, pos in zip(self.SEVEN, positions)}
        planets["rahu"] = planet(abs_pos=rahu_pos)
        return planets

    def test_no_rahu_means_no_dosha(self):
        assert _kaal_sarp_dosha({}) is None

    def test_fewer_than_seven_classical_planets_means_no_dosha(self):
        planets = self._chart([10, 20, 30])  # only 3 of 7 present
        assert _kaal_sarp_dosha(planets) is None

    def test_all_seven_on_one_side_of_rahu_axis_triggers_dosha(self):
        planets = self._chart([10, 20, 30, 40, 50, 60, 70], rahu_pos=0.0)
        result = _kaal_sarp_dosha(planets)
        assert result is not None
        assert result["strength"] == "challenging"

    def test_planets_spread_across_the_axis_does_not_trigger(self):
        planets = self._chart([10, 20, 30, 40, 50, 60, 200], rahu_pos=0.0)
        assert _kaal_sarp_dosha(planets) is None


class TestPitruDosha:
    def test_missing_required_planets_means_no_dosha(self):
        assert _pitru_dosha({"sun": planet()}, 0) is None

    def test_node_in_ninth_house_triggers_dosha(self):
        planets = {
            "sun": planet(sign_num=0),
            "rahu": planet(sign_num=5, house=9),
            "ketu": planet(sign_num=11, house=3),
        }
        result = _pitru_dosha(planets, 0)
        assert result is not None
        assert result["houses_involved"] == ["H9"]

    def test_sun_conjunct_node_triggers_dosha_without_ninth_house(self):
        planets = {
            "sun": planet(sign_num=5, house=3),
            "rahu": planet(sign_num=5, house=3),
            "ketu": planet(sign_num=11, house=4),  # neither node in H9
        }
        result = _pitru_dosha(planets, 0)
        assert result is not None
        assert result["houses_involved"] == []

    def test_neither_condition_means_no_dosha(self):
        planets = {
            "sun": planet(sign_num=0, house=1),
            "rahu": planet(sign_num=5, house=3),
            "ketu": planet(sign_num=11, house=6),
        }
        assert _pitru_dosha(planets, 0) is None


def test_detect_doshas_returns_only_present_doshas():
    # A clean chart with no afflictions at all.
    planets = {
        "mars": planet(sign_num=5, house=5),
        "moon": planet(sign_num=0),
        "sun": planet(sign_num=0, house=1),
        "rahu": planet(sign_num=5, house=3, abs_pos=150),
        "ketu": planet(sign_num=11, house=6, abs_pos=330),
    }
    result = detect_doshas(planets, 0)
    assert isinstance(result, list)
    # No Kaal Sarp (fewer than 7 classical planets present), no Pitru (neither
    # condition met), no Manglik (mars house 5 isn't a Kuja house).
    names = [d["name"] for d in result]
    assert "Manglik (Kuja) Dosha" not in names
    assert "Pitru Dosha" not in names
