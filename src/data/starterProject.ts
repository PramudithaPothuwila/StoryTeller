import { projectFromFiles } from "./projectFiles";
import { createBlankProject } from "./story";
import { ProjectMode, StoryProject } from "../types";

const STARTER_PROJECT_MANIFEST = "storyteller.project.json";
const STARTER_PROJECT_RELATIONSHIPS = "graph/relationships.json";
export const DEFAULT_STARTER_PROJECT_ID = "the-crown-beneath-glass";

export interface StarterProjectSummary {
  id: string;
  title: string;
  root: string;
  projectMode: ProjectMode;
}

export const STARTER_PROJECTS: StarterProjectSummary[] = [
  {
    id: "black-hollow-last-stop",
    title: "Black Hollow: Last Stop",
    root: "/projects/Black Hollow Last Stop",
    projectMode: "game_story"
  },
  {
    id: DEFAULT_STARTER_PROJECT_ID,
    title: "The Crown Beneath Glass",
    root: "/projects/The Crown Beneath Glass",
    projectMode: "story"
  }
];

interface StarterProjectManifest {
  entityIndex?: Array<{
    path?: string;
  }>;
}

export async function loadStarterProject(
  fetchProject = fetch,
  starterProjectId = DEFAULT_STARTER_PROJECT_ID
): Promise<StoryProject> {
  const starterProject = findStarterProject(starterProjectId);
  const manifestText = await fetchStarterFile(fetchProject, starterProject.root, STARTER_PROJECT_MANIFEST);
  const manifest = parseStarterManifest(manifestText);
  const files: Record<string, string> = {
    [STARTER_PROJECT_MANIFEST]: manifestText,
    [STARTER_PROJECT_RELATIONSHIPS]: await fetchStarterFile(
      fetchProject,
      starterProject.root,
      STARTER_PROJECT_RELATIONSHIPS
    )
  };

  for (const indexedEntity of manifest.entityIndex ?? []) {
    if (!indexedEntity.path) {
      throw new Error("Could not load starter project: entity path is missing");
    }

    files[indexedEntity.path] = await fetchStarterFile(fetchProject, starterProject.root, indexedEntity.path);
  }

  return projectFromFiles(files);
}

export function getStarterProjects(): StarterProjectSummary[] {
  return STARTER_PROJECTS.map((starterProject) => ({ ...starterProject }));
}

export function createLoadingProject(): StoryProject {
  return createBlankProject("Loading Story...");
}

async function fetchStarterFile(fetchProject: typeof fetch, root: string, path: string): Promise<string> {
  const response = await fetchProject(starterProjectUrl(root, path));

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

function findStarterProject(starterProjectId: string): StarterProjectSummary {
  const starterProject = STARTER_PROJECTS.find((candidate) => candidate.id === starterProjectId);

  if (!starterProject) {
    throw new Error(`Unknown starter project: ${starterProjectId}`);
  }

  return starterProject;
}

function starterProjectUrl(root: string, path: string): string {
  const cleanRoot = root.trim().replace(/\\/g, "/");
  const cleanPath = path.trim().replace(/\\/g, "/");

  if (!cleanPath || cleanPath.startsWith("/") || cleanPath.split("/").includes("..")) {
    throw new Error(`Invalid starter project file path: ${path}`);
  }

  if (!cleanRoot.startsWith("/projects/") || cleanRoot.split("/").includes("..")) {
    throw new Error(`Invalid starter project root: ${root}`);
  }

  return `${cleanRoot}/${cleanPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}
