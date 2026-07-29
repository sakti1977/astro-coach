"""Structured remedy table for the nine grahas.

This replaces free-form remedy suggestions improvised by the LLM on each chat
turn with a fixed, auditable mapping: affliction -> planet -> remedy. The
coach still writes the surrounding prose, but WHICH mantra/gemstone/dana/
behavioral practice gets named for a given chart is deterministic and the same
every time, not reinvented per conversation.

Each planet has both a `traditional` remedy (mantra/deity/gemstone/dana/vrata)
and a `behavioral` one (a concrete non-ritual practice aligned with the same
planetary quality), so this table serves both the Vedic-remedies-on and
Vedic-remedies-off coaching modes from one source of truth.
"""

REMEDY_TABLE: dict[str, dict] = {
    "sun": {
        "deity": "Surya / Vishnu",
        "mantra": "Om Suryaya Namah (108x at sunrise) or the Aditya Hridayam",
        "gemstone": "Ruby (Manikya), set in gold, worn on the ring finger — traditionally only after a trial period",
        "dana": "Wheat, jaggery, or copper, given on Sundays; supporting one's father or father-figures",
        "vrata_day": "Sunday",
        "behavioral": "Practice a single daily act of visible leadership or decision-making — say the thing you'd normally soften, own one outcome fully without deflecting credit or blame.",
    },
    "moon": {
        "deity": "Shiva / Parvati",
        "mantra": "Om Chandraya Namah or Om Som Somaya Namah",
        "gemstone": "Pearl (Moti), set in silver, worn on the little finger",
        "dana": "Rice, milk, or white cloth, given on Mondays; supporting one's mother or maternal figures",
        "vrata_day": "Monday",
        "behavioral": "Build one non-negotiable daily ritual that regulates mood before it regulates you — same wake time, same wind-down, tracked for a month.",
    },
    "mars": {
        "deity": "Hanuman / Kartikeya",
        "mantra": "Om Angarakaya Namah or the Hanuman Chalisa",
        "gemstone": "Red Coral (Moonga), set in gold or copper, worn on the ring finger",
        "dana": "Red lentils (masoor dal) or jaggery, given on Tuesdays; blood donation",
        "vrata_day": "Tuesday",
        "behavioral": "Give the assertive energy a physical outlet before it becomes reactive: a hard workout, a boxing bag, or a fixed daily physical practice, done before high-stakes conversations, not instead of them.",
    },
    "mercury": {
        "deity": "Vishnu",
        "mantra": "Om Budhaya Namah",
        "gemstone": "Emerald (Panna), set in gold, worn on the little finger",
        "dana": "Green gram (moong) or green cloth, given on Wednesdays; supporting education for others",
        "vrata_day": "Wednesday",
        "behavioral": "Externalize the analysis loop — write the decision down before speaking it, cap deliberation to a fixed time box, then commit.",
    },
    "jupiter": {
        "deity": "Vishnu / Brihaspati",
        "mantra": "Om Gurave Namah or Om Brihaspataye Namah",
        "gemstone": "Yellow Sapphire (Pukhraj), set in gold, worn on the index finger",
        "dana": "Turmeric, yellow lentils, or books, given on Thursdays; respect and support for teachers",
        "vrata_day": "Thursday",
        "behavioral": "Take on a small, regular teaching or mentoring commitment — Jupiter's expansion strengthens through use, not through waiting to feel ready.",
    },
    "venus": {
        "deity": "Lakshmi",
        "mantra": "Om Shukraya Namah",
        "gemstone": "Diamond or White Sapphire, set in platinum or silver",
        "dana": "White clothes, sugar, or ghee, given on Fridays; support for women in one's community",
        "vrata_day": "Friday",
        "behavioral": "Practice naming a preference or a boundary out loud in a low-stakes relationship this week — Venus in avoidance keeps the peace by staying quiet; healthy Venus keeps it by staying honest.",
    },
    "saturn": {
        "deity": "Shani / Hanuman / Shiva",
        "mantra": "Om Sham Shanaischaraya Namah",
        "gemstone": "Blue Sapphire (Neelam) — traditionally tested on the body for a trial period before committing, as it acts fastest and least forgivingly of the nine",
        "dana": "Mustard oil, black sesame, or iron, given on Saturdays; service to laborers, the elderly, or the disabled",
        "vrata_day": "Saturday",
        "behavioral": "Pick one structure (a schedule, a budget, a training plan) and hold it for 40 days without renegotiating it — Saturn rewards duration, not intensity.",
    },
    "rahu": {
        "deity": "Durga / Bhairava",
        "mantra": "Om Rahave Namah",
        "gemstone": "Hessonite (Gomed), set in silver, worn on the middle finger",
        "dana": "Mustard seeds or blue/black items, given on Saturdays; serving the marginalized or displaced",
        "vrata_day": "Saturday",
        "behavioral": "Pick the one goal Rahu keeps chasing and finish it before starting the next shiny one — the restlessness resolves through completion, not through more novelty.",
    },
    "ketu": {
        "deity": "Ganesha",
        "mantra": "Om Ketave Namah",
        "gemstone": "Cat's Eye (Lehsunia), set in silver, worn on the middle finger",
        "dana": "Multi-colored cloth or blankets, given on Saturdays; support for ascetics or spiritual seekers",
        "vrata_day": "Saturday or Tuesday",
        "behavioral": "Give the detachment a container — a regular solitude practice (meditation, journaling, a walk without a phone) so withdrawal becomes chosen rather than compulsive.",
    },
}


def attach_remedies(items: list[dict], include_traditional: bool = True) -> list[dict]:
    """Attach a `remedies` list to each yoga/dosha dict, keyed off its `planets`.
    Only attaches to challenging/moderate items — strong yogas describe a gift,
    not an affliction to remedy."""
    for item in items:
        if item.get("strength") == "strong":
            continue
        remedies = []
        for planet_key in item.get("planets", []):
            entry = REMEDY_TABLE.get(planet_key)
            if not entry:
                continue
            remedy = {"planet": planet_key, "behavioral": entry["behavioral"]}
            if include_traditional:
                remedy.update({
                    "deity": entry["deity"],
                    "mantra": entry["mantra"],
                    "gemstone": entry["gemstone"],
                    "dana": entry["dana"],
                    "vrata_day": entry["vrata_day"],
                })
            remedies.append(remedy)
        if remedies:
            item["remedies"] = remedies
    return items
