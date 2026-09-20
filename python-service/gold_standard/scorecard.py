"""Run the gold-standard scorecard: independent oracles vs the app.

Usage (from python-service/, with the venv active):

    python -m gold_standard.scorecard
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

# Allow `python -m gold_standard.scorecard` from python-service/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from gold_standard.oracle import (  # noqa: E402
    GOLD_DIR,
    compute_natal,
    detect_doshas_classical,
    detect_yogas_classical,
    vimshottari_balance,
    vimshottari_mahadashas,
)

PLANET_KEYS = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"]
POS_TOL_DEG = 0.001  # 3.6 arcseconds — well inside Swiss Ephemeris published precision


def _load(name: str) -> dict:
    return json.loads((GOLD_DIR / name).read_text())


def _moon_pos(raw):
    if raw == "NAK_SIZE":
        return 360.0 / 27.0
    return float(raw)


def _ang_delta(a: float, b: float) -> float:
    return abs(((a - b + 180) % 360) - 180)


def score_natal() -> dict:
    from chart import calculate_chart

    births = _load("natal_births.json")["births"]
    frozen = {c["id"]: c for c in _load("natal_expected.json")["charts"]}
    deltas = []
    sign_ok = house_ok = nak_ok = yoga_tp = yoga_fp = yoga_fn = 0
    dosha_tp = dosha_fp = dosha_fn = 0
    retro_ok = 0
    retro_n = 0
    rows = []
    freeze_mismatches = 0

    for birth in births:
        oracle = compute_natal(birth)
        app = calculate_chart(
            name=birth["id"],
            year=birth["year"], month=birth["month"], day=birth["day"],
            hour=birth["hour"], minute=birth["minute"],
            lat=birth["lat"], lng=birth["lng"], tz_str=birth["tz_str"],
        )
        freeze = frozen[birth["id"]]
        if freeze["ascendant"]["abs_pos"] != oracle["ascendant"]["abs_pos"]:
            freeze_mismatches += 1

        d_asc = _ang_delta(app["ascendant"]["abs_pos"], oracle["ascendant"]["abs_pos"])
        deltas.append(d_asc)
        if app["ascendant"]["sign_num"] == oracle["ascendant"]["sign_num"]:
            sign_ok += 1

        body_rows = []
        for key in PLANET_KEYS:
            o, a = oracle["planets"][key], app["planets"][key]
            d = _ang_delta(a["abs_pos"], o["abs_pos"])
            deltas.append(d)
            if a["sign_num"] == o["sign_num"]:
                sign_ok += 1
            if a["house"] == o["house"]:
                house_ok += 1
            if a["nakshatra"]["name"] == o["nakshatra"]["name"] and a["nakshatra"]["pada"] == o["nakshatra"]["pada"]:
                nak_ok += 1
            retro_n += 1
            if bool(a["retrograde"]) == bool(o["retrograde"]):
                retro_ok += 1
            body_rows.append({"body": key, "delta_deg": round(d, 6), "ok": d <= POS_TOL_DEG})

        app_yogas = {y["name"] for y in app["yogas"]}
        ora_yogas = set(oracle["yogas"])
        yoga_tp += len(app_yogas & ora_yogas)
        yoga_fp += len(app_yogas - ora_yogas)
        yoga_fn += len(ora_yogas - app_yogas)

        app_doshas = {d["name"] for d in app["doshas"]}
        ora_doshas = set(oracle["doshas"])
        dosha_tp += len(app_doshas & ora_doshas)
        dosha_fp += len(app_doshas - ora_doshas)
        dosha_fn += len(ora_doshas - app_doshas)

        rows.append({
            "id": birth["id"],
            "asc_delta_deg": round(d_asc, 6),
            "bodies": body_rows,
            "app_yogas": sorted(app_yogas),
            "oracle_yogas": sorted(ora_yogas),
            "app_doshas": sorted(app_doshas),
            "oracle_doshas": sorted(ora_doshas),
        })

    n_pos = len(deltas)
    n_sign = len(births) * (1 + len(PLANET_KEYS))  # ASC + 9 bodies
    n_house = len(births) * len(PLANET_KEYS)
    n_nak = n_house

    def pr(tp, fp, fn):
        prec = tp / (tp + fp) if (tp + fp) else 1.0
        rec = tp / (tp + fn) if (tp + fn) else 1.0
        return {"precision": prec, "recall": rec, "tp": tp, "fp": fp, "fn": fn}

    return {
        "n_charts": len(births),
        "n_positions": n_pos,
        "max_abs_delta_deg": max(deltas) if deltas else 0.0,
        "mae_deg": sum(deltas) / n_pos if n_pos else 0.0,
        "positions_within_tol": sum(1 for d in deltas if d <= POS_TOL_DEG) / n_pos,
        "sign_accuracy": sign_ok / n_sign,
        "house_accuracy": house_ok / n_house,
        "nakshatra_accuracy": nak_ok / n_nak,
        "retrograde_accuracy": retro_ok / retro_n if retro_n else 1.0,
        "yogas": pr(yoga_tp, yoga_fp, yoga_fn),
        "doshas": pr(dosha_tp, dosha_fp, dosha_fn),
        "frozen_oracle_mismatches": freeze_mismatches,
        "charts": rows,
    }


def score_dasha() -> dict:
    from dasha import calculate_dashas

    cases = _load("dasha_cases.json")["cases"]
    lord_ok = 0
    seq_ok = 0
    md0_end_ok = 0
    balance_err = []
    rows = []
    for case in cases:
        moon = _moon_pos(case["moon_abs_pos"])
        birth = date.fromisoformat(case["birth_date"])
        lord, bal = vimshottari_balance(moon)
        oracle_mds = vimshottari_mahadashas(moon, birth)
        app = calculate_dashas(moon, birth)
        app_lords = [m["lord"] for m in app["mahadashas"]]
        ora_lords = [m["lord"] for m in oracle_mds]
        if lord == case["expected_start_lord"] and app["mahadashas"][0]["lord"] == lord:
            lord_ok += 1
        if app_lords == ora_lords == case["expected_lords"]:
            seq_ok += 1
        if app["mahadashas"][0]["end"] == oracle_mds[0]["end"]:
            md0_end_ok += 1
        app_bal = app["mahadashas"][0]["balance_years"]
        balance_err.append(abs(app_bal - bal))
        rows.append({
            "id": case["id"],
            "oracle_lord": lord,
            "app_lord": app["mahadashas"][0]["lord"],
            "oracle_md0_end": oracle_mds[0]["end"],
            "app_md0_end": app["mahadashas"][0]["end"],
            "balance_abs_err_years": abs(app_bal - bal),
        })
    n = len(cases)
    return {
        "n_cases": n,
        "start_lord_accuracy": lord_ok / n,
        "sequence_accuracy": seq_ok / n,
        "first_mahadasha_end_accuracy": md0_end_ok / n,
        "balance_mae_years": sum(balance_err) / n,
        "cases": rows,
    }


def score_yoga_dosha_synthetic() -> dict:
    from yogas import detect_yogas
    from doshas import detect_doshas

    cases = _load("yoga_dosha_cases.json")["cases"]
    yoga_tp = yoga_fp = yoga_fn = 0
    dosha_tp = dosha_fp = dosha_fn = 0
    failures = []
    for case in cases:
        planets = case["planets"]
        asc = case["asc_sign_num"]
        app_y = {y["name"] for y in detect_yogas(planets, asc)}
        ora_y = {y["name"] for y in detect_yogas_classical(planets, asc)}
        expect_y = set(case.get("expect_yogas", []))
        forbid_y = set(case.get("forbid_yogas", []))
        app_d = {d["name"] for d in detect_doshas(planets, asc)}
        ora_d = {d["name"] for d in detect_doshas_classical(planets, asc)}
        expect_d = set(case.get("expect_doshas", []))
        forbid_d = set(case.get("forbid_doshas", []))

        # App vs independent oracle
        yoga_tp += len(app_y & ora_y)
        yoga_fp += len(app_y - ora_y)
        yoga_fn += len(ora_y - app_y)
        dosha_tp += len(app_d & ora_d)
        dosha_fp += len(app_d - ora_d)
        dosha_fn += len(ora_d - app_d)

        problems = []
        if expect_y - app_y:
            problems.append(f"missing yogas {sorted(expect_y - app_y)}")
        if app_y & forbid_y:
            problems.append(f"forbidden yogas {sorted(app_y & forbid_y)}")
        if expect_d - app_d:
            problems.append(f"missing doshas {sorted(expect_d - app_d)}")
        if app_d & forbid_d:
            problems.append(f"forbidden doshas {sorted(app_d & forbid_d)}")
        if app_y != ora_y:
            problems.append(f"app/oracle yoga mismatch app={sorted(app_y)} ora={sorted(ora_y)}")
        if app_d != ora_d:
            problems.append(f"app/oracle dosha mismatch app={sorted(app_d)} ora={sorted(ora_d)}")
        # Gold labels must match the independent oracle (fixture quality).
        if expect_y and expect_y - ora_y:
            problems.append(f"fixture yogas not in oracle {sorted(expect_y - ora_y)}")
        if expect_d and expect_d - ora_d:
            problems.append(f"fixture doshas not in oracle {sorted(expect_d - ora_d)}")
        if problems:
            failures.append({"id": case["id"], "problems": problems})

    def pr(tp, fp, fn):
        prec = tp / (tp + fp) if (tp + fp) else 1.0
        rec = tp / (tp + fn) if (tp + fn) else 1.0
        return {"precision": prec, "recall": rec, "tp": tp, "fp": fp, "fn": fn}

    return {
        "n_cases": len(cases),
        "yogas": pr(yoga_tp, yoga_fp, yoga_fn),
        "doshas": pr(dosha_tp, dosha_fp, dosha_fn),
        "failures": failures,
        "pass": not failures,
    }


def score_remedies() -> dict:
    from chart import calculate_chart

    births = _load("natal_births.json")["births"]
    missing_behavioral = []
    ritual_only = []
    n_items = 0
    for birth in births:
        app = calculate_chart(
            name=birth["id"],
            year=birth["year"], month=birth["month"], day=birth["day"],
            hour=birth["hour"], minute=birth["minute"],
            lat=birth["lat"], lng=birth["lng"], tz_str=birth["tz_str"],
        )
        for item in list(app["yogas"]) + list(app["doshas"]):
            if item.get("strength") == "strong":
                continue
            n_items += 1
            remedies = item.get("remedies") or []
            if not remedies:
                missing_behavioral.append({"chart": birth["id"], "name": item["name"]})
                continue
            for r in remedies:
                if not r.get("behavioral"):
                    missing_behavioral.append({"chart": birth["id"], "name": item["name"], "planet": r.get("planet")})
                if r.get("mantra") and not r.get("behavioral"):
                    ritual_only.append({"chart": birth["id"], "name": item["name"]})
    return {
        "n_remedied_items": n_items,
        "missing_behavioral": missing_behavioral,
        "ritual_only": ritual_only,
        "pass": not missing_behavioral and not ritual_only,
    }


def _pct(x: float) -> str:
    return f"{100.0 * x:.1f}%"


def render(report: dict) -> str:
    n = report["natal"]
    d = report["dasha"]
    y = report["yoga_dosha"]
    r = report["remedies"]
    lines = [
        "GOLD STANDARD SCORECARD",
        "=======================",
        "Oracles: Swiss Ephemeris Lahiri (pyswisseph), closed-form Vimshottari, classical yoga/dosha rules.",
        "System under test: python-service chart.py / dasha.py / yogas.py / doshas.py / remedies.py",
        "",
        f"Natal accuracy  ({n['n_charts']} charts, {n['n_positions']} longitudes)",
        f"  max |Δ|           {n['max_abs_delta_deg']:.6f}°",
        f"  MAE               {n['mae_deg']:.6f}°",
        f"  within {POS_TOL_DEG}°     {_pct(n['positions_within_tol'])}",
        f"  sign match        {_pct(n['sign_accuracy'])}",
        f"  whole-sign house  {_pct(n['house_accuracy'])}",
        f"  nakshatra+pada    {_pct(n['nakshatra_accuracy'])}",
        f"  retrograde flag   {_pct(n['retrograde_accuracy'])}",
        f"  yoga P/R          {y['yogas']['precision']:.3f} / {y['yogas']['recall']:.3f}  (synthetic)  natal P/R {n['yogas']['precision']:.3f} / {n['yogas']['recall']:.3f}",
        f"  dosha P/R         {y['doshas']['precision']:.3f} / {y['doshas']['recall']:.3f}  (synthetic)  natal P/R {n['doshas']['precision']:.3f} / {n['doshas']['recall']:.3f}",
        f"  frozen vs live oracle mismatches: {n['frozen_oracle_mismatches']}",
        "",
        f"Vimshottari dasha  ({d['n_cases']} moons)",
        f"  start lord        {_pct(d['start_lord_accuracy'])}",
        f"  9-lord sequence   {_pct(d['sequence_accuracy'])}",
        f"  first MD end date {_pct(d['first_mahadasha_end_accuracy'])}",
        f"  balance MAE       {d['balance_mae_years']:.6f} years",
        "",
        f"Synthetic yoga/dosha cases: {'PASS' if y['pass'] else 'FAIL'} ({y['n_cases']} fixtures)",
        f"Remedy behavioral coverage: {'PASS' if r['pass'] else 'FAIL'} ({r['n_remedied_items']} moderate/challenging items)",
    ]
    if y["failures"]:
        lines.append("  synthetic failures:")
        for f in y["failures"]:
            lines.append(f"    - {f['id']}: {'; '.join(f['problems'])}")
    if r["missing_behavioral"] or r["ritual_only"]:
        lines.append(f"  missing behavioral: {r['missing_behavioral']}")
        lines.append(f"  ritual-only: {r['ritual_only']}")
    natal_pass = (
        n["positions_within_tol"] == 1.0
        and n["sign_accuracy"] == 1.0
        and n["house_accuracy"] == 1.0
        and n["nakshatra_accuracy"] == 1.0
        and n["yogas"]["fp"] == 0 and n["yogas"]["fn"] == 0
        and n["doshas"]["fp"] == 0 and n["doshas"]["fn"] == 0
        and n["frozen_oracle_mismatches"] == 0
    )
    dasha_pass = (
        d["start_lord_accuracy"] == 1.0
        and d["sequence_accuracy"] == 1.0
        and d["first_mahadasha_end_accuracy"] == 1.0
        and d["balance_mae_years"] < 1e-3
    )
    overall = natal_pass and dasha_pass and y["pass"] and r["pass"]
    lines += ["", f"OVERALL: {'PASS' if overall else 'FAIL'}"]
    report["overall_pass"] = overall
    return "\n".join(lines)


def main() -> int:
    report = {
        "natal": score_natal(),
        "dasha": score_dasha(),
        "yoga_dosha": score_yoga_dosha_synthetic(),
        "remedies": score_remedies(),
    }
    text = render(report)
    print(text)
    out = GOLD_DIR / "last_scorecard.json"
    out.write_text(json.dumps(report, indent=2, default=str) + "\n")
    print(f"\nWrote {out}")
    return 0 if report["overall_pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
