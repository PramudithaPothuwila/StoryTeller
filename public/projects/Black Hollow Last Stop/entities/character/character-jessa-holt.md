---
{
  "id": "character-jessa-holt",
  "type": "character",
  "title": "Jessa Holt",
  "summary": "An urban explorer whose fresh footprints create a useful red herring.",
  "tags": [
    "suspect",
    "witness",
    "red-herring"
  ],
  "publicInfo": "Jessa sneaks into abandoned places for photos and dares, and she has posted images from Black Hollow Station before.",
  "privateInfo": "Jessa entered after the body was dumped. She saw a dark town car leave by the service road but ran before checking the body.",
  "createdAt": "2026-06-07T00:00:00.000Z",
  "updatedAt": "2026-06-21T00:00:00.000Z",
  "graphPresence": "world",
  "runtimeCharacter": {
    "goals": [
      "Avoid being punished for trespassing.",
      "Keep her scholarship and public image intact.",
      "Admit the service-road sighting only when it clearly matters."
    ],
    "attitude": -25,
    "emotionalState": "Scared, embarrassed, and trying to sound casual.",
    "communicationStyle": "Fast, defensive, and jokey when cornered.",
    "knownFactIds": [
      "fact-jessa-arrived-after-dump"
    ],
    "believedFactIds": [
      "fact-rowan-body-staged"
    ],
    "hiddenFactIds": [
      "fact-jessa-arrived-after-dump"
    ],
    "deceptionRules": [
      {
        "id": "deception-jessa-footprints",
        "condition": "Asked whether the fresh footprints are hers",
        "deceptionGoal": "Hide trespassing without inventing murder evidence.",
        "allowedStrategies": [
          "deny",
          "minimize"
        ],
        "forbiddenFactIds": [
          "fact-jessa-arrived-after-dump"
        ],
        "revealWhenEvidenceIds": [
          "evidence-fresh-footprints"
        ],
        "notes": "Her lie is a red herring, not a confession to violence."
      }
    ],
    "disclosureRules": [
      {
        "id": "disclosure-jessa-service-road-car",
        "condition": "Arden separates her footprints from the drag route",
        "revealFactIds": [
          "fact-jessa-arrived-after-dump"
        ],
        "requiredEvidenceIds": [
          "evidence-fresh-footprints",
          "evidence-drag-marks"
        ],
        "audience": "Expanded witness route",
        "notes": "Her sighting can support Evelyn route pressure without replacing the ledger proof."
      }
    ]
  }
}

---
## Planning Notes
- Jessa should initially lie about being at the station because trespassing could cost her scholarship.
- Her footprints should be real evidence but not murder evidence.
- She can become a midpoint witness if the story expands beyond this starter.

## Gameplay Use
- Use her prints to teach the player that clues can be true and still point to the wrong conclusion.
- Her service-road sighting can later strengthen the Evelyn route.
