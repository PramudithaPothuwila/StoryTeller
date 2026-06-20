import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_NVIDIA_MODEL = "nvidia/llama-3.1-nemotron-nano-8b-v1";

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
    return jsonResponse({ error: "Agent backend is not configured." }, 502);
  }

  const baseUrl = (Deno.env.get("NVIDIA_BASE_URL") || DEFAULT_NVIDIA_BASE_URL).replace(/\/+$/, "");
  const model = Deno.env.get("NVIDIA_MODEL") || DEFAULT_NVIDIA_MODEL;
  const nvidiaResponse = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${nvidiaApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
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
      stream: false
    })
  });

  const responseText = await nvidiaResponse.text();

  if (!nvidiaResponse.ok) {
    return jsonResponse(
      {
        error: responseText || `NVIDIA request failed with status ${nvidiaResponse.status}`
      },
      502
    );
  }

  return new Response(responseText, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": nvidiaResponse.headers.get("Content-Type") || "application/json"
    }
  });
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

function buildNvidiaSystemPrompt(): string {
  return [
    "detailed thinking off",
    "You are the in-app AI story agent for StoryTeller, a local-first story planning workspace.",
    "Preserve the user's creative intent. Suggest focused structural edits instead of rewriting the whole story.",
    "Return only a structured change plan matching the supplied schema.",
    "Do not include destructive operations. Do not delete entities, relationships, files, or raw project data.",
    "Use existing item and link type IDs from the project context. Use stable kebab-case IDs for new entities and relationships.",
    "Every create_entity operation must include entity.id, entity.type, and entity.title.",
    "Every create_relationship operation must include relationship.id, sourceId, targetId, and type.",
    "Use privateInfo for author-only secrets and publicInfo for audience/player-facing facts.",
    "For game-story projects, use graphPresence to place each item in the world graph, story_flow graph, or both.",
    "Return only valid JSON. Do not wrap it in Markdown fences.",
    "The JSON must include summary, assumptions, changes, and followUpQuestions fields."
  ].join("\n");
}
