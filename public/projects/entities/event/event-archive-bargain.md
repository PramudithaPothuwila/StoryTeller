---
{
  "id": "event-archive-bargain",
  "type": "event",
  "title": "Archive Bargain",
  "summary": "Mara, Orin, and Sable break into the flooded archive and trade secrets for air.",
  "tags": [
    "act-one-turn",
    "archive",
    "bargain",
    "relationship-update"
  ],
  "publicInfo": "A burglary disguised as a genealogy appointment turns into a rescue when the lower shelves flood.",
  "privateInfo": "Orin planned to destroy the Ledger. Sable steals it first, forcing him to tell Mara enough truth to keep breathing.",
  "createdAt": "2026-06-05T12:30:00.000Z",
  "updatedAt": "2026-06-05T12:30:00.000Z",
  "timeline": {
    "order": 2,
    "effects": [
      {
        "id": "effect-archive-orin-protects-mara",
        "action": "update",
        "relationshipId": "link-orin-mara",
        "type": "protects",
        "label": "Confesses and protects",
        "notes": "Orin admits he erased Mara's record and shifts from gatekeeper to guard."
      },
      {
        "id": "effect-archive-sable-owes-mara",
        "action": "start",
        "relationshipId": "link-mara-sable",
        "sourceId": "character-sable-reed",
        "targetId": "character-mara-vale",
        "type": "owes",
        "label": "Sable owes Mara a clean escape",
        "notes": "Mara cuts Sable free from a sinking bell jar instead of taking the Ledger and running."
      },
      {
        "id": "effect-archive-shard-decodes-ledger",
        "action": "start",
        "relationshipId": "link-mirror-shard-ledger",
        "sourceId": "clue-mirror-shard",
        "targetId": "item-moonlit-ledger",
        "type": "decodes",
        "label": "Decodes the ledger margin",
        "notes": "The shard reveals the fifth name in every crossed-out inheritance line."
      },
      {
        "id": "effect-archive-causes-dockside",
        "action": "start",
        "relationshipId": "link-archive-dockside",
        "sourceId": "event-archive-bargain",
        "targetId": "event-dockside-eclipse",
        "type": "causes",
        "label": "Points to the eclipse shipment",
        "notes": "The Ledger names a bell shipment arriving during the eclipse."
      }
    ]
  }
}

---
## Scene Goal
Get the Moonlit Ledger, escape the flood bells, and decide whether Sable is thief, ally, or both.

## Turn
Orin's lie changes shape: from hiding Mara to actively protecting her choice.

## Timeline Changes
Updates Orin and Mara, starts Sable's debt, decodes the Mirror Shard, and points the plot toward Blackwater Docks.
