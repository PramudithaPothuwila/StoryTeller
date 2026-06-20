import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject, createStoryEntity } from "./story";
import { openCloudProject, requestAgentPlan, serializeCloudProject } from "./cloudProjects";

const { supabaseClientMock, projectsQueryMock } = vi.hoisted(() => {
  const query: Record<string, unknown> = {};

  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.is = vi.fn(() => query);
  query.single = vi.fn();

  return {
    projectsQueryMock: query as {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      is: ReturnType<typeof vi.fn>;
      single: ReturnType<typeof vi.fn>;
    },
    supabaseClientMock: {
      functions: {
        invoke: vi.fn()
      },
      from: vi.fn(() => query)
    }
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => supabaseClientMock)
}));

describe("cloud project storage", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test-key");
    vi.clearAllMocks();
  });

  it("serializes canonical StoryProject JSON without virtual folder files", () => {
    const project = createBlankProject("Cloud Canon");
    const payload = serializeCloudProject(project);

    expect(payload).toEqual(project);
    expect(payload).not.toHaveProperty("files");
    expect(JSON.stringify(payload)).not.toContain("storyteller.project.json");
    expect(JSON.stringify(payload)).not.toContain("graph/relationships.json");
  });

  it("migrates cloud project_json when opening a project row", async () => {
    projectsQueryMock.single.mockResolvedValue({
      data: {
        id: "cloud-project-1",
        title: "Legacy Cloud",
        schema_version: 1,
        project_mode: "story",
        project_json: {
          schemaVersion: 1,
          title: "Legacy Cloud",
          updatedAt: "2026-01-01T00:00:00.000Z",
          entities: {},
          relationships: [],
          layout: {}
        },
        version: 7,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z"
      },
      error: null
    });

    const result = await openCloudProject("cloud-project-1");

    expect(supabaseClientMock.from).toHaveBeenCalledWith("projects");
    expect(projectsQueryMock.eq).toHaveBeenCalledWith("id", "cloud-project-1");
    expect(result.project.schemaVersion).toBe(6);
    expect(result.project.title).toBe("Legacy Cloud");
    expect(result.version).toBe(7);
  });

  it("invokes the cloud agent function with project and prompt", async () => {
    const project = createBlankProject("Agent Cloud");
    const hero = createStoryEntity("character", project.itemTypes, "Cloud Hero");
    project.entities[hero.id] = hero;
    supabaseClientMock.functions.invoke.mockResolvedValue({
      data: {
        output_text: "{\"summary\":\"Done\",\"assumptions\":[],\"changes\":[],\"followUpQuestions\":[]}"
      },
      error: null
    });

    const result = await requestAgentPlan(project, "Add a rival.");

    expect(supabaseClientMock.functions.invoke).toHaveBeenCalledWith("agent", {
      body: {
        project: expect.objectContaining({
          title: "Agent Cloud",
          entities: [expect.objectContaining({ id: hero.id, title: "Cloud Hero" })],
          relationships: []
        }),
        prompt: "Add a rival."
      }
    });
    expect(result).toEqual({
      output_text: "{\"summary\":\"Done\",\"assumptions\":[],\"changes\":[],\"followUpQuestions\":[]}"
    });
  });

  it("surfaces cloud agent function errors", async () => {
    supabaseClientMock.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Sign in before using the agent."
      }
    });

    await expect(requestAgentPlan(createBlankProject("Agent Error"), "Help")).rejects.toThrow(
      "Sign in before using the agent."
    );
  });
});
