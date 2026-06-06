import { ItemTypeDefinition, LinkTypeDefinition, StoryEntity, StoryProject, StoryRelationship } from "../types";
import { migrateProjectShape } from "./story";

const MANIFEST_PATH = "storyteller.project.json";
const RELATIONSHIPS_PATH = "graph/relationships.json";
const BUNDLE_KIND = "storyteller.project.bundle";

interface ProjectManifestV1 {
  schemaVersion: 1;
  title: string;
  updatedAt: string;
  graphLayout: StoryProject["layout"];
  entityIndex: Array<{
    id: string;
    type: string;
    title: string;
    updatedAt: string;
    path: string;
  }>;
}

interface ProjectManifestV2 {
  schemaVersion: 2;
  title: string;
  updatedAt: string;
  itemTypes: ItemTypeDefinition[];
  linkTypes: LinkTypeDefinition[];
  graphLayout: StoryProject["layout"];
  entityIndex: Array<{
    id: string;
    type: string;
    title: string;
    updatedAt: string;
    path: string;
  }>;
}

interface RelationshipsFile {
  schemaVersion: 1 | 2;
  relationships: StoryRelationship[];
}

interface ProjectBundle {
  kind: typeof BUNDLE_KIND;
  exportedAt: string;
  files: Record<string, string>;
}

type ProjectManifest = ProjectManifestV1 | ProjectManifestV2;

export function buildProjectFiles(project: StoryProject): Record<string, string> {
  const files: Record<string, string> = {};
  const entities = Object.values(project.entities);
  const manifest: ProjectManifestV2 = {
    schemaVersion: 2,
    title: project.title,
    updatedAt: project.updatedAt,
    itemTypes: project.itemTypes,
    linkTypes: project.linkTypes,
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
    schemaVersion: 2,
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

  if (manifest.schemaVersion !== 1 && manifest.schemaVersion !== 2) {
    throw new Error("Unsupported or invalid StoryTeller project manifest");
  }

  const relationshipText = files[RELATIONSHIPS_PATH] ?? prettyJson({ schemaVersion: manifest.schemaVersion, relationships: [] });
  const relationshipFile = parseJson<RelationshipsFile>(relationshipText, "relationships file");
  const entities: StoryProject["entities"] = {};

  for (const indexedEntity of manifest.entityIndex) {
    const entityText = files[indexedEntity.path];

    if (!entityText) {
      throw new Error(`Missing entity file: ${indexedEntity.path}`);
    }

    const entity = parseEntityMarkdown(entityText);
    entities[entity.id] = entity;
  }

  return migrateProjectShape({
    schemaVersion: manifest.schemaVersion,
    title: manifest.title,
    updatedAt: manifest.updatedAt,
    itemTypes: manifest.schemaVersion === 2 ? manifest.itemTypes : undefined,
    linkTypes: manifest.schemaVersion === 2 ? manifest.linkTypes : undefined,
    entities,
    relationships: (relationshipFile.relationships ?? []).filter(
      (relationship) => entities[relationship.sourceId] && entities[relationship.targetId]
    ),
    layout: manifest.graphLayout ?? {}
  });
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

export function projectFromBundleText(text: string): StoryProject {
  const bundle = parseJson<ProjectBundle>(text, "project bundle");

  if (bundle.kind !== BUNDLE_KIND || !bundle.files) {
    throw new Error("The selected file is not a StoryTeller project bundle");
  }

  return projectFromFiles(bundle.files);
}

export async function projectFromBundleFile(file: File): Promise<StoryProject> {
  return projectFromBundleText(await file.text());
}

export function hasFolderProjectSupport(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export async function writeProjectToDirectory(
  project: StoryProject,
  directoryHandle: FileSystemDirectoryHandle
): Promise<void> {
  const files = buildProjectFiles(project);
  const previousManifest = await readExistingProjectManifest(directoryHandle);

  await removeStaleEntityFiles(directoryHandle, files, previousManifest);

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

async function readExistingProjectManifest(directoryHandle: FileSystemDirectoryHandle): Promise<ProjectManifest | null> {
  try {
    const manifest = parseJson<ProjectManifest>(await readTextPath(directoryHandle, MANIFEST_PATH), "project manifest");

    return (manifest.schemaVersion === 1 || manifest.schemaVersion === 2) && Array.isArray(manifest.entityIndex)
      ? manifest
      : null;
  } catch (error) {
    if (isMissingPathError(error) || isProjectManifestParseError(error)) {
      return null;
    }

    throw error;
  }
}

async function removeStaleEntityFiles(
  directoryHandle: FileSystemDirectoryHandle,
  files: Record<string, string>,
  previousManifest: ProjectManifest | null
): Promise<void> {
  if (!previousManifest || !directoryHandle.removeEntry) {
    return;
  }

  const nextEntityPaths = new Set(Object.keys(files).filter(isSafeEntityFilePath));

  for (const indexedEntity of previousManifest.entityIndex) {
    if (nextEntityPaths.has(indexedEntity.path) || !isSafeEntityFilePath(indexedEntity.path)) {
      continue;
    }

    await removeTextPathIfExists(directoryHandle, indexedEntity.path);
  }
}

async function removeTextPathIfExists(directoryHandle: FileSystemDirectoryHandle, path: string): Promise<void> {
  try {
    const parentParts = await removeTextPath(directoryHandle, path);
    await removeEmptyParentDirectories(directoryHandle, parentParts);
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error;
    }
  }
}

async function removeTextPath(directoryHandle: FileSystemDirectoryHandle, path: string): Promise<string[]> {
  const parts = path.split("/");
  const filename = parts.pop();

  if (!filename) {
    throw new Error(`Invalid file path: ${path}`);
  }

  let currentHandle = directoryHandle;

  for (const part of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(part);
  }

  if (currentHandle.removeEntry) {
    await currentHandle.removeEntry(filename);
  }

  return parts;
}

async function removeEmptyParentDirectories(
  directoryHandle: FileSystemDirectoryHandle,
  parentParts: string[]
): Promise<void> {
  for (let index = parentParts.length - 1; index >= 0; index -= 1) {
    const directoryName = parentParts[index];
    const containerParts = parentParts.slice(0, index);
    let currentHandle = directoryHandle;

    for (const part of containerParts) {
      currentHandle = await currentHandle.getDirectoryHandle(part);
    }

    if (!currentHandle.removeEntry) {
      return;
    }

    try {
      await currentHandle.removeEntry(directoryName);
    } catch (error) {
      if (!isMissingPathError(error) && !isNonEmptyDirectoryError(error)) {
        throw error;
      }
    }
  }
}

function isSafeEntityFilePath(path: string): boolean {
  const parts = path.split("/");

  return (
    parts.length >= 3 &&
    parts[0] === "entities" &&
    path.endsWith(".md") &&
    parts.every((part) => part.length > 0 && part !== "." && part !== "..")
  );
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

function isProjectManifestParseError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("Could not parse project manifest:");
}

function isMissingPathError(error: unknown): boolean {
  return errorName(error) === "NotFoundError";
}

function isNonEmptyDirectoryError(error: unknown): boolean {
  return errorName(error) === "InvalidModificationError";
}

function errorName(error: unknown): string {
  return typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
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
