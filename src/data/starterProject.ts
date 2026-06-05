import { projectFromFiles } from "./projectFiles";
import { createBlankProject } from "./story";
import { StoryProject } from "../types";

const STARTER_PROJECT_ROOT = "/projects";
const STARTER_PROJECT_MANIFEST = "storyteller.project.json";
const STARTER_PROJECT_RELATIONSHIPS = "graph/relationships.json";

interface StarterProjectManifest {
  entityIndex?: Array<{
    path?: string;
  }>;
}

export async function loadStarterProject(fetchProject = fetch): Promise<StoryProject> {
  const manifestText = await fetchStarterFile(fetchProject, STARTER_PROJECT_MANIFEST);
  const manifest = parseStarterManifest(manifestText);
  const files: Record<string, string> = {
    [STARTER_PROJECT_MANIFEST]: manifestText,
    [STARTER_PROJECT_RELATIONSHIPS]: await fetchStarterFile(fetchProject, STARTER_PROJECT_RELATIONSHIPS)
  };

  for (const indexedEntity of manifest.entityIndex ?? []) {
    if (!indexedEntity.path) {
      throw new Error("Could not load starter project: entity path is missing");
    }

    files[indexedEntity.path] = await fetchStarterFile(fetchProject, indexedEntity.path);
  }

  return projectFromFiles(files);
}

export function createLoadingProject(): StoryProject {
  return createBlankProject("Loading Story...");
}

async function fetchStarterFile(fetchProject: typeof fetch, path: string): Promise<string> {
  const response = await fetchProject(starterProjectUrl(path));

  if (!response.ok) {
    throw new Error(`Could not load starter project file ${path}: ${response.status}`);
  }

  return response.text();
}

function parseStarterManifest(manifestText: string): StarterProjectManifest {
  try {
    return JSON.parse(manifestText) as StarterProjectManifest;
  } catch (error) {
    throw new Error(`Could not parse starter project manifest: ${(error as Error).message}`);
  }
}

function starterProjectUrl(path: string): string {
  const cleanPath = path.trim().replace(/\\/g, "/");

  if (!cleanPath || cleanPath.startsWith("/") || cleanPath.split("/").includes("..")) {
    throw new Error(`Invalid starter project file path: ${path}`);
  }

  return `${STARTER_PROJECT_ROOT}/${cleanPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}
