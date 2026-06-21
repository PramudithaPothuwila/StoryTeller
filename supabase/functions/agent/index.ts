import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const DEFAULT_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_NVIDIA_MODEL = "meta/llama-3.2-1b-instruct";
type AgentMode = "story" | "runtime_authoring";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const token = readBearerToken(request.headers.get("Authorization"));

  if (!token) {
    return jsonResponse({ error: "Sign in before using the agent." }, 401);
  }

  const authClient = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_ANON_KEY"), {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);

  if (userError || !userData.user) {
    return jsonResponse({ error: "Sign in before using the agent." }, 401);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  if (!isRecord(body) || !isRecord(body.project) || typeof body.prompt !== "string" || !body.prompt.trim()) {
    return jsonResponse({ error: "Request body must include project and prompt." }, 400);
  }

  const nvidiaApiKey = Deno.env.get("NVIDIA_API_KEY");

  if (!nvidiaApiKey) {
    return jsonResponse({ error: "Agent backend is not configured. Set NVIDIA_API_KEY in the Supabase Edge Function environment." }, 502);
  }

  const baseUrl = (Deno.env.get("NVIDIA_BASE_URL") || DEFAULT_NVIDIA_BASE_URL).replace(/\/+$/, "");
  const model = Deno.env.get("NVIDIA_MODEL") || DEFAULT_NVIDIA_MODEL;
  const agentMode = readAgentMode(body);

  try {
    const openai = new OpenAI({
      apiKey: nvidiaApiKey,
      baseURL: baseUrl
    });
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: buildNvidiaSystemPrompt(agentMode)
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              task: body.prompt.trim(),
              agentMode,
              project: body.project
            },
            null,
            2
          )
        }
      ],
      temperature: 0,
      top_p: 0.95,
      max_tokens: 4096,
      frequency_penalty: 0,
      presence_penalty: 0,
      response_format: { type: "json_object" },
      stream: false
    });

    return jsonResponse(completion, 200);
  } catch (error) {
    return jsonResponse({ error: agentErrorMessage(error) }, 502);
  }
});

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function readBearerToken(value: string | null): string {
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readAgentMode(body: Record<string, unknown>): AgentMode {
  const options = isRecord(body.options) ? body.options : {};
  const project = isRecord(body.project) ? body.project : {};
  const mode = options.mode ?? project.agentMode;

  return mode === "runtime_authoring" ? "runtime_authoring" : "story";
}

function agentErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "NVIDIA request failed.";
}

