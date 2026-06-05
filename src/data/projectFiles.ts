import { StoryEntity, StoryProject, StoryRelationship } from "../types";
import { createBlankProject } from "./story";

const MANIFEST_PATH = "storyteller.project.json";
const RELATIONSHIPS_PATH = "graph/relationships.json";
const BUNDLE_KIND = "storyteller.project.bundle";

interface ProjectManifest {
  schemaVersion: 1;
  title: string;
  updatedAt: string;
  graphLayout: StoryProject["layout"];
  entityIndex: Array<{
    id: string;
    type: StoryEntity["type"];
    title: string;
    updatedAt: string;
    path: string;
  }>;
}

interface RelationshipsFile {
  schemaVersion: 1;
  relationships: StoryRelationship[];
}

interface ProjectBundle {
  kind: typeof BUNDLE_KIND;
  exportedAt: string;
  files: Record<string, string>;
}

export function buildProjectFiles(project: StoryProject): Record<string, string> {
  const files: Record<string, string> = {};
  const entities = Object.values(project.entities);
  const manifest: ProjectManifest = {
    schemaVersion: 1,
    title: project.title,
    updatedAt: project.updatedAt,
    graphLayout: project.layout,
    entityIndex: entities.map((entity) => ({
      id: entity.id,
      type: entity.type,
      title: entity.title,
      updatedAt: entity.updatedAt,
      path: entityPath(entity)
    }))
  };
  const relationships: RelationshipsFile = {
    schemaVersion: 1,
    relationships: project.relationships
  };

  files[MANIFEST_PATH] = prettyJson(manifest);
  files[RELATIONSHIPS_PATH] = prettyJson(relationships);

  for (const entity of entities) {
    files[entityPath(entity)] = serializeEntityMarkdown(entity);
  }

  return files;
}

export function projectFromFiles(files: Record<string, string>): StoryProject {
  const manifestText = files[MANIFEST_PATH];

  if (!manifestText) {
    throw new Error("Missing storyteller.project.json");
  }

  const manifest = parseJson<ProjectManifest>(manifestText, "project manifest");

  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.entityIndex)) {
    throw new Error("Unsupported or invalid StoryTeller project manifest");
  }

  const relationshipText = files[RELATIONSHIPS_PATH] ?? prettyJson({ schemaVersion: 1, relationships: [] });
  const relationshipFile = parseJson<RelationshipsFile>(relationshipText, "relationships file");
  const project = createBlankProject(manifest.title || "Untitled Story");
  const entities: StoryProject["entities"] = {};

  for (const indexedEntity of manifest.entityIndex) {
    const entityText = files[indexedEntity.path];

    if (!entityText) {
      throw new Error(`Missing entity file: ${indexedEntity.path}`);
    }

    const entity = parseEntityMarkdown(entityText);
    entities[entity.id] = entity;
  }

  return {
    ...project,
    title: manifest.title || project.title,
    updatedAt: manifest.updatedAt || project.updatedAt,
    entities,
    relationships: (relationshipFile.relationships ?? []).filter(
      (relationship) => entities[relationship.sourceId] && entities[relationship.targetId]
    ),
    layout: manifest.graphLayout ?? {}
  };
}

export function serializeEntityMarkdown(entity: StoryEntity): string {
  const { bodyMarkdown, ...metadata } = entity;

  return `---\n${prettyJson(metadata)}\n---\n${bodyMarkdown.trimEnd()}\n`;
}

export function parseEntityMarkdown(markdown: string): StoryEntity {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!match) {
    throw new Error("Entity file is missing JSON frontmatter");
  }

  const metadata = parseJson<Omit<StoryEntity, "bodyMarkdown">>(match[1], "entity frontmatter");

  return {
    ...metadata,
    bodyMarkdown: match[2].trimEnd()
  };
}

export function createProjectBundle(project: StoryProject): Blob {
  const bundle: ProjectBundle = {
    kind: BUNDLE_KIND,
    exportedAt: new Date().toISOString(),
    files: buildProjectFiles(project)
  };

  return new Blob([prettyJson(bundle)], { type: "application/json" });
}

export async function projectFromBundleFile(file: File): Promise<StoryProject> {
  const bundle = parseJson<ProjectBundle>(await file.text(), "project bundle");

  if (bundle.kind !== BUNDLE_KIND || !bundle.files) {
    throw new Error("The selected file is not a StoryTeller project bundle");
  }

  return projectFromFiles(bundle.files);
}

export function hasFolderProjectSupport(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export async function writeProjectToDirectory(
  project: StoryProject,
  directoryHandle: FileSystemDirectoryHandle
): Promise<void> {
  const files = buildProjectFiles(project);

  for (const [path, content] of Object.entries(files)) {
    await writeTextPath(directoryHandle, path, content);
  }
}

export async function readProjectFromDirectory(directoryHandle: FileSystemDirectoryHandle): Promise<StoryProject> {
  const manifest = parseJson<ProjectManifest>(
    await readTextPath(directoryHandle, MANIFEST_PATH),
    "project manifest"
  );
  const files: Record<string, string> = {
    [MANIFEST_PATH]: prettyJson(manifest),
    [RELATIONSHIPS_PATH]: await readTextPath(directoryHandle, RELATIONSHIPS_PATH)
  };

  for (const indexedEntity of manifest.entityIndex) {
    files[indexedEntity.path] = await readTextPath(directoryHandle, indexedEntity.path);
  }

  return projectFromFiles(files);
}

function entityPath(entity: StoryEntity): string {
  return `entities/${entity.type}/${entity.id}.md`;
}

function parseJson<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`Could not parse ${label}: ${(error as Error).message}`);
  }
}

function prettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeTextPath(
  directoryHandle: FileSystemDirectoryHandle,
  path: string,
  content: string
): Promise<void> {
  const parts = path.split("/");
  const filename = parts.pop();

  if (!filename) {
    throw new Error(`Invalid file path: ${path}`);
  }

  let currentHandle = directoryHandle;

  for (const part of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
  }

  const fileHandle = await currentHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function readTextPath(directoryHandle: FileSystemDirectoryHandle, path: string): Promise<string> {
  const parts = path.split("/");
  const filename = parts.pop();

  if (!filename) {
    throw new Error(`Invalid file path: ${path}`);
  }

  let currentHandle = directoryHandle;

  for (const part of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(part);
  }

  const fileHandle = await currentHandle.getFileHandle(filename);
  return fileHandle.getFile().then((file) => file.text());
}
