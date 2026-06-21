---
{
  "id": "character-detective-arden-pike",
  "type": "character",
  "title": "Detective Arden Pike",
  "summary": "The player detective, sent to Black Hollow because the town police are entangled with the station redevelopment fight.",
  "tags": [
    "player-role",
    "detective",
    "outsider"
  ],
  "publicInfo": "A county detective with a reputation for reconstructing crimes from small spatial contradictions.",
  "privateInfo": "Arden is less interested in heroic confession scenes than in making evidence survive pressure from powerful locals. Their weakness is impatience with sentimental witnesses like Silas.",
  "createdAt": "2026-06-07T00:00:00.000Z",
  "updatedAt": "2026-06-21T00:00:00.000Z",
  "graphPresence": "world",
  "runtimeCharacter": {
    "goals": [
      "Preserve evidence before local pressure distorts it.",
      "Separate staged symbolism from the actual attack route.",
      "Keep the accusation tied to proof rather than station folklore."
    ],
    "attitude": 15,
    "emotionalState": "Focused, impatient with evasive witnesses.",
    "communicationStyle": "Precise, procedural, and willing to press contradictions when testimony drifts.",
    "knownFactIds": [],
    "believedFactIds": [
      "fact-rowan-body-staged"
    ],
    "hiddenFactIds": [],
    "deceptionRules": [],
    "disclosureRules": [
      {
        "id": "disclosure-arden-proof-only",
        "condition": "Before naming a suspect",
        "revealFactIds": [
          "fact-rowan-body-staged",
          "fact-ledger-implicates-evelyn"
        ],
        "requiredEvidenceIds": [
          "evidence-drag-marks",
          "evidence-signal-room-ledger"
        ],
        "audience": "Player and confrontation dialogue",
        "notes": "Arden should state only what the gathered evidence can support."
      }
    ]
  }
}

---
## Planning Notes
- Arden should feel competent but not omniscient.
- Dialogue choices should let the player be precise, skeptical, or forceful.
- The strongest route rewards treating place as testimony: drag direction, dust disturbance, access paths, and old station records.

## Gameplay Use
- Player decisions set trust with Silas.
- Evidence-heavy choices increase Evidence Pressure.
- The final accusation should depend on what the player can actually prove.
