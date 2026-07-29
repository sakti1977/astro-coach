import dataclasses
from datetime import datetime

from muhurta import calculate_muhurta, _jsonable, _window, AUSPICIOUS_NOTES, INAUSPICIOUS_NOTES


@dataclasses.dataclass
class FakePeriod:
    name: str
    starts_at: datetime
    ends_at: datetime


def test_jsonable_converts_datetime_to_iso_string():
    now = datetime(2026, 7, 29, 12, 30, 0)
    assert _jsonable(now) == now.isoformat()


def test_jsonable_converts_dataclass_recursively():
    period = FakePeriod("Rahu Kala", datetime(2026, 7, 29, 12, 0), datetime(2026, 7, 29, 13, 0))
    result = _jsonable(period)
    assert result == {
        "name": "Rahu Kala",
        "starts_at": "2026-07-29T12:00:00",
        "ends_at": "2026-07-29T13:00:00",
    }


def test_jsonable_handles_lists_of_dataclasses():
    periods = [FakePeriod("A", datetime(2026, 1, 1), datetime(2026, 1, 1, 1))]
    result = _jsonable(periods)
    assert isinstance(result, list)
    assert result[0]["name"] == "A"


def test_window_returns_none_for_missing_period():
    assert _window(None, AUSPICIOUS_NOTES) is None


def test_window_attaches_practical_note_by_name():
    period = FakePeriod("Rahu Kala", datetime(2026, 7, 29, 12, 0), datetime(2026, 7, 29, 13, 0))
    result = _window(period, INAUSPICIOUS_NOTES)
    assert result["note"] == INAUSPICIOUS_NOTES["Rahu Kala"]
    assert result["note"] != ""


def test_window_unwraps_a_list_and_uses_the_first_entry():
    periods = [
        FakePeriod("Amrit Kalam", datetime(2026, 7, 29, 19, 0), datetime(2026, 7, 29, 20, 0)),
        FakePeriod("Amrit Kalam", datetime(2026, 7, 30, 19, 0), datetime(2026, 7, 30, 20, 0)),
    ]
    result = _window(periods, AUSPICIOUS_NOTES)
    assert result["starts_at"] == "2026-07-29T19:00:00"


class TestCalculateMuhurta:
    # Fixed date/place so results are deterministic (Swiss Ephemeris output for
    # a given instant never changes). Mumbai, 2026-07-29 — the same fixture
    # already exercised manually against the live kaalavidya library.
    def _result(self):
        return calculate_muhurta(2026, 7, 29, 19.0760, 72.8777, "Asia/Kolkata", "Mumbai")

    def test_returns_the_requested_date(self):
        assert self._result()["date"] == "2026-07-29"

    def test_panchang_fields_are_present_and_non_empty(self):
        r = self._result()
        for field in ("tithi", "nakshatra", "yoga", "karana"):
            assert len(r[field]) > 0
            assert r[field][0]["name"]

    def test_sunrise_is_before_sunset(self):
        r = self._result()
        assert r["sunrise"] < r["sunset"]

    def test_every_auspicious_window_has_a_practical_note_and_valid_ordering(self):
        r = self._result()
        assert len(r["auspicious"]) > 0
        for w in r["auspicious"]:
            assert w["note"], f"{w['name']} is missing its practical framing note"
            assert w["starts_at"] < w["ends_at"]

    def test_every_inauspicious_window_has_a_practical_note_and_valid_ordering(self):
        r = self._result()
        assert len(r["inauspicious"]) > 0
        for w in r["inauspicious"]:
            assert w["note"], f"{w['name']} is missing its practical framing note"
            assert w["starts_at"] < w["ends_at"]

    def test_result_is_json_serializable(self):
        import json
        json.dumps(self._result())  # raises if anything isn't JSON-safe
