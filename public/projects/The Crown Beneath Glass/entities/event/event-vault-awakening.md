---
{
  "id": "event-vault-awakening",
  "type": "event",
  "title": "Vault Awakening",
  "summary": "The Underclock opens, the Crown chooses consent over command, and Lysandra betrays her own council.",
  "tags": [
    "climax",
    "vault",
    "choice",
    "betrayal"
  ],
  "publicInfo": "The city bells stop for thirteen breaths while a blue route appears under the canals.",
  "privateInfo": "The Vault asks for a remembered truth. Orin offers his crime. Mara refuses to let the city build dawn on another erasure.",
  "createdAt": "2026-06-05T12:30:00.000Z",
  "updatedAt": "2026-06-05T12:30:00.000Z",
  "timeline": {
    "order": 4,
    "effects": [
      {
        "id": "effect-vault-end-lysandra-hides-crown",
        "action": "end",
        "relationshipId": "link-lysandra-crown"
      },
      {
        "id": "effect-vault-lysandra-betrays-accord",
        "action": "update",
        "relationshipId": "link-lysandra-accord",
        "type": "betrays",
        "label": "Betrays the Accord",
        "notes": "Lysandra locks out the reform ministers and orders the militia to fire on witnesses."
      },
      {
        "id": "effect-vault-mara-owns-crown",
        "action": "start",
        "relationshipId": "link-mara-crown",
        "sourceId": "character-mara-vale",
        "targetId": "item-hidden-crown",
        "type": "owns",
        "label": "Wakes the Crown",
        "notes": "The Crown answers Mara after she asks the crowd what they want remembered."
      },
      {
        "id": "effect-vault-causes-coronation",
        "action": "start",
        "relationshipId": "link-vault-coronation",
        "sourceId": "event-vault-awakening",
        "targetId": "event-coronation-at-dawn",
        "type": "causes",
        "label": "Makes dawn unavoidable",
        "notes": "The Vault projects the hidden record across every mirror in the Glass Quarter."
      },
      {
        "id": "effect-vault-orin-protects-choice",
        "action": "update",
        "relationshipId": "link-orin-mara",
        "type": "protects",
        "label": "Keeps the secret until Mara chooses",
        "notes": "Orin stops managing the truth and guards Mara while she decides how much to reveal."
      }
    ]
  },
  "graphPresence": "world"
}
---
## Scene Goal
Reach the Vault before Lysandra can use Tovan's Lantern to aim the Crown at the crowd.

## Turn
The Crown wakes for Mara only after she refuses to command it.

## Timeline Changes
Ends Lysandra hiding the Crown, updates Lysandra's relationship to the Accord into betrayal, starts Mara owning the Crown, and pushes the story into the dawn reckoning.
