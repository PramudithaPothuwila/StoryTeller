---
{
  "id": "character-evelyn-park",
  "type": "character",
  "title": "Evelyn Park",
  "summary": "Redevelopment chair and public face of the station demolition plan.",
  "tags": [
    "suspect",
    "opposition",
    "killer",
    "redevelopment"
  ],
  "publicInfo": "Evelyn Park presents herself as a practical civic leader trying to turn Black Hollow Station into usable land.",
  "privateInfo": "Evelyn killed Rowan after he confronted her with the ledger. She moved the body to recover the key, hide the true murder location, and make Silas look like a station-haunted culprit.",
  "createdAt": "2026-06-07T00:00:00.000Z",
  "updatedAt": "2026-06-21T00:00:00.000Z",
  "graphPresence": "world",
  "runtimeCharacter": {
    "goals": [
      "Keep the redevelopment vote alive.",
      "Make Rowan look like another station tragedy.",
      "Redirect suspicion toward Silas before the ledger is recovered."
    ],
    "attitude": -65,
    "emotionalState": "Controlled, defensive, and increasingly brittle under specific evidence.",
    "communicationStyle": "Civic, reasonable, and procedural until the ledger forces direct answers.",
    "knownFactIds": [
      "fact-evelyn-killed-rowan",
      "fact-rowan-body-staged",
      "fact-ledger-implicates-evelyn"
    ],
    "believedFactIds": [
      "fact-silas-killed-rowan"
    ],
    "hiddenFactIds": [
      "fact-evelyn-killed-rowan",
      "fact-rowan-body-staged",
      "fact-ledger-implicates-evelyn"
    ],
    "deceptionRules": [
      {
        "id": "deception-evelyn-station-myth",
        "condition": "Asked why Rowan was found at Platform 7 before the ledger is presented",
        "deceptionGoal": "Keep the station myth and Silas frame plausible.",
        "allowedStrategies": [
          "deflect",
          "minimize",
          "partial_truth"
        ],
        "forbiddenFactIds": [
          "fact-evelyn-killed-rowan",
          "fact-rowan-body-staged",
          "fact-ledger-implicates-evelyn"
        ],
        "revealWhenEvidenceIds": [
          "evidence-signal-room-ledger",
          "evidence-drag-marks"
        ],
        "notes": "She can admit the station is dangerous, but not that she used it as a hiding place."
      }
    ],
    "disclosureRules": []
  }
}

---
## Planning Notes
- Evelyn should never sound like a cackling villain. She thinks she is preventing a town-killing scandal.
- Her strongest lie: Rowan was unstable about the old station and got involved with the wrong person.
- Her weak point: she knows too much about Locker 12 for someone who claims the station is worthless.

## Motive
- The demolition contract depends on burying old Platform 7 liability.
- The Signal Room Ledger links past falsified safety reports to current redevelopment money.
- Rowan was about to hand the ledger to a county inspector.
