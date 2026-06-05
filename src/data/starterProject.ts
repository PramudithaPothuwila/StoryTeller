import { projectFromBundleText } from "./projectFiles";
import { createBlankProject } from "./story";
import { StoryProject } from "../types";

const STARTER_PROJECT_URL = "/projects/the-hidden-crown.storyteller.json";

export async function loadStarterProject(fetchProject = fetch): Promise<StoryProject> {
  const response = await fetchProject(STARTER_PROJECT_URL);

  if (!response.ok) {
    throw new Error(`Could not load starter project: ${response.status}`);
  }

  return projectFromBundleText(await response.text());
}

export function createLoadingProject(): StoryProject {
  return createBlankProject("Loading Story...");
}
