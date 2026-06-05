---
{
  "id": "event-dockside-eclipse",
  "type": "event",
  "title": "Dockside Eclipse",
  "summary": "The eclipse shipment exposes the rebel split and turns Sable's debt into real trust.",
  "tags": [
    "midpoint",
    "docks",
    "eclipse",
    "alliance"
  ],
  "publicInfo": "Blackwater goes silver under the eclipse while the Ember Choir sings the wrong verse on purpose.",
  "privateInfo": "The shipment is a trap for Tovan. Lysandra needs his lantern more than she needs Mara captured.",
  "createdAt": "2026-06-05T12:30:00.000Z",
  "updatedAt": "2026-06-05T12:30:00.000Z",
  "timeline": {
    "order": 3,
    "effects": [
      {
        "id": "effect-dockside-sable-knows-mara",
        "action": "update",
        "relationshipId": "link-mara-sable",
        "type": "knows",
        "label": "Trusts with a knife drawn",
        "notes": "Sable spends her escape money on a diversion and tells Mara the debt is not paid yet."
      },
      {
        "id": "effect-dockside-mara-member-ember",
        "action": "start",
        "relationshipId": "link-mara-ember",
        "sourceId": "character-mara-vale",
        "targetId": "faction-ember-choir",
        "type": "member_of",
        "label": "Tentative field ally",
        "notes": "Mara accepts the Choir's protection without promising them a crowned future."
      },
      {
        "id": "effect-dockside-causes-vault",
        "action": "start",
        "relationshipId": "link-dockside-vault",
        "sourceId": "event-dockside-eclipse",
        "targetId": "location-underclock-vault",
        "type": "causes",
        "label": "Reveals the Underclock route",
        "notes": "The bell shipment contains a route plate that lines up with Tovan's lantern."
      },
      {
        "id": "effect-dockside-lysandra-opposes-mara",
        "action": "start",
        "relationshipId": "link-lysandra-mara",
        "sourceId": "character-lysandra-veil",
        "targetId": "character-mara-vale",
        "type": "opposes",
        "label": "Names Mara as arsonist",
        "notes": "Lysandra pins the Market Fire on Mara and makes neutrality impossible."
      }
    ]
  }
}

---
## Scene Goal
Intercept the bell shipment before Lysandra's militia finds Tovan and the Lantern.

## Turn
Sable chooses Mara over her clean exit, and Mara accepts help from a rebel network she does not fully trust.

## Timeline Changes
Updates Sable and Mara, starts Mara's tentative Ember Choir membership, starts Lysandra's open opposition, and reveals the route to the Vault.
