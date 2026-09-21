from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
MAIN = (ROOT / "main.py").read_text()
REMEDIES = (ROOT / "remedies.py").read_text()


def test_every_post_route_requires_shared_secret():
    posts = re.findall(r'@app\.post\("([^"]+)"([^\n]*)', MAIN)
    assert posts, "expected POST routes in main.py"
    for path, rest in posts:
        assert "_verify_secret" in rest, f"{path} is missing Depends(_verify_secret)"


def test_deployed_service_fails_closed_without_secret():
    assert "EPHEMERIS_SHARED_SECRET must be set on a deployed" in MAIN
    assert "def _deployed()" in MAIN


def test_every_remedy_has_behavioral_component():
    planets = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"]
    for planet in planets:
        block = re.search(rf'"{planet}":\s*\{{(.*?)\n    \}},', REMEDIES, re.S)
        assert block, planet
        assert '"behavioral"' in block.group(1) and re.search(r'"behavioral":\s*"[^"]+\S', block.group(1)), planet
