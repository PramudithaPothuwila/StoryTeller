import { describe, expect, it } from "vitest";
import { createStarterProject } from "./story";
import { buildProjectFiles, parseEntityMarkdown, projectFromFiles, serializeEntityMarkdown } from "./projectFiles";

describe("project file model", () => {
  it("creates the planned folder project files and restores the project", () => {
    const project = createStarterProject();
    const files = buildProjectFiles(project);
    const restoredProject = projectFromFiles(files);

    expect(files["storyteller.project.json"]).toBeTruthy();
    expect(files["graph/relationships.json"]).toBeTruthy();
    expect(Object.keys(files).some((path) => path.startsWith("entities/character/"))).toBe(true);
    expect(Object.keys(restoredProject.entities)).toHaveLength(Object.keys(project.entities).length);
    expect(restoredProject.relationships).toHaveLength(project.relationships.length);
    expect(restoredProject.layout).toEqual(project.layout);
  });

  it("keeps private entity information out of markdown body text", () => {
    const entity = Object.values(createStarterProject().entities).find((item) => item.privateInfo)!;
    const markdown = serializeEntityMarkdown(entity);
    const restoredEntity = parseEntityMarkdown(markdown);

    expect(restoredEntity.privateInfo).toBe(entity.privateInfo);
    expect(restoredEntity.bodyMarkdown).toBe(entity.bodyMarkdown);
  });

  it("raises a recoverable parsing error for invalid project files", () => {
    expect(() => projectFromFiles({})).toThrow(/storyteller\.project\.json/);
    expect(() =>
      projectFromFiles({
        "storyteller.project.json": "{not-json"
      })
    ).toThrow(/Could not parse project manifest/);
  });
});
