---
{
  "id": "ending-true-route",
  "type": "ending",
  "title": "Ending: The Body Was a Signpost",
  "summary": "Truth ending where Arden proves the station was staged to recover hidden evidence and frame Silas.",
  "tags": [
    "ending",
    "truth-route",
    "correct-accusation"
  ],
  "publicInfo": "Arden proves Rowan's body was moved into Black Hollow Station and connects the placement to Platform 7.",
  "privateInfo": "Evelyn is exposed as the killer. The station is not cleared of sorrow, but it is no longer allowed to be used as a cover story.",
  "createdAt": "2026-06-07T00:00:00.000Z",
  "updatedAt": "2026-06-07T00:00:00.000Z",
  "gameStory": {
    "role": "ending",
    "status": "ready",
    "criticalPath": true,
    "entryConditions": [
      {
        "id": "cond-ending-true-ledger",
        "variableId": "read-signal-ledger",
        "operator": "equals",
        "value": true
      },
      {
        "id": "cond-ending-true-pressure",
        "variableId": "evidence-pressure",
        "operator": "greater_than",
        "value": 2
      }
    ],
    "exitEffects": []
  },
  "graphPresence": "story_flow"
}

---
## Outcome
- Evelyn is named as the killer.
- Silas is cleared of the murder but still has to testify about Platform 7.
- The redevelopment board loses immediate control of the station.

## Final Reveal
Rowan knew Black Hollow Station held the ledger that proved Platform 7 reports were falsified. The killer moved him there to retrieve the evidence, hide the true attack site, and make the murder look like the work of someone obsessed with the old railway.
