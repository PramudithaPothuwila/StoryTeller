import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const DEFAULT_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_NVIDIA_MODEL = "meta/llama-3.2-1b-instruct";

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
          content: buildNvidiaSystemPrompt()
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              task: body.prompt.trim(),
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

function agentErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "NVIDIA request failed.";
}

function buildNvidiaSystemPrompt(): string {
  return [
    "detailed thinking off",
    "You must return a single valid JSON object and nothing else.",
    "Do not explain, summarize in Markdown, use headings, or include prose before or after the JSON.",
    "You are the in-app AI story agent for StoryTeller, a local-first story planning workspace.",
    "Preserve the user's creative intent. Suggest focused structural edits instead of rewriting the whole story.",
    "Return only a structured change plan matching the supplied schema.",
    "Do not include destructive operations. Do not delete entities, relationships, files, or raw project data.",
    "Use existing item and link type IDs from the project context. Use stable kebab-case IDs for new entities and relationships.",
    "Every create_entity operation must include entity.id, entity.type, and entity.title.",
    "Every create_relationship operation must include relationship.id, sourceId, targetId, and type.",
    "Use privateInfo for author-only secrets and publicInfo for audience/player-facing facts.",
    "For game-story projects, use graphPresence to place each item in the world graph, story_flow graph, or both.",
    "The top-level JSON object must include exactly these fields: summary, assumptions, changes, followUpQuestions.",
    "Use this top-level shape:",
    JSON.stringify({
      summary: "Short human-readable summary.",
      assumptions: ["Short assumption strings."],
      changes: [],
      followUpQuestions: ["Short follow-up question strings."]
    }),
    "Each changes item must use one of these operation shapes:",
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
