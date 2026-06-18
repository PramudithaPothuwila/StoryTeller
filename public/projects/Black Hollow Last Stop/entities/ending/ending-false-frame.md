---
{
  "id": "ending-false-frame",
  "type": "ending",
  "title": "Ending: A Convenient Ghost",
  "summary": "False-frame ending where the case closes around Silas and the station myth survives.",
  "tags": [
    "ending",
    "false-frame",
    "bad-ending"
  ],
  "publicInfo": "Arden names Silas Crowe as the likely killer after failing to recover the ledger.",
  "privateInfo": "Silas is innocent. Evelyn survives by letting the town believe the abandoned station produced one more tragedy.",
  "createdAt": "2026-06-07T00:00:00.000Z",
  "updatedAt": "2026-06-07T00:00:00.000Z",
  "gameStory": {
    "role": "ending",
    "status": "ready",
    "criticalPath": false,
    "entryConditions": [
      {
        "id": "cond-ending-false-no-ledger",
        "variableId": "read-signal-ledger",
        "operator": "equals",
        "value": false
      }
    ],
    "exitEffects": []
  },
  "graphPresence": "story_flow"
}
---
## Outcome
- Silas is treated as the culprit or primary suspect.
- Evelyn accelerates demolition, calling it public safety.
- Jessa's footprint evidence becomes a footnote instead of a timing clue.

## Design Purpose
This ending is not random failure. It is the consequence of choosing atmosphere over proof and accepting the body placement on the killer's terms.
