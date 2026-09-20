# Gold-standard testdata

Independent oracles for accuracy (astronomy + classical timing/rules) and a
prompt-level efficacy suite for coaching grounding. The app is the **system
under test**; these fixtures must not be generated from `chart.py` /
`dasha.py` / `yogas.py`.

## Oracles

| Concern | Oracle | Fixture |
| --- | --- | --- |
| Sidereal longitudes, true Lagna, true node, nakshatra, whole-sign houses | `pyswisseph` Lahiri (`SIDM_LAHIRI` + `FLG_SIDEREAL`) | `natal_births.json` + frozen `natal_expected.json` |
| Vimshottari balance and mahadasha dates | Closed-form: 27 nakshatras, classical year allotments, IAU sidereal year `365.25636` d | `dasha_cases.json` |
| Yogas / doshas | Restated classical rules in `oracle.py` (BPHS Pancha Mahapurusha, Gaja Kesari, Budhaditya, Chandra Mangal, Kemadruma, Visha; Kuja; Kaal Sarp hemisphere; one common Pitru reading) | `yoga_dosha_cases.json` + natal names |
| Coaching efficacy | Vitest against `buildCoachSystemPrompt` / `buildCoachDynamicBlock` / `buildDashaPredictionPrompt` using the Mumbai gold natal | `astro-coach/lib/astrology/prompts/goldStandard.efficacy.test.ts` |

kerykeion is pinned `>=5.12.0,<6` because v6 removed `AstrologicalSubject` and
is not bit-compatible with this service.

## Run

From `python-service/` (venv with `requirements-dev.txt`):

```bash
python -m gold_standard.scorecard
pytest test_gold_standard.py -q
```

From `astro-coach/`:

```bash
npx vitest run lib/astrology/prompts/goldStandard.efficacy.test.ts
```

A scorecard is **PASS** only if every natal longitude is within `0.001°` of
Swiss Ephemeris, signs/houses/nakshatras match, yoga/dosha names match the
classical oracle, Vimshottari lords and first mahadasha end-dates match, and
every moderate/challenging yoga/dosha carries a behavioral remedy.
