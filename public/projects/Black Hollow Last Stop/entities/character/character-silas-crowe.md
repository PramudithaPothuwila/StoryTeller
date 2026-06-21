---
{
  "id": "character-silas-crowe",
  "type": "character",
  "title": "Silas Crowe",
  "summary": "A retired signalman whose grief and station knowledge make him an ideal false suspect.",
  "tags": [
    "suspect",
    "witness",
    "former-signalman",
    "red-herring"
  ],
  "publicInfo": "Silas still visits the abandoned station and argues against demolition at public meetings.",
  "privateInfo": "Silas did not kill Rowan. He knows Rowan asked about Locker 12 and can reveal the key route if the player does not treat him as the murderer from the start.",
  "createdAt": "2026-06-07T00:00:00.000Z",
  "updatedAt": "2026-06-21T00:00:00.000Z",
  "graphPresence": "world",
  "runtimeCharacter": {
    "goals": [
      "Protect the station memory from being used as a cheap motive.",
      "Avoid becoming the official story for Rowan's death.",
      "Reveal Locker 12 only to someone following evidence."
    ],
    "attitude": -10,
    "emotionalState": "Grieving, prickly, and suspicious of official closure.",
    "communicationStyle": "Gravelly, metaphorical, and defensive until Arden names a physical contradiction.",
    "knownFactIds": [
      "fact-silas-innocent",
      "fact-rowan-asked-locker-12"
    ],
    "believedFactIds": [
      "fact-rowan-body-staged"
    ],
    "hiddenFactIds": [
      "fact-rowan-asked-locker-12"
    ],
    "deceptionRules": [
      {
        "id": "deception-silas-stall-accusation",
        "condition": "Accused before Arden shows the drag-mark contradiction",
        "deceptionGoal": "Avoid giving an accuser the key route that could be twisted against him.",
        "allowedStrategies": [
          "deflect",
          "deny"
        ],
        "forbiddenFactIds": [
          "fact-rowan-asked-locker-12"
        ],
        "revealWhenEvidenceIds": [
          "evidence-drag-marks"
        ],
        "notes": "Silas withholds help when treated as the obvious culprit."
      }
    ],
    "disclosureRules": [
      {
        "id": "disclosure-silas-locker-12",
        "condition": "Arden approaches with the staging theory instead of accusation",
        "revealFactIds": [
          "fact-rowan-asked-locker-12"
        ],
        "requiredEvidenceIds": [
          "evidence-drag-marks"
        ],
        "audience": "Silas interview branch",
        "notes": "This unlocks the strongest route toward the signal room ledger."
      }
    ]
  }
}

---
## Planning Notes
- Silas is prickly, not sinister.
- He talks about the station as if it is a body with old injuries.
- He is the best test of whether the player follows evidence or vibe.

## Branch Use
- If trusted, Silas points to the Locker 12 key.
- If accused, he shuts down and the player can still proceed, but the false-frame ending becomes much easier.
