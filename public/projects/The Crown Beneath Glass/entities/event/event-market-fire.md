---
{
  "id": "event-market-fire",
  "type": "event",
  "title": "Market Fire",
  "summary": "A staged riot that burns Mara's delivery route and scatters the first clues into public view.",
  "tags": [
    "inciting-incident",
    "fire",
    "public-chaos",
    "timeline"
  ],
  "publicInfo": "The west market catches fire during the noon bell, and witnesses swear they saw a crown in the smoke.",
  "privateInfo": "Lysandra uses the fire to flush out hidden loyalists. The Crown itself causes the blue flare when it rejects her handler.",
  "createdAt": "2026-06-05T12:30:00.000Z",
  "updatedAt": "2026-06-05T12:30:00.000Z",
  "timeline": {
    "order": 1,
    "effects": [
      {
        "id": "effect-market-orin-hides-mara",
        "action": "start",
        "relationshipId": "link-orin-mara",
        "sourceId": "character-orin-ash",
        "targetId": "character-mara-vale",
        "type": "hides",
        "label": "Hides Mara's bloodline",
        "notes": "Orin pulls Mara from the square before Lysandra's clerks can mark her birth sign."
      },
      {
        "id": "effect-market-lysandra-hides-crown",
        "action": "start",
        "relationshipId": "link-lysandra-crown",
        "sourceId": "character-lysandra-veil",
        "targetId": "item-hidden-crown",
        "type": "hides",
        "label": "Frames the Crown as lost",
        "notes": "Lysandra moves the Crown through the panic and lets the public blame rebels."
      },
      {
        "id": "effect-market-fire-causes-mara",
        "action": "start",
        "relationshipId": "link-market-fire-mara",
        "sourceId": "event-market-fire",
        "targetId": "character-mara-vale",
        "type": "causes",
        "label": "Forces Mara into the conspiracy",
        "notes": "The fire destroys Mara's ordinary route and leaves her with no neutral path."
      },
      {
        "id": "effect-crown-causes-fire",
        "action": "start",
        "relationshipId": "link-crown-market-fire",
        "sourceId": "item-hidden-crown",
        "targetId": "event-market-fire",
        "type": "causes",
        "label": "Ignites the false riot",
        "notes": "A handler tries to command the Crown and triggers the blue flare."
      }
    ]
  },
  "graphPresence": "world"
}
---
## Scene Goal
Mara wants to deliver a sealed letter. Orin wants her out of the square. Lysandra wants a crowd frightened enough to accept emergency rule.

## Turn
The Mirror Shard is found in ash that should still be hot but is cold enough to frost Mara's fingers.

## Timeline Changes
Starts the Orin hides Mara relationship, starts Lysandra hiding the Crown, and creates the causal chain from Crown to fire to Mara.
