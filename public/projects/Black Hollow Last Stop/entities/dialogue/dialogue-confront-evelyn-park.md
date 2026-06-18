---
{
  "id": "dialogue-confront-evelyn-park",
  "type": "dialogue",
  "title": "Dialogue: Confront Evelyn Park",
  "summary": "Final confrontation scene where the player either proves Evelyn's staging or accepts the Silas frame.",
  "tags": [
    "confrontation",
    "final-choice",
    "opposition"
  ],
  "publicInfo": "Evelyn controls redevelopment access and insists Rowan's death proves the station is too dangerous to preserve.",
  "privateInfo": "Evelyn is watching whether Arden has the ledger. Without it, she can redirect the case toward Silas and station folklore.",
  "createdAt": "2026-06-07T00:00:00.000Z",
  "updatedAt": "2026-06-07T00:00:00.000Z",
  "gameStory": {
    "role": "dialogue",
    "status": "ready",
    "criticalPath": true,
    "entryConditions": [],
    "exitEffects": [],
    "dialogue": {
      "lines": [
        {
          "id": "line-evelyn-dangerous-place",
          "speakerId": "character-evelyn-park",
          "text": "That station has been killing this town for forty years. Rowan is only the latest proof.",
          "tone": "controlled",
          "voiceNotes": "She uses civic language to make urgency sound like care."
        },
        {
          "id": "line-arden-body-moved",
          "speakerId": "character-detective-arden-pike",
          "text": "No. Rowan was moved there. The station is not your culprit. It is your hiding place.",
          "tone": "direct",
          "voiceNotes": "Use only if the body-dump theory has been established."
        }
      ],
      "responses": [],
      "variants": [
        {
          "id": "variant-ledger-found",
          "label": "Ledger found",
          "conditions": [
            {
              "id": "cond-variant-ledger-found",
              "variableId": "read-signal-ledger",
              "operator": "equals",
              "value": true
            }
          ],
          "lines": [
            {
              "id": "line-evelyn-ledger-slip",
              "speakerId": "character-evelyn-park",
              "text": "That ledger was supposed to be ash by now.",
              "tone": "fractured",
              "voiceNotes": "A single uncontrolled sentence."
            }
          ]
        }
      ]
    }
  },
  "graphPresence": "story_flow"
}
---
## Dialogue Goal
Make the final choice about proof, not intuition.

## Ending Branches
- Present the ledger and drag-route proof to accuse Evelyn.
- Name Silas if the ledger was not found and the station myth still dominates the case.

## Pressure
Evelyn should keep offering reasonable civic explanations until the ledger makes them too specific to survive.