function buildNvidiaSystemPrompt(mode: AgentMode): string {
  const sharedInstructions = [
    "detailed thinking off",
    "You must return a single valid JSON object and nothing else.",
    "Do not explain, summarize in Markdown, use headings, or include prose before or after the JSON.",
    "You are the in-app AI story agent for StoryTeller, a local-first story planning workspace.",
    "Preserve the user's creative intent. Suggest focused structural edits instead of rewriting the whole story.",
    "Return only a structured change plan matching the supplied schema.",
    "The top-level JSON object must include exactly these fields: summary, assumptions, changes, followUpQuestions.",
    "Use this top-level shape:",
    JSON.stringify({
      summary: "Short human-readable summary.",
      assumptions: ["Short assumption strings."],
      changes: [],
      followUpQuestions: ["Short follow-up question strings."]
    }),
    "Each changes item must use one of these operation shapes:"
  ];

  if (mode === "runtime_authoring") {
    return [
      ...sharedInstructions,
      "Runtime records live in project.runtime, not project.entities.",
      "Never use create_entity, update_entity, create_relationship, or update_relationship for facts, evidence, character knowledge, contradiction rules, or theory rules.",
      "Use runtime CRUD operations only. Story entity and relationship operations are not allowed in runtime_authoring mode.",
      "Runtime deletes are allowed only for runtime records. Never delete story entities or relationships.",
      "Use stable kebab-case IDs for new runtime records.",
      JSON.stringify([
        {
          operation: "create_runtime_fact",
          summary: "Create a runtime fact.",
          fact: {
            id: "fact-ledger-forged",
            statement: "The ledger was forged.",
            truth: "true",
            subjectEntityId: "optional-existing-entity-id",
            objectEntityId: "optional-existing-entity-id",
            sourceEntityIds: ["optional-existing-entity-id"],
            sourceNotes: "Author-only provenance.",
            tags: ["optional-tag"],
            notes: "Author-only runtime notes."
          }
        },
        {
          operation: "update_runtime_evidence",
          summary: "Link evidence to facts.",
          id: "existing-evidence-id",
          patch: {
            factIds: ["existing-or-new-fact-id"],
            sourceEntityIds: ["optional-existing-entity-id"],
            sourceNotes: "Author-only provenance."
          }
        },
        {
          operation: "create_runtime_character_knowledge",
          summary: "Create character knowledge.",
          knowledge: {
            id: "knowledge-arden-drag-marks",
            characterId: "existing-character-id",
            factId: "existing-or-new-fact-id",
            knowledge: "knows",
            belief: "believes_true",
            evidenceIds: ["optional-existing-evidence-id"],
            notes: "Author-only notes."
          }
        },
        {
          operation: "update_runtime_contradiction",
          summary: "Update a contradiction rule.",
          id: "existing-contradiction-id",
          patch: {
            factIds: ["existing-or-new-fact-id"],
            severity: "warning",
            resolution: "How authors should resolve the contradiction."
          }
        },
        {
          operation: "update_runtime_theory_rule",
          summary: "Update a theory rule.",
          id: "existing-theory-rule-id",
          patch: {
            requiredEvidenceIds: ["existing-or-new-evidence-id"],
            supportingFactIds: ["existing-or-new-fact-id"],
            contradictingFactIds: ["existing-or-new-fact-id"],
            conclusion: "Player-facing theory conclusion.",
            playerVisibility: "discoverable"
          }
        },
        {
          operation: "delete_runtime_fact",
          summary: "Delete a runtime fact.",
          id: "existing-fact-id"
        }
      ]),
      "If no valid runtime change is needed, return an empty changes array."
    ].join("\n");
  }

  return [
    ...sharedInstructions,
    "Do not include destructive operations. Do not delete entities, relationships, files, or raw project data.",
    "Use existing item and link type IDs from the project context. Use stable kebab-case IDs for new entities and relationships.",
    "Every create_entity operation must include entity.id, entity.type, and entity.title.",
    "Every create_relationship operation must include relationship.id, sourceId, targetId, and type.",
    "Use privateInfo for author-only secrets and publicInfo for audience/player-facing facts.",
    "For game-story projects, use graphPresence to place each item in the world graph, story_flow graph, or both.",
    JSON.stringify([
      {
        operation: "create_entity",
        summary: "Create an entity.",
        entity: {
          id: "kebab-case-id",
          type: "existing-item-type-id",
          title: "Entity title",
          summary: "Optional short summary",
          publicInfo: "Optional player-facing facts",
          privateInfo: "Optional author-only secrets"
        }
      },
      {
        operation: "update_entity",
        summary: "Update an entity.",
        id: "existing-entity-id",
        patch: {
          summary: "Updated summary"
        }
      },
      {
        operation: "create_relationship",
        summary: "Create a relationship.",
        relationship: {
          id: "kebab-case-id",
          sourceId: "existing-or-new-entity-id",
          targetId: "existing-or-new-entity-id",
          type: "existing-link-type-id",
          label: "Optional label",
          notes: "Optional notes"
        }
      },
      {
        operation: "update_relationship",
        summary: "Update a relationship.",
        id: "existing-relationship-id",
        patch: {
          notes: "Updated notes"
        }
      },
      {
        operation: "add_timeline_effect",
        summary: "Add a timeline effect.",
        eventId: "existing-event-id",
        effect: {
          action: "end",
          relationshipId: "existing-relationship-id"
        }
      },
      {
        operation: "update_game_story",
        summary: "Update game story metadata.",
        patch: {}
      }
    ]),
    "If no valid structural change is needed, return an empty changes array."
  ].join("\n");
}
