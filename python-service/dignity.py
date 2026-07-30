"""Classical planetary dignity (exaltation / own-sign / neutral / debilitation)
against a person's own natal chart.

v1 scope: debilitation is mechanically derived as the sign 7 signs (180 deg)
from exaltation - classically correct, no new table needed. Moolatrikona and
planetary friend/enemy dignity are NOT implemented (would require new
classical-table authoring) - always classify "neutral" here; a documented v2
candidate, not a bug. Rahu/Ketu have no entries in the existing _OWN/_EXALT
tables (classical texts disagree across traditions) - always "neutral".
"""

from yogas import _OWN, _EXALT  # reuse the single source of truth already used by Pancha Mahapurusha detection

_DEBILITATION: dict[str, int] = {planet: (sign + 6) % 12 for planet, sign in _EXALT.items()}


def classify_dignity(planet_key: str, sign_num: int) -> str:
    key = planet_key.lower()
    if sign_num == _EXALT.get(key, -1):
        return "exalted"
    if sign_num in _OWN.get(key, set()):
        return "own"
    if sign_num == _DEBILITATION.get(key, -1):
        return "debilitated"
    return "neutral"
