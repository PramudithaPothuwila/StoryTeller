---
{
  "id": "quest-prove-station-staged",
  "type": "quest",
  "title": "Quest: Prove the Station Was Staged",
  "summary": "Main investigation quest for proving the station is a deliberate body dump, not the primary murder location.",
  "tags": [
    "main-quest",
    "body-dump",
    "investigation"
  ],
  "publicInfo": "Arden tests the drag marks, footprints, and body placement against the theory that Rowan was moved into the station.",
  "privateInfo": "This quest is the bridge from physical contradiction to motive. It should aim the player toward Silas, the signal room, and the hidden ledger.",
  "createdAt": "2026-06-07T00:00:00.000Z",
  "updatedAt": "2026-06-07T00:00:00.000Z",
  "gameStory": {
    "role": "quest",
    "status": "ready",
    "criticalPath": true,
    "entryConditions": [],
    "exitEffects": [],
    "quest": {
      "questType": "main",
      "objectives": [
        {
          "id": "objective-identify-body-dump",
          "text": "Confirm the drag marks contradict the station-as-murder-site theory.",
          "optional": false,
          "hidden": false,
          "completeConditions": [
            {
              "id": "cond-objective-body-dump",
              "variableId": "recognized-body-dump",
              "operator": "equals",
              "value": true
            }
          ]
        },
        {
          "id": "objective-find-locker-key",
          "text": "Find a way into Locker 12.",
          "optional": false,
          "hidden": false,
          "completeConditions": [
            {
              "id": "cond-objective-locker-key",
              "variableId": "found-locker-key",
              "operator": "equals",
              "value": true
            }
          ]
        },
        {
          "id": "objective-read-ledger",
          "text": "Recover the Signal Room Ledger.",
          "optional": false,
          "hidden": false,
          "completeConditions": [
            {
              "id": "cond-objective-ledger",
              "variableId": "read-signal-ledger",
              "operator": "equals",
              "value": true
            }
          ]
        }
      ],
      "successConditions": [
        {
          "id": "cond-quest-success-ledger",
          "variableId": "read-signal-ledger",
          "operator": "equals",
          "value": true
        }
      ],
      "failureConditions": [],
      "rewards": "Unlocks the strongest confrontation route against Evelyn Park.",
      "consequences": "Skipping the ledger leaves the player vulnerable to the Silas frame."
    }
  },
  "graphPresence": "story_flow"
}

---
## Quest Shape
- Physical proof first: drag direction and body placement.
- Witness pressure second: Silas knows why Locker 12 matters.
- Documentary proof third: the ledger turns suspicion into motive.

## Concrete Consequences
- Evidence-first play can earn Silas's trust and the key.
- Suspect-first play can still reach Evelyn, but without the strongest proof.
