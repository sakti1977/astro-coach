"""Gold-standard accuracy tests: independent oracles vs the app.

These tests load checked-in fixtures under gold_standard/ and compare
calculate_chart / calculate_dashas / detect_yogas / detect_doshas against
pyswisseph + closed-form Vimshottari + restated classical yoga/dosha rules.
They must not treat the app's own output as the expected value.
"""

from __future__ import annotations

import json
from datetime import date

import pytest

from gold_standard.oracle import (
    GOLD_DIR,
    compute_natal,
    detect_doshas_classical,
    detect_yogas_classical,
    vimshottari_balance,
    vimshottari_mahadashas,
)
from gold_standard.scorecard import (
    POS_TOL_DEG,
    _ang_delta,
    _moon_pos,
    score_dasha,
    score_natal,
    score_remedies,
    score_yoga_dosha_synthetic,
)

from chart import calculate_chart
from dasha import calculate_dashas
from doshas import detect_doshas
from yogas import detect_yogas


def _load(name: str):
    return json.loads((GOLD_DIR / name).read_text())


BIRTHS = _load("natal_births.json")["births"]
FROZEN = {c["id"]: c for c in _load("natal_expected.json")["charts"]}
YOGA_CASES = _load("yoga_dosha_cases.json")["cases"]
DASHA_CASES = _load("dasha_cases.json")["cases"]


@pytest.mark.parametrize("birth", BIRTHS, ids=lambda b: b["id"])
def test_frozen_expected_matches_live_swiss_ephemeris_oracle(birth):
    live = compute_natal(birth)
    frozen = FROZEN[birth["id"]]
    assert frozen["ascendant"]["abs_pos"] == live["ascendant"]["abs_pos"]
    assert frozen["yogas"] == live["yogas"]
    assert frozen["doshas"] == live["doshas"]
    for key, body in live["planets"].items():
        assert frozen["planets"][key]["abs_pos"] == body["abs_pos"]
        assert frozen["planets"][key]["house"] == body["house"]
        assert frozen["planets"][key]["nakshatra"] == body["nakshatra"]


@pytest.mark.parametrize("birth", BIRTHS, ids=lambda b: b["id"])
def test_app_chart_matches_swiss_ephemeris_oracle(birth):
    oracle = compute_natal(birth)
    app = calculate_chart(
        name=birth["id"],
        year=birth["year"], month=birth["month"], day=birth["day"],
        hour=birth["hour"], minute=birth["minute"],
        lat=birth["lat"], lng=birth["lng"], tz_str=birth["tz_str"],
    )
    assert _ang_delta(app["ascendant"]["abs_pos"], oracle["ascendant"]["abs_pos"]) <= POS_TOL_DEG
    assert app["ascendant"]["sign_num"] == oracle["ascendant"]["sign_num"]
    assert app["moon_nakshatra"]["name"] == oracle["moon_nakshatra"]["name"]
    assert app["moon_nakshatra"]["pada"] == oracle["moon_nakshatra"]["pada"]
    for key, o in oracle["planets"].items():
        a = app["planets"][key]
        assert _ang_delta(a["abs_pos"], o["abs_pos"]) <= POS_TOL_DEG, f"{birth['id']} {key}"
        assert a["sign_num"] == o["sign_num"], key
        assert a["house"] == o["house"], key
        assert a["nakshatra"]["name"] == o["nakshatra"]["name"], key
        assert a["nakshatra"]["pada"] == o["nakshatra"]["pada"], key
        assert bool(a["retrograde"]) == bool(o["retrograde"]), key
    assert {y["name"] for y in app["yogas"]} == set(oracle["yogas"])
    assert {d["name"] for d in app["doshas"]} == set(oracle["doshas"])


@pytest.mark.parametrize("case", DASHA_CASES, ids=lambda c: c["id"])
def test_app_dashas_match_closed_form_vimshottari(case):
    moon = _moon_pos(case["moon_abs_pos"])
    birth = date.fromisoformat(case["birth_date"])
    lord, bal = vimshottari_balance(moon)
    oracle_mds = vimshottari_mahadashas(moon, birth)
    app = calculate_dashas(moon, birth)
    assert lord == case["expected_start_lord"]
    assert app["mahadashas"][0]["lord"] == lord
    assert [m["lord"] for m in app["mahadashas"]] == case["expected_lords"]
    assert [m["lord"] for m in oracle_mds] == case["expected_lords"]
    assert app["mahadashas"][0]["start"] == case["birth_date"]
    assert app["mahadashas"][0]["end"] == oracle_mds[0]["end"]
    assert abs(app["mahadashas"][0]["balance_years"] - bal) < 1e-3
    if "expected_balance_years" in case:
        assert abs(bal - float(case["expected_balance_years"])) < 1e-6
    for prev, nxt in zip(app["mahadashas"], app["mahadashas"][1:]):
        assert prev["end"] == nxt["start"]


@pytest.mark.parametrize("case", YOGA_CASES, ids=lambda c: c["id"])
def test_synthetic_yoga_dosha_matches_classical_oracle_and_labels(case):
    planets, asc = case["planets"], case["asc_sign_num"]
    app_y = {y["name"] for y in detect_yogas(planets, asc)}
    ora_y = {y["name"] for y in detect_yogas_classical(planets, asc)}
    app_d = {d["name"] for d in detect_doshas(planets, asc)}
    ora_d = {d["name"] for d in detect_doshas_classical(planets, asc)}
    assert app_y == ora_y
    assert app_d == ora_d
    assert set(case.get("expect_yogas", [])) <= app_y
    assert set(case.get("expect_doshas", [])) <= app_d
    assert not (app_y & set(case.get("forbid_yogas", [])))
    assert not (app_d & set(case.get("forbid_doshas", [])))


def test_scorecard_thresholds():
    natal = score_natal()
    dasha = score_dasha()
    yoga = score_yoga_dosha_synthetic()
    remedies = score_remedies()
    assert natal["max_abs_delta_deg"] <= POS_TOL_DEG
    assert natal["sign_accuracy"] == 1.0
    assert natal["house_accuracy"] == 1.0
    assert natal["nakshatra_accuracy"] == 1.0
    assert natal["frozen_oracle_mismatches"] == 0
    assert dasha["start_lord_accuracy"] == 1.0
    assert dasha["sequence_accuracy"] == 1.0
    assert dasha["first_mahadasha_end_accuracy"] == 1.0
    assert yoga["pass"]
    assert remedies["pass"]
