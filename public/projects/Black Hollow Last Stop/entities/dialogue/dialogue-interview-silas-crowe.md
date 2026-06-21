---
{
  "id": "dialogue-interview-silas-crowe",
  "type": "dialogue",
  "title": "Dialogue: Interview Silas Crowe",
  "summary": "A suspect interview that can either unlock the key route or harden the false-frame path.",
  "tags": [
    "dialogue",
    "suspect-interview",
    "trust-gate"
  ],
  "publicInfo": "Silas Crowe knows the old station and has a visible emotional attachment to Platform 7.",
  "privateInfo": "Silas is not the killer. His guarded knowledge becomes useful only if Arden leads with the staging contradiction instead of accusation.",
  "createdAt": "2026-06-07T00:00:00.000Z",
  "updatedAt": "2026-06-07T00:00:00.000Z",
  "gameStory": {
    "role": "dialogue",
    "status": "ready",
    "criticalPath": true,
    "timelineAnchorId": "event-victim-was-arguing",
    "entryConditions": [],
    "exitEffects": [],
    "dialogue": {
      "lines": [
        {
          "id": "line-silas-platform-seven",
          "speakerId": "character-silas-crowe",
          "text": "People keep saying Platform Seven like it is a legend. It was paperwork first. Paperwork is what kills you slow.",
          "tone": "bitter",
          "voiceNotes": "Soft volume, precise words, no melodrama."
        },
        {
          "id": "line-arden-drag-marks",
          "speakerId": "character-detective-arden-pike",
          "text": "The marks run into the station, not away from it. Someone wanted me looking at your old pain.",
          "tone": "measured",
          "voiceNotes": "Evidence-first version of Arden."
        }
      ],
      "responses": [],
      "variants": [
        {
          "id": "variant-silas-alienated",
          "label": "Silas alienated",
          "conditions": [
            {
              "id": "cond-variant-silas-alienated",
              "variableId": "trust-silas",
              "operator": "equals",
              "value": "Alienated"
            }
          ],
          "lines": [
            {
              "id": "line-silas-shuts-down",
              "speakerId": "character-silas-crowe",
              "text": "You already wrote my name. Do not ask me to hold the pen steady.",
              "tone": "cold",
              "voiceNotes": "Short and final."
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
Make Silas feel like an obvious suspect and a possible key witness at the same time.

## Branch Choices
- Show Silas the drag-mark contradiction to earn trust and the key.
- Accuse Silas to keep pressure high but lose access to his help.

## Information To Reveal
- Rowan asked about Locker 12 two days before the murder.
- Platform 7 matters because of old reports, not because of a station legend.
