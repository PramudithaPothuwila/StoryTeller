import {
  addEdge,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  type EdgeTypes,
  MarkerType,
  MiniMap,
  Node,
  NodeChange,
  NodeTypes,
  ReactFlow,
  ReactFlowProvider
} from "@xyflow/react";
import {
  ArrowLeft,
  BookOpen,
  Bot,
  CircleHelp,
  CloudUpload,
  Database,
  Download,
  FilePlus2,
  FolderOpen,
  FolderPlus,
  Gamepad2,
  LogIn,
  LogOut,
  Mail,
  KeyRound,
  Save,
  ScrollText,
  Settings2,
  Trash2,
  Upload,
  UserPlus
} from "lucide-react";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AgentPanel } from "./components/AgentPanel";
import { CloudConflictDialog } from "./components/CloudDialogs";
import { DetailInspector } from "./components/DetailInspector";
import { EntityNode, type EntityNodeData, type EntityNodeHandle } from "./components/EntityNode";
import { GameStoryPanel, type GameToolTab } from "./components/GameStoryPanel";
import { GraphToolbar } from "./components/GraphToolbar";
import { InAppGuide } from "./components/InAppGuide";
import { RelationshipEdge, type RelationshipEdgeType } from "./components/RelationshipEdge";
import { RulebookSidebar } from "./components/RulebookSidebar";
import { SettingsPage } from "./components/SettingsPage";
import { Sidebar } from "./components/Sidebar";
import { TimelinePanel } from "./components/TimelinePanel";
import {
  addTimelineLaneToProject,
  addEntityToProject,
  applyTimelineEffectToProject,
  createBlankProject,
  createCustomItemType,
  createCustomLinkType,
  createGameplayTransition,
  createStoryEntity,
  createStoryRelationship,
  deleteEntityFromProject,
  deleteEmptyTimelineTrackFromProject,
  deleteItemTypeFromProject,
  deleteLinkTypeFromProject,
  deleteRelationshipFromProject,
  entityVisibleInGraph,
  findItemType,
  findLinkType,
  getGameContinuityIssues,
  getGameStoryRelationships,
  getGameStoryNodes,
  getGameStoryTriggerRelationships,
  getTimelineEvents,
  getWorldTriggerRelationships,
  isRelationshipActiveAt,
  isGameStoryNodeEntity,
  isGameStoryItemType,
  isGameStoryLinkType,
  moveTimelineEventInProject,
  nextEntityPosition,
  nextTimelineOrder,
  normalizeGameStoryEntityMetadata,
  normalizeGameStoryRelationshipMetadata,
  projectLayoutForView,
  renameTimelineLaneInProject,
  resolveRelationshipAt,
  setProjectLayout,
  touchProject,
  updateGameStoryProjectMetadata,
  updateEntityInProject,
  updateRelationshipInProject
} from "./data/story";
import { createLoadingProject, getStarterProjects, loadStarterProject } from "./data/starterProject";
import {
  createProjectBundle,
  hasFolderProjectSupport,
  projectFromBundleFile,
  readProjectFromDirectory,
  writeProjectToDirectory
} from "./data/projectFiles";
import { createRuntimeBundleBlob } from "./runtime/export";
import {
  CloudProjectConflictError,
  CloudProjectSummary,
  CloudSyncStatus,
  CloudUser,
  StorageMode,
  createCloudProject,
  deleteCloudProject,
  getCurrentCloudUser,
  listCloudProjects,
  openCloudProject,
  readCloudUserSettings,
  saveCloudProject,
  sendMagicLink,
  signInWithPassword,
  signOutCloudUser,
  signUpWithPassword,
  subscribeToCloudAuth,
  writeCloudUserSettings
} from "./data/cloudProjects";
import {
  BUILT_IN_EVENT_TYPE_ID,
  BUILT_IN_TRIGGER_LINK_TYPE_ID,
  BUILT_IN_WORLD_RULE_TYPE_ID,
  ItemTypeDefinition,
  ItemTypeId,
  LinkTypeDefinition,
  LinkTypeId,
  Point,
  ProjectMode,
  Selection,
  StoryEntity,
  StoryProject,
  StoryRelationship,
  TimelineEffectDraft
} from "./types";

type PositionNodeChange = NodeChange & {
  id: string;
  position?: Point;
};

type ValidPositionNodeChange = PositionNodeChange & {
  position: Point;
};

interface EntityGraphFocus {
  connectedEntityIds: Set<string>;
  relationshipIds: Set<string>;
}

type GraphFocusDepth = 1 | 2 | 3 | 4 | "all";
type GraphView = "world" | "story_flow";
type TriggerPickMode = "game_target" | "world_source";
type ActivePage = "workspace" | "settings";
type RecentProjectSource = "folder" | "backup" | "browser";
type NewProjectContents = "empty" | "sample";

interface TriggerPickState {
  mode: TriggerPickMode;
  fixedEntityId: string;
  restoreGraphView: GraphView;
  restoreSelection: Selection | null;
}

interface WorkspaceProjectSeed {
  id: string;
  project: StoryProject;
  status: string;
  cloudProjectId?: string | null;
  cloudVersion?: number | null;
  folderHandle?: FileSystemDirectoryHandle | null;
  storageMode: StorageMode;
}

interface RecentProjectCard {
  id: string;
  title: string;
  source: RecentProjectSource;
  projectMode: ProjectMode;
  updatedAt: string;
  folderName?: string;
  project?: StoryProject;
}

interface CloudStoredSettings {
  graphFocusDepth?: GraphFocusDepth;
}

const nodeTypes = {
  storyEntity: EntityNode
} satisfies NodeTypes;

const edgeTypes = {
  relationship: RelationshipEdge
} satisfies EdgeTypes;

const FOLDER_ACCESS_UNAVAILABLE_MESSAGE =
  "Folder selection is unavailable in this browser. Use a browser with folder access to save folder projects.";
const GRAPH_FOCUS_DEPTH_STORAGE_KEY = "storyteller.graphFocusDepth";
const RECENT_PROJECTS_STORAGE_KEY = "storyteller.recentProjects";
const PARALLEL_HANDLE_OFFSET_STEP = 18;
const RELATIONSHIP_LABEL_OFFSET_STEP = 18;
const modifierShortcutLabel =
  typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac") ? "Cmd" : "Ctrl";
const graphFocusDepthOptions: Array<{ label: string; value: GraphFocusDepth }> = [
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "All", value: "all" }
];

export function App() {
  return (
    <BrowserRouter>
      <StoryAppRoutes />
    </BrowserRouter>
  );
}

function StoryAppRoutes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
  const [cloudProjects, setCloudProjects] = useState<CloudProjectSummary[]>([]);
  const [cloudProjectsLoading, setCloudProjectsLoading] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProjectCard[]>(() => readStoredRecentProjects());
  const [workspaceSeeds, setWorkspaceSeeds] = useState<Record<string, WorkspaceProjectSeed>>({});
  const [routeStatus, setRouteStatus] = useState("Ready");
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCloudUser() {
      try {
        const user = await getCurrentCloudUser();

        if (!cancelled) {
          setCloudUser(user);
        }
      } catch {
        if (!cancelled) {
          setCloudUser(null);
        }
      }
    }

    void loadCloudUser();

    const unsubscribe = subscribeToCloudAuth((user) => {
      if (!cancelled) {
        setCloudUser(user);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const rememberRecentProject = useCallback((recentProject: RecentProjectCard) => {
    setRecentProjects((currentProjects) => {
      const nextProjects = upsertRecentProject(currentProjects, recentProject);
      writeStoredRecentProjects(nextProjects);
      return nextProjects;
    });
  }, []);

  const openWorkspaceSeed = useCallback(
    (seed: WorkspaceProjectSeed, recentSource?: RecentProjectSource, folderName?: string) => {
      setWorkspaceSeeds((seeds) => ({ ...seeds, [seed.id]: seed }));

      if (recentSource) {
        rememberRecentProject({
          id: seed.id,
          title: seed.project.title,
          source: recentSource,
          projectMode: seed.project.projectMode,
          updatedAt: seed.project.updatedAt,
          folderName,
          project: seed.project
        });
      }

      navigate(`/project/${encodeURIComponent(seed.id)}`);
    },
    [navigate, rememberRecentProject]
  );

  const refreshCloudProjects = useCallback(async () => {
    if (!cloudUser) {
      setCloudProjects([]);
      return;
    }

    setCloudProjectsLoading(true);

    try {
      setCloudProjects(await listCloudProjects());
    } catch (error) {
      setRouteStatus((error as Error).message);
    } finally {
      setCloudProjectsLoading(false);
    }
  }, [cloudUser]);

  useEffect(() => {
    void refreshCloudProjects();
  }, [refreshCloudProjects]);

  const handleNewBrowserProject = useCallback(async (projectMode: ProjectMode, contents: NewProjectContents) => {
    try {
      const project =
        contents === "sample"
          ? await loadStarterProject(undefined, starterProjectIdForMode(projectMode))
          : createBlankProject("Untitled Story", projectMode);
      const id = createLocalProjectRouteId("browser");

      openWorkspaceSeed(
        {
          id,
          project,
          status: contents === "sample" ? "Sample project created" : "New browser project",
          storageMode: "local"
        },
        "browser"
      );
    } catch (error) {
      setRouteStatus(sampleProjectErrorMessage(error));
    }
  }, [openWorkspaceSeed]);

  const handleOpenFolderProject = useCallback(async () => {
    if (!hasFolderProjectSupport()) {
      setRouteStatus(FOLDER_ACCESS_UNAVAILABLE_MESSAGE);
      return;
    }

    try {
      const handle = await window.showDirectoryPicker?.({
        id: "storyteller-project",
        mode: "readwrite"
      });

      if (!handle) {
        setRouteStatus("Choose a project folder to open");
        return;
      }

      const project = await readProjectFromDirectory(handle);
      const id = createLocalProjectRouteId("folder");

      openWorkspaceSeed(
        {
          id,
          project,
          status: "Project opened",
          folderHandle: handle,
          storageMode: "local"
        },
        "folder",
        handle.name
      );
    } catch (error) {
      setRouteStatus(projectFolderErrorMessage(error, "Choose a project folder to open"));
    }
  }, [openWorkspaceSeed]);

  const handleImportBackupSelected = useCallback(
    async (file: File | null) => {
      if (!file) {
        return;
      }

      try {
        const project = await projectFromBundleFile(file);
        const id = createLocalProjectRouteId("backup");

        openWorkspaceSeed(
          {
            id,
            project,
            status: "Project opened from backup",
            storageMode: "local"
          },
          "backup"
        );
      } catch (error) {
        setRouteStatus((error as Error).message);
      } finally {
        if (backupInputRef.current) {
          backupInputRef.current.value = "";
        }
      }
    },
    [openWorkspaceSeed]
  );

  const handleOpenRecentProject = useCallback(
    (recentProject: RecentProjectCard) => {
      if (!recentProject.project) {
        setRouteStatus("This recent project no longer has a browser snapshot. Open the folder or import a backup again.");
        return;
      }

      openWorkspaceSeed(
        {
          id: recentProject.id,
          project: recentProject.project,
          status:
            recentProject.source === "backup"
              ? "Recent backup opened"
              : recentProject.source === "folder"
                ? "Recent folder snapshot opened"
                : "Recent project opened",
          storageMode: "local"
        },
        recentProject.source,
        recentProject.folderName
      );
    },
    [openWorkspaceSeed]
  );

  const handleMoveRecentProjectToCloud = useCallback(
    async (recentProject: RecentProjectCard) => {
      if (!cloudUser) {
        navigate("/auth");
        return;
      }

      if (!recentProject.project) {
        setRouteStatus("This recent project no longer has a browser snapshot. Open the folder or import a backup again.");
        return;
      }

      try {
        const savedProject = await createCloudProject(recentProject.project);

        setCloudProjects((projects) => upsertCloudProjectSummary(projects, savedProject));
        openWorkspaceSeed(
          {
            id: savedProject.id,
            project: savedProject.project,
            status: "Project moved to cloud",
            cloudProjectId: savedProject.id,
            cloudVersion: savedProject.version,
            storageMode: "cloud"
          }
        );
      } catch (error) {
        setRouteStatus((error as Error).message);
      }
    },
    [cloudUser, navigate, openWorkspaceSeed]
  );

  const handleCreateCloudProject = useCallback(async (projectMode: ProjectMode, contents: NewProjectContents) => {
    if (!cloudUser) {
      navigate("/auth");
      return;
    }

    try {
      const project =
        contents === "sample"
          ? await loadStarterProject(undefined, starterProjectIdForMode(projectMode))
          : createBlankProject("Untitled Story", projectMode);
      const savedProject = await createCloudProject(project);
      setCloudProjects((projects) => upsertCloudProjectSummary(projects, savedProject));
      openWorkspaceSeed(
        {
          id: savedProject.id,
          project: savedProject.project,
          status: contents === "sample" ? "Sample cloud project created" : "Cloud project created",
          cloudProjectId: savedProject.id,
          cloudVersion: savedProject.version,
          storageMode: "cloud"
        }
      );
    } catch (error) {
      setRouteStatus(contents === "sample" ? sampleProjectErrorMessage(error) : (error as Error).message);
    }
  }, [cloudUser, navigate, openWorkspaceSeed]);

  const handleOpenCloudProject = useCallback(
    async (id: string) => {
      try {
        const loadedProject = await openCloudProject(id);

        openWorkspaceSeed(
          {
            id: loadedProject.id,
            project: loadedProject.project,
            status: "Cloud project opened",
            cloudProjectId: loadedProject.id,
            cloudVersion: loadedProject.version,
            storageMode: "cloud"
          }
        );
      } catch (error) {
        setRouteStatus((error as Error).message);
      }
    },
    [openWorkspaceSeed]
  );

  const handleDeleteCloudProject = useCallback(
    async (id: string) => {
      try {
        await deleteCloudProject(id);
        setCloudProjects((projects) => projects.filter((project) => project.id !== id));
        setRouteStatus("Cloud project deleted");
      } catch (error) {
        setRouteStatus((error as Error).message);
      }
    },
    []
  );

  const handlePasswordSignIn = useCallback(async (email: string, password: string) => {
    const user = await signInWithPassword(email, password);
    setCloudUser(user);
    setRouteStatus("Signed in");
  }, []);

  const handlePasswordSignUp = useCallback(async (email: string, password: string) => {
    const user = await signUpWithPassword(email, password);
    setCloudUser(user);
    setRouteStatus("Signed up");
  }, []);

  const handleMagicLink = useCallback(async (email: string) => {
    await sendMagicLink(email);
    setRouteStatus("Magic link sent");
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOutCloudUser();
    setCloudUser(null);
    setCloudProjects([]);
    setRouteStatus("Signed out");
  }, []);

  const handleCloudProjectSaved = useCallback((project: CloudProjectSummary) => {
    setCloudProjects((projects) => upsertCloudProjectSummary(projects, project));
  }, []);

  return (
    <>
      <input
        ref={backupInputRef}
        className="visually-hidden"
        type="file"
        accept=".storyteller.json,application/json"
        onChange={(event) => void handleImportBackupSelected(event.target.files?.[0] ?? null)}
      />
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              cloudProjects={cloudProjects}
              cloudProjectsLoading={cloudProjectsLoading}
              cloudUser={cloudUser}
              recentProjects={recentProjects}
              restoreProjectId={searchParams.get("restoreProject")}
              status={routeStatus}
              onCreateCloudProject={handleCreateCloudProject}
              onDeleteCloudProject={handleDeleteCloudProject}
              onImportBackup={() => backupInputRef.current?.click()}
              onNewProject={handleNewBrowserProject}
              onOpenCloudProject={handleOpenCloudProject}
              onOpenFolder={handleOpenFolderProject}
              onOpenRecentProject={handleOpenRecentProject}
              onMoveRecentProjectToCloud={handleMoveRecentProjectToCloud}
              onRefreshCloudProjects={refreshCloudProjects}
            />
          }
        />
        <Route
          path="/auth"
          element={
            <AuthPage
              user={cloudUser}
              status={routeStatus}
              onMagicLink={handleMagicLink}
              onPasswordSignIn={handlePasswordSignIn}
              onPasswordSignUp={handlePasswordSignUp}
              onSignOut={handleSignOut}
            />
          }
        />
        <Route
          path="/project/:projectId"
          element={
            <WorkspaceRoute
              cloudUser={cloudUser}
              recentProjects={recentProjects}
              workspaceSeeds={workspaceSeeds}
              onCloudProjectSaved={handleCloudProjectSaved}
              onRecentProjectChanged={rememberRecentProject}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

interface WorkspaceRouteProps {
  cloudUser: CloudUser | null;
  recentProjects: RecentProjectCard[];
  workspaceSeeds: Record<string, WorkspaceProjectSeed>;
  onCloudProjectSaved: (project: CloudProjectSummary) => void;
  onRecentProjectChanged: (project: RecentProjectCard) => void;
}

function WorkspaceRoute({
  cloudUser,
  recentProjects,
  workspaceSeeds,
  onCloudProjectSaved,
  onRecentProjectChanged
}: WorkspaceRouteProps) {
  const { projectId } = useParams();
  const seed = projectId
    ? (workspaceSeeds[projectId] ?? workspaceSeedFromRecentProject(projectId, recentProjects))
    : undefined;

  if (projectId && isLocalProjectRouteId(projectId) && !seed) {
    return <Navigate to={`/?restoreProject=${encodeURIComponent(projectId)}`} replace />;
  }

  return (
    <ReactFlowProvider>
      <StoryWorkspace
        cloudUser={cloudUser}
        routeProjectId={projectId}
        seed={seed}
        onCloudProjectSaved={onCloudProjectSaved}
        onRecentProjectChanged={onRecentProjectChanged}
      />
    </ReactFlowProvider>
  );
}

interface HomePageProps {
  cloudProjects: CloudProjectSummary[];
  cloudProjectsLoading: boolean;
  cloudUser: CloudUser | null;
  recentProjects: RecentProjectCard[];
  restoreProjectId: string | null;
  status: string;
  onCreateCloudProject: (projectMode: ProjectMode, contents: NewProjectContents) => Promise<void>;
  onDeleteCloudProject: (id: string) => Promise<void>;
  onImportBackup: () => void;
  onNewProject: (projectMode: ProjectMode, contents: NewProjectContents) => Promise<void>;
  onOpenCloudProject: (id: string) => Promise<void>;
  onOpenFolder: () => Promise<void>;
  onOpenRecentProject: (project: RecentProjectCard) => void;
  onMoveRecentProjectToCloud: (project: RecentProjectCard) => Promise<void>;
  onRefreshCloudProjects: () => Promise<void>;
}

function HomePage({
  cloudProjects,
  cloudProjectsLoading,
  cloudUser,
  recentProjects,
  restoreProjectId,
  status,
  onCreateCloudProject,
  onDeleteCloudProject,
  onImportBackup,
  onNewProject,
  onOpenCloudProject,
  onOpenFolder,
  onOpenRecentProject,
  onMoveRecentProjectToCloud,
  onRefreshCloudProjects
}: HomePageProps) {
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [newProjectMode, setNewProjectMode] = useState<ProjectMode>("story");
  const [newProjectContents, setNewProjectContents] = useState<NewProjectContents>("empty");
  const sampleProject = starterProjectForMode(newProjectMode);
  const restoreProject = restoreProjectId
    ? recentProjects.find((project) => project.id === restoreProjectId)
    : undefined;

  async function handleCreateLocalProject() {
    setNewProjectDialogOpen(false);
    await onNewProject(newProjectMode, newProjectContents);
  }

  async function handleCreateCloudProject() {
    setNewProjectDialogOpen(false);
    await onCreateCloudProject(newProjectMode, newProjectContents);
  }

  return (
    <main className="project-home" aria-labelledby="project-home-title">
      <header className="project-home__header">
        <div>
          <p>StoryTeller</p>
          <h1 id="project-home-title">Projects</h1>
        </div>
        <nav className="project-home__nav" aria-label="Account">
          <Link className="text-tool-button" to="/auth">
            {cloudUser ? <LogOut aria-hidden="true" /> : <LogIn aria-hidden="true" />}
            {cloudUser ? "Account" : "Sign In"}
          </Link>
        </nav>
      </header>

      <section className="project-home__actions" aria-label="Project actions">
        <button type="button" className="primary-action" onClick={() => setNewProjectDialogOpen(true)}>
          <FilePlus2 aria-hidden="true" />
          New Project
        </button>
        <button type="button" className="text-tool-button" onClick={() => void onOpenFolder()}>
          <FolderOpen aria-hidden="true" />
          Open Folder
        </button>
        <button type="button" className="text-tool-button" onClick={onImportBackup}>
          <Upload aria-hidden="true" />
          Import Backup
        </button>
      </section>
      {status !== "Ready" ? <p className="project-home__status">{status}</p> : null}

      {restoreProjectId ? (
        <section className="project-home__section" aria-labelledby="restore-project-title">
          <div className="project-home__section-heading">
            <div>
              <h2 id="restore-project-title">Restore Local Project</h2>
            </div>
          </div>
          <p className="project-home__empty">
            {restoreProject?.project
              ? "This local project URL was restored from your recent browser snapshot. Open it below to continue."
              : restoreProject
                ? "This local project URL no longer has a browser snapshot. Open the folder again or import a backup to continue."
                : "This local project URL is only available in the browser where it was opened. Open the folder again or import a backup to continue."}
          </p>
        </section>
      ) : null}

      {newProjectDialogOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="cloud-dialog" role="dialog" aria-modal="true" aria-labelledby="new-project-title">
            <header className="guide-dialog__header">
              <div>
                <p>Project</p>
                <h2 id="new-project-title">New Project</h2>
              </div>
              <button type="button" className="text-tool-button" onClick={() => setNewProjectDialogOpen(false)}>
                Cancel
              </button>
            </header>
            <div className="cloud-dialog__body">
              <div className="settings-control-group">
                <span>Mode</span>
                <div className="mode-toggle" role="group" aria-label="New project mode">
                  <button
                    type="button"
                    className={newProjectMode === "story" ? "is-active" : ""}
                    aria-pressed={newProjectMode === "story"}
                    onClick={() => setNewProjectMode("story")}
                  >
                    <BookOpen aria-hidden="true" />
                    Story
                  </button>
                  <button
                    type="button"
                    className={newProjectMode === "game_story" ? "is-active" : ""}
                    aria-pressed={newProjectMode === "game_story"}
                    onClick={() => setNewProjectMode("game_story")}
                  >
                    <Gamepad2 aria-hidden="true" />
                    Game Story
                  </button>
                </div>
              </div>
              <div className="settings-control-group">
                <span>Contents</span>
                <div className="mode-toggle" role="group" aria-label="New project contents">
                  <button
                    type="button"
                    className={newProjectContents === "empty" ? "is-active" : ""}
                    aria-pressed={newProjectContents === "empty"}
                    onClick={() => setNewProjectContents("empty")}
                  >
                    <FilePlus2 aria-hidden="true" />
                    Empty
                  </button>
                  <button
                    type="button"
                    className={newProjectContents === "sample" ? "is-active" : ""}
                    aria-pressed={newProjectContents === "sample"}
                    onClick={() => setNewProjectContents("sample")}
                  >
                    <FolderOpen aria-hidden="true" />
                    Sample
                  </button>
                </div>
                {newProjectContents === "sample" ? (
                  <p className="settings-help-text">Uses {sampleProject.title}.</p>
                ) : null}
              </div>
              <div className="new-project-choice-grid">
                <button type="button" className="primary-action" onClick={() => void handleCreateLocalProject()}>
                  <FilePlus2 aria-hidden="true" />
                  Local Project
                </button>
                {cloudUser ? (
                  <button type="button" className="text-tool-button" onClick={() => void handleCreateCloudProject()}>
                    <Database aria-hidden="true" />
                    Cloud Project
                  </button>
                ) : (
                  <Link className="text-tool-button" to="/auth" onClick={() => setNewProjectDialogOpen(false)}>
                    <LogIn aria-hidden="true" />
                    Sign In for Cloud
                  </Link>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <section className="project-home__section" aria-labelledby="cloud-projects-title">
        <div className="project-home__section-heading">
          <div>
            <h2 id="cloud-projects-title">Cloud Projects</h2>
          </div>
          <button type="button" className="text-tool-button" disabled={!cloudUser || cloudProjectsLoading} onClick={() => void onRefreshCloudProjects()}>
            <Database aria-hidden="true" />
            Refresh
          </button>
        </div>
        {!cloudUser ? (
          <p className="project-home__empty">
            <Link to="/auth">Sign in</Link> to list your cloud projects.
          </p>
        ) : cloudProjects.length ? (
          <div className="project-card-grid">
            {cloudProjects.map((project) => (
              <article key={project.id} className="project-card">
                <div>
                  <strong>{project.title}</strong>
                  <span>Cloud</span>
                </div>
                <div className="project-card__actions">
                  <button type="button" className="text-tool-button" onClick={() => void onOpenCloudProject(project.id)}>
                    <FolderOpen aria-hidden="true" />
                    Open
                  </button>
                  <button type="button" className="text-tool-button danger" onClick={() => void onDeleteCloudProject(project.id)}>
                    <Trash2 aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="project-home__empty">{cloudProjectsLoading ? "Loading cloud projects..." : "No cloud projects yet."}</p>
        )}
      </section>

      <section className="project-home__section" aria-labelledby="recent-projects-title">
        <div className="project-home__section-heading">
          <div>
            <h2 id="recent-projects-title">Recent Local and Imported Projects</h2>
          </div>
        </div>
        {recentProjects.length ? (
          <div className="project-card-grid">
            {recentProjects.map((project) => (
              <article key={project.id} className="project-card">
                <div>
                  <strong>{project.title}</strong>
                  <span>Local</span>
                </div>
                <div className="project-card__actions">
                  <button type="button" className="text-tool-button" onClick={() => onOpenRecentProject(project)}>
                    <FolderOpen aria-hidden="true" />
                    Open
                  </button>
                  <button
                    type="button"
                    className="text-tool-button"
                    disabled={!cloudUser}
                    onClick={() => void onMoveRecentProjectToCloud(project)}
                  >
                    <CloudUpload aria-hidden="true" />
                    Move to Cloud
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="project-home__empty">No local or imported projects have been opened in this browser yet.</p>
        )}
      </section>
    </main>
  );
}

interface AuthPageProps {
  user: CloudUser | null;
  status: string;
  onMagicLink: (email: string) => Promise<void>;
  onPasswordSignIn: (email: string, password: string) => Promise<void>;
  onPasswordSignUp: (email: string, password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}

function AuthPage({
  user,
  status,
  onMagicLink,
  onPasswordSignIn,
  onPasswordSignUp,
  onSignOut
}: AuthPageProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>, successMessage: string): Promise<boolean> {
    setBusy(true);
    setMessage("");

    try {
      await action();
      setMessage(successMessage);
      return true;
    } catch (error) {
      setMessage((error as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    const signedIn = await run(
      () => (mode === "sign-in" ? onPasswordSignIn(email, password) : onPasswordSignUp(email, password)),
      mode === "sign-in" ? "Signed in" : "Signed up"
    );

    if (signedIn) {
      navigate("/");
    }
  }

  return (
    <main className="auth-page" aria-labelledby="auth-page-title">
      <header className="project-home__header">
        <div>
          <p>StoryTeller</p>
          <h1 id="auth-page-title">Account</h1>
        </div>
        <Link className="text-tool-button" to="/">
          <Database aria-hidden="true" />
          Projects
        </Link>
      </header>

      <section className="auth-panel">
        {user ? (
          <div className="cloud-stack">
            <div className="cloud-account">
              <Database aria-hidden="true" />
              <div>
                <strong>{user.email ?? "Signed in"}</strong>
                <span>{user.id}</span>
              </div>
            </div>
            <button type="button" className="text-tool-button danger" disabled={busy} onClick={() => void run(onSignOut, "Signed out")}>
              <LogOut aria-hidden="true" />
              Sign Out
            </button>
          </div>
        ) : (
          <form className="cloud-stack" onSubmit={(event) => void handlePasswordSubmit(event)}>
            <div className="mode-toggle">
              <button type="button" className={mode === "sign-in" ? "is-active" : ""} onClick={() => setMode("sign-in")}>
                <KeyRound aria-hidden="true" />
                Sign In
              </button>
              <button type="button" className={mode === "sign-up" ? "is-active" : ""} onClick={() => setMode("sign-up")}>
                <UserPlus aria-hidden="true" />
                Sign Up
              </button>
            </div>
            <label className="field-stack">
              Email
              <input
                aria-label="Cloud email"
                autoComplete="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="field-stack">
              Password
              <input
                aria-label="Cloud password"
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <div className="cloud-actions">
              <button type="submit" className="primary-action" disabled={busy || !email.trim() || !password.trim()}>
                {mode === "sign-in" ? <KeyRound aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
                {mode === "sign-in" ? "Sign In" : "Sign Up"}
              </button>
              <button
                type="button"
                className="text-tool-button"
                disabled={busy || !email.trim()}
                onClick={() => void run(() => onMagicLink(email), "Magic link sent. Check your email to finish signing in.")}
              >
                <Mail aria-hidden="true" />
                Send Magic Link
              </button>
            </div>
          </form>
        )}
        {message || status ? <p className="cloud-message">{message || status}</p> : null}
      </section>
    </main>
  );
}

interface StoryWorkspaceProps {
  cloudUser: CloudUser | null;
  routeProjectId?: string;
  seed?: WorkspaceProjectSeed;
  onCloudProjectSaved: (project: CloudProjectSummary) => void;
  onRecentProjectChanged: (project: RecentProjectCard) => void;
}

function StoryWorkspace({
  cloudUser,
  routeProjectId,
  seed,
  onCloudProjectSaved,
  onRecentProjectChanged
}: StoryWorkspaceProps) {
  const initialProject = useMemo(() => seed?.project ?? createLoadingProject(), [seed]);
  const initialSelection = useMemo(() => firstProjectSelection(initialProject), [initialProject]);
  const [graphFocusDepth, setGraphFocusDepth] = useState<GraphFocusDepth>(() => readStoredGraphFocusDepth());
  const graphFocusDepthRef = useRef(graphFocusDepth);
  const initialGraphFocus = useMemo(
    () => createEntityGraphFocus(initialProject, initialSelection, graphFocusDepth, "world"),
    [graphFocusDepth, initialProject, initialSelection]
  );
  const [project, setProject] = useState<StoryProject>(() => initialProject);
  const [selection, setSelection] = useState<Selection | null>(() => initialSelection);
  const [flowNodes, setFlowNodes] = useState<Node<EntityNodeData, "storyEntity">[]>(() =>
    projectNodes(initialProject, initialSelection, initialGraphFocus, "world")
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Ready");
  const [isDirty, setIsDirty] = useState(false);
  const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode>("local");
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>("signed_out");
  const [cloudVersion, setCloudVersion] = useState<number | null>(null);
  const [cloudConflictOpen, setCloudConflictOpen] = useState(false);
  const [defaultRelationshipType, setDefaultRelationshipType] = useState<LinkTypeId>("relates_to");
  const [activePage, setActivePage] = useState<ActivePage>("workspace");
  const [guideOpen, setGuideOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [gameToolsOpen, setGameToolsOpen] = useState(false);
  const [rulebookOpen, setRulebookOpen] = useState(false);
  const [selectedTimelineEventId, setSelectedTimelineEventId] = useState<string | null>(null);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [graphView, setGraphView] = useState<GraphView>("world");
  const [triggerPick, setTriggerPick] = useState<TriggerPickState | null>(null);
  const [activeGameTool, setActiveGameTool] = useState<GameToolTab>("state");
  const cloudSettingsUserRef = useRef<string | null>(null);
  const sidebarSearchInputRef = useRef<HTMLInputElement>(null);
  const graphFocus = useMemo(
    () => createEntityGraphFocus(project, selection, graphFocusDepth, graphView),
    [graphFocusDepth, graphView, project, selection]
  );
  const graphRelationships = useMemo(() => graphViewRelationships(project, graphView), [graphView, project]);
  const continuityIssueCount = useMemo(
    () => (project.projectMode === "game_story" ? getGameContinuityIssues(project).length : 0),
    [project]
  );
  const agentAvailable = storageMode === "cloud" && Boolean(cloudUser);

  useEffect(() => {
    graphFocusDepthRef.current = graphFocusDepth;
  }, [graphFocusDepth]);

  useEffect(() => {
    if (!agentAvailable) {
      setAgentOpen(false);
    }
  }, [agentAvailable]);

  useEffect(() => {
    setCloudSyncStatus((currentStatus) => {
      if (cloudUser) {
        return currentStatus === "signed_out" ? "idle" : currentStatus;
      }

      setCloudProjectId(null);
      setCloudVersion(null);
      setStorageMode("local");
      cloudSettingsUserRef.current = null;
      return "signed_out";
    });
  }, [cloudUser]);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      if (!cloudUser || cloudSettingsUserRef.current === cloudUser.id) {
        return;
      }

      try {
        const settings = parseCloudStoredSettings(await readCloudUserSettings());

        if (cancelled) {
          return;
        }

        cloudSettingsUserRef.current = cloudUser.id;

        if (settings.graphFocusDepth) {
          setGraphFocusDepth(settings.graphFocusDepth);
          writeStoredGraphFocusDepth(settings.graphFocusDepth);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus((error as Error).message);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [cloudUser]);

  useEffect(() => {
    if (!cloudUser || cloudSettingsUserRef.current !== cloudUser.id) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const currentSettings = parseCloudStoredSettings(await readCloudUserSettings());
        await writeCloudUserSettings({
          ...currentSettings,
          graphFocusDepth
        });
      })().catch((error) => setStatus((error as Error).message));
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [cloudUser, graphFocusDepth]);

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      if (seed) {
        const nextSelection = firstProjectSelection(seed.project);
        const nextGraphView = seed.project.projectMode === "game_story" ? "story_flow" : "world";
        const nextGraphFocus = createEntityGraphFocus(seed.project, nextSelection, graphFocusDepthRef.current, nextGraphView);
        setProject(seed.project);
        setFolderHandle(seed.folderHandle ?? null);
        setCloudProjectId(seed.cloudProjectId ?? null);
        setCloudVersion(seed.cloudVersion ?? null);
        setStorageMode(seed.storageMode);
        setCloudSyncStatus(seed.storageMode === "cloud" ? "saved" : cloudUser ? "idle" : "signed_out");
        setSelection(nextSelection);
        setGraphView(nextGraphView);
        setTriggerPick(null);
        setFlowNodes(projectNodes(seed.project, nextSelection, nextGraphFocus, nextGraphView));
        setSelectedTimelineEventId(null);
        setIsDirty(false);
        setStatus(seed.status);
        return;
      }

      if (routeProjectId && !isLocalProjectRouteId(routeProjectId)) {
        try {
          const loadedProject = await openCloudProject(routeProjectId);

          if (cancelled) {
            return;
          }

          const nextSelection = firstProjectSelection(loadedProject.project);
          const nextGraphView = loadedProject.project.projectMode === "game_story" ? "story_flow" : "world";
          const nextGraphFocus = createEntityGraphFocus(
            loadedProject.project,
            nextSelection,
            graphFocusDepthRef.current,
            nextGraphView
          );
          setProject(loadedProject.project);
          setFolderHandle(null);
          setCloudProjectId(loadedProject.id);
          setCloudVersion(loadedProject.version);
          setStorageMode("cloud");
          setCloudSyncStatus("saved");
          setSelection(nextSelection);
          setGraphView(nextGraphView);
          setTriggerPick(null);
          setFlowNodes(projectNodes(loadedProject.project, nextSelection, nextGraphFocus, nextGraphView));
          setSelectedTimelineEventId(null);
          setIsDirty(false);
          setStatus("Cloud project opened");
          return;
        } catch (error) {
          if (!cancelled) {
            setStatus((error as Error).message);
          }
        }
      }

      try {
        const starterProject = await loadStarterProject();

        if (cancelled) {
          return;
        }

        const nextSelection = firstProjectSelection(starterProject);
        const nextGraphView = starterProject.projectMode === "game_story" ? "story_flow" : "world";
        const nextGraphFocus = createEntityGraphFocus(starterProject, nextSelection, graphFocusDepthRef.current, nextGraphView);
        setProject(starterProject);
        setSelection(nextSelection);
        setGraphView(nextGraphView);
        setTriggerPick(null);
        setFlowNodes(projectNodes(starterProject, nextSelection, nextGraphFocus, nextGraphView));
        setSelectedTimelineEventId(null);
        setIsDirty(false);
        setStatus("Starter project loaded");
      } catch (error) {
        if (cancelled) {
          return;
        }

        const blankProject = createBlankProject();
        setProject(blankProject);
        setSelection(null);
        setGraphView("world");
        setTriggerPick(null);
        setFlowNodes(projectNodes(blankProject, null, null, "world"));
        setStatus((error as Error).message);
      }
    }

    void loadProject();

    return () => {
      cancelled = true;
    };
  }, [cloudUser, routeProjectId, seed]);

  useEffect(() => {
    setFlowNodes((currentNodes) => syncProjectNodes(currentNodes, project, selection, graphFocus, graphView));
  }, [graphFocus, graphView, project, selection]);

  useEffect(() => {
    if (selection?.kind === "entity" && !graphViewEntities(project, graphView).some((entity) => entity.id === selection.id)) {
      setSelection(null);
    }
  }, [graphView, project, selection]);

  useEffect(() => {
    if (project.projectMode !== "game_story") {
      setGameToolsOpen(false);
      setTriggerPick(null);
    }
  }, [project.projectMode]);

  const edges = useMemo<RelationshipEdgeType[]>(
    () => {
      const parallelLayoutByRelationshipId = parallelRelationshipLayoutById(graphRelationships);

      return graphRelationships.map((relationship) => {
        const resolvedRelationship = resolveRelationshipAt(project, relationship, selectedTimelineEventId);
        const linkType = findLinkType(project, resolvedRelationship.type);
        const active = isRelationshipActiveAt(project, relationship, selectedTimelineEventId);
        const selected = selection?.kind === "relationship" && selection.id === relationship.id;
        const connectedToFocus = graphFocus?.relationshipIds.has(relationship.id) ?? false;
        const fadedByFocus = Boolean(graphFocus && !connectedToFocus);
        const edgeOpacity = relationshipOpacity(active, fadedByFocus, connectedToFocus);
        const markerColor = fadedByFocus ? "#9aa8a4" : selected ? "#be123c" : linkType.color;
        const gameBranch = graphView === "story_flow" && resolvedRelationship.gameStory;
        const gameRelationship = gameBranch ? normalizeGameStoryRelationshipMetadata(gameBranch) : null;

        return {
          id: relationship.id,
          source: relationship.sourceId,
          target: relationship.targetId,
          sourceHandle: parallelLayoutByRelationshipId.get(relationship.id)?.sourceHandle,
          targetHandle: parallelLayoutByRelationshipId.get(relationship.id)?.targetHandle,
          label: gameRelationship?.choiceText || resolvedRelationship.label || linkType.label,
          type: "relationship",
          data: {
            labelOffset: parallelLayoutByRelationshipId.get(relationship.id)?.labelOffset ?? 0
          },
          markerEnd:
            linkType.direction === "directed"
              ? {
                  type: MarkerType.ArrowClosed,
                  width: 18,
                  height: 18,
                  color: markerColor
                }
              : undefined,
          style: {
            stroke: markerColor,
            strokeWidth: selected || connectedToFocus ? 3 : 2,
            opacity: edgeOpacity,
            strokeDasharray: active ? (gameRelationship?.requirements.length ? "4 4" : undefined) : "7 7"
          },
          labelStyle: {
            fill: fadedByFocus ? "#697a75" : "#17201f",
            fontWeight: 700,
            fontSize: 12,
            opacity: relationshipLabelOpacity(active, fadedByFocus, connectedToFocus)
          },
          labelBgStyle: {
            fill: "#ffffff",
            fillOpacity: fadedByFocus ? 0.35 : active ? 0.9 : connectedToFocus ? 0.7 : 0.55
          }
        };
      });
    },
    [graphFocus, graphRelationships, graphView, project, selectedTimelineEventId, selection]
  );
  const inspectorVisible = hasVisibleInspector(project, selection);
  const gameToolsAvailable = project.projectMode === "game_story";
  const gameToolsVisible = gameToolsAvailable && gameToolsOpen;
  const workspaceClassName = [
    "workspace",
    inspectorVisible ? "has-inspector" : "",
    rulebookOpen ? "has-rulebook" : "",
    gameToolsVisible ? "has-game-tools" : "",
    agentOpen ? "has-agent" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const triggerPickPrompt =
    triggerPick?.mode === "game_target"
      ? "Select a game story node to trigger"
      : triggerPick?.mode === "world_source"
        ? "Select a world-building item as trigger source"
        : null;

  const markProjectChanged = useCallback((nextProject: StoryProject) => {
    setProject(nextProject);
    setIsDirty(true);
    setCloudSyncStatus((currentStatus) => (currentStatus === "signed_out" ? currentStatus : "idle"));
    setStatus("Unsaved changes");
  }, []);

  const loadProjectIntoWorkspace = useCallback(
    (
      loadedProject: StoryProject,
      nextStatus: string,
      options: {
        cloudProjectId?: string | null;
        cloudVersion?: number | null;
        folderHandle?: FileSystemDirectoryHandle | null;
        storageMode: StorageMode;
      }
    ) => {
      const nextSelection = firstProjectSelection(loadedProject);
      const nextGraphView = loadedProject.projectMode === "game_story" ? "story_flow" : "world";
      const nextGraphFocus = createEntityGraphFocus(loadedProject, nextSelection, graphFocusDepthRef.current, nextGraphView);

      setProject(loadedProject);
      setFolderHandle(options.folderHandle ?? null);
      setCloudProjectId(options.cloudProjectId ?? null);
      setCloudVersion(options.cloudVersion ?? null);
      setStorageMode(options.storageMode);
      setCloudSyncStatus(options.storageMode === "cloud" ? "saved" : cloudUser ? "idle" : "signed_out");
      setSelection(nextSelection);
      setGraphView(nextGraphView);
      setTriggerPick(null);
      setFlowNodes(projectNodes(loadedProject, nextSelection, nextGraphFocus, nextGraphView));
      setSelectedTimelineEventId(null);
      setIsDirty(false);
      setStatus(nextStatus);
    },
    [cloudUser]
  );

  const applyGraphView = useCallback((nextGraphView: GraphView) => {
    setGraphView(nextGraphView);

    if (nextGraphView === "story_flow") {
      setDefaultRelationshipType("branches_to");
    } else {
      setDefaultRelationshipType((currentType) => (isGameStoryLinkType(currentType) ? "relates_to" : currentType));
    }
  }, []);

  const restoreTriggerPick = useCallback(() => {
    if (!triggerPick) {
      return;
    }

    applyGraphView(triggerPick.restoreGraphView);
    setSelection(triggerPick.restoreSelection);
    setTriggerPick(null);
  }, [applyGraphView, triggerPick]);

  const handleCancelTriggerPick = useCallback(() => {
    restoreTriggerPick();
    setStatus(isDirty ? "Unsaved changes" : "Ready");
  }, [isDirty, restoreTriggerPick]);

  const handleGraphViewChange = useCallback(
    (nextGraphView: GraphView) => {
      setTriggerPick(null);
      applyGraphView(nextGraphView);
    },
    [applyGraphView]
  );

  const handleSelectEntityInGraph = useCallback(
    (id: string, nextGraphView: GraphView) => {
      setActivePage("workspace");
      setTriggerPick(null);
      handleGraphViewChange(nextGraphView);
      setSelection({ kind: "entity", id });
    },
    [handleGraphViewChange]
  );

  const handleOpenRulebook = useCallback(() => {
    setActivePage("workspace");
    setRulebookOpen(true);
  }, []);

  const handleCreateEntity = useCallback(
    (type: ItemTypeId) => {
      const graphPresence =
        project.projectMode === "game_story" && graphView === "story_flow" ? "story_flow" : "world";
      const entity = createStoryEntity(type, project.itemTypes, undefined, graphPresence);

      if (entity.type === BUILT_IN_EVENT_TYPE_ID) {
        entity.timeline = { order: nextTimelineOrder(project), track: 0, effects: [] };
      }

      let nextProject = addEntityToProject(project, entity, nextEntityPosition(project));

      if (project.projectMode === "game_story" && entity.gameStory && !project.gameStory?.startNodeId) {
        nextProject = updateGameStoryProjectMetadata(nextProject, { startNodeId: entity.id });
      }

      markProjectChanged(nextProject);
      setSelection({ kind: "entity", id: entity.id });
    },
    [graphView, markProjectChanged, project]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setFlowNodes(
        (currentNodes) => applyNodeChanges(changes, currentNodes) as Node<EntityNodeData, "storyEntity">[]
      );

      const positionChanges = changes.filter(isValidPositionNodeChange);

      if (!positionChanges.length) {
        return;
      }

      setProject((currentProject) => {
        const nextLayout = { ...projectLayoutForView(currentProject, graphView) };
        let moved = false;

        for (const change of positionChanges) {
          if (!currentProject.entities[change.id]) {
            continue;
          }

          const currentPosition = nextLayout[change.id] ?? { x: 80, y: 80 };

          if (currentPosition.x !== change.position.x || currentPosition.y !== change.position.y) {
            nextLayout[change.id] = {
              x: change.position.x,
              y: change.position.y
            };
            moved = true;
          }
        }

        return moved ? setProjectLayout(currentProject, nextLayout, graphView) : currentProject;
      });

      setIsDirty(true);
      setStatus("Unsaved changes");
    },
    [graphView]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return;
      }

      const isStoryFlowTransition = graphView === "story_flow" && project.projectMode === "game_story";
      const relationship = isStoryFlowTransition
        ? null
        : createStoryRelationship(project, connection.source, connection.target, defaultRelationshipType);
      const transition = isStoryFlowTransition ? createGameplayTransition(connection.source, connection.target) : null;
      const edgeId = relationship?.id ?? transition!.id;
      const nextEdges = addEdge({ ...connection, id: edgeId }, edges);

      if (nextEdges.length === edges.length) {
        return;
      }

      markProjectChanged({
        ...touchProject(project),
        relationships: relationship ? [...project.relationships, relationship] : project.relationships,
        gameplayTransitions: transition ? [...project.gameplayTransitions, transition] : project.gameplayTransitions
      });
      setSelection({ kind: "relationship", id: edgeId });
    },
    [defaultRelationshipType, edges, graphView, markProjectChanged, project]
  );

  const handleEntityChange = useCallback(
    (id: string, patch: Partial<StoryEntity>) => {
      markProjectChanged(updateEntityInProject(project, id, patch));
    },
    [markProjectChanged, project]
  );

  const handleRelationshipChange = useCallback(
    (id: string, patch: Partial<StoryRelationship>) => {
      markProjectChanged(updateRelationshipInProject(project, id, patch));
    },
    [markProjectChanged, project]
  );

  const handleStartTriggerPick = useCallback(
    (mode: TriggerPickMode, fixedEntityId: string) => {
      if (project.projectMode !== "game_story" || !project.entities[fixedEntityId]) {
        return;
      }

      const nextGraphView = mode === "game_target" ? "story_flow" : "world";
      setActivePage("workspace");
      setTriggerPick({
        mode,
        fixedEntityId,
        restoreGraphView: graphView,
        restoreSelection: selection
      });
      applyGraphView(nextGraphView);
      setStatus(mode === "game_target" ? "Select a game story node to trigger" : "Select a world-building item as trigger source");
    },
    [applyGraphView, graphView, project, selection]
  );

  const handleCreateTriggerLink = useCallback(
    (sourceId: string, targetId: string) => {
      if (!project.entities[sourceId] || !project.entities[targetId] || sourceId === targetId) {
        return;
      }

      const existingTrigger = project.relationships.find(
        (relationship) =>
          relationship.sourceId === sourceId &&
          relationship.targetId === targetId &&
          relationship.type === BUILT_IN_TRIGGER_LINK_TYPE_ID
      );

      if (existingTrigger) {
        return;
      }

      const relationship = createStoryRelationship(project, sourceId, targetId, BUILT_IN_TRIGGER_LINK_TYPE_ID);

      markProjectChanged({
        ...touchProject(project),
        relationships: [...project.relationships, relationship]
      });
    },
    [markProjectChanged, project]
  );

  const handleNodeClick = useCallback(
    (id: string) => {
      if (!triggerPick) {
        setSelection({ kind: "entity", id });
        return;
      }

      const pickedEntity = project.entities[id];

      if (!pickedEntity) {
        return;
      }

      if (triggerPick.mode === "game_target") {
        const linkedTargetIds = new Set(
          getWorldTriggerRelationships(project, triggerPick.fixedEntityId).map((relationship) => relationship.targetId)
        );

        if (!isGameStoryNodeEntity(pickedEntity) || linkedTargetIds.has(id)) {
          setStatus("Select an unlinked game story node");
          return;
        }

        handleCreateTriggerLink(triggerPick.fixedEntityId, id);
      } else {
        const linkedSourceIds = new Set(
          getGameStoryTriggerRelationships(project, triggerPick.fixedEntityId).map((relationship) => relationship.sourceId)
        );

        if (!entityVisibleInGraph(pickedEntity, "world") || isGameStoryNodeEntity(pickedEntity) || linkedSourceIds.has(id)) {
          setStatus("Select an unlinked world-building item");
          return;
        }

        handleCreateTriggerLink(id, triggerPick.fixedEntityId);
      }

      restoreTriggerPick();
    },
    [handleCreateTriggerLink, project, restoreTriggerPick, triggerPick]
  );

  const handleDeleteEntity = useCallback(
    (id: string) => {
      markProjectChanged(deleteEntityFromProject(project, id));
      if (selectedTimelineEventId === id) {
        setSelectedTimelineEventId(null);
      }
      setSelection(null);
    },
    [markProjectChanged, project, selectedTimelineEventId]
  );

  const handleDeleteRelationship = useCallback(
    (id: string) => {
      markProjectChanged(deleteRelationshipFromProject(project, id));
      setSelection(null);
    },
    [markProjectChanged, project]
  );

  const handleProjectTitleChange = useCallback(
    (title: string) => {
      markProjectChanged(touchProject({ ...project, title }));
    },
    [markProjectChanged, project]
  );

  const handleTimelineEffect = useCallback(
    (eventId: string, draft: TimelineEffectDraft) => {
      const result = applyTimelineEffectToProject(project, eventId, draft);

      if (!result.relationshipId) {
        setStatus("Select a valid relationship change");
        return;
      }

      markProjectChanged(result.project);
      setSelectedTimelineEventId(eventId);
      setSelection({ kind: "relationship", id: result.relationshipId });
    },
    [markProjectChanged, project]
  );

  const handleCreateWorldRule = useCallback(() => {
    const entity = createStoryEntity(BUILT_IN_WORLD_RULE_TYPE_ID, project.itemTypes);
    const nextProject = addEntityToProject(project, entity, nextEntityPosition(project));

    markProjectChanged(nextProject);
    setSelection({ kind: "entity", id: entity.id });

    return entity.id;
  }, [markProjectChanged, project]);

  const handleFocusWorldRule = useCallback(
    (id: string) => {
      handleSelectEntityInGraph(id, "world");
    },
    [handleSelectEntityInGraph]
  );

  const handleAddTimelineTrack = useCallback(() => {
    markProjectChanged(addTimelineLaneToProject(project));
  }, [markProjectChanged, project]);

  const handleRenameTimelineTrack = useCallback(
    (track: number, name: string) => {
      const nextProject = renameTimelineLaneInProject(project, track, name);

      if (nextProject !== project) {
        markProjectChanged(nextProject);
      }
    },
    [markProjectChanged, project]
  );

  const handleMoveTimelineEvent = useCallback(
    (eventId: string, track: number, index: number) => {
      const nextProject = moveTimelineEventInProject(project, eventId, track, index);

      if (nextProject !== project) {
        markProjectChanged(nextProject);
      }
    },
    [markProjectChanged, project]
  );

  const handleGraphFocusDepthChange = useCallback((depth: GraphFocusDepth) => {
    setGraphFocusDepth(depth);
    writeStoredGraphFocusDepth(depth);
  }, []);

  const handleTimelineScrub = useCallback(
    (order: number) => {
      const event = getTimelineEvents(project).find((timelineEvent) => timelineEvent.timeline?.order === order);

      if (event) {
        setSelectedTimelineEventId(event.id);
      }
    },
    [project]
  );

  const handleDeleteEmptyTimelineTrack = useCallback(
    (track: number) => {
      const nextProject = deleteEmptyTimelineTrackFromProject(project, track);

      if (nextProject !== project) {
        markProjectChanged(nextProject);
      }
    },
    [markProjectChanged, project]
  );

  const handleAddItemType = useCallback(() => {
    const type = createCustomItemType();
    markProjectChanged({
      ...touchProject(project),
      itemTypes: [...project.itemTypes, type]
    });
  }, [markProjectChanged, project]);

  const handleAddLinkType = useCallback(() => {
    const type = createCustomLinkType();
    markProjectChanged({
      ...touchProject(project),
      linkTypes: [...project.linkTypes, type]
    });
  }, [markProjectChanged, project]);

  const handleUpdateItemType = useCallback(
    (typeId: string, patch: Partial<ItemTypeDefinition>) => {
      markProjectChanged({
        ...touchProject(project),
        itemTypes: project.itemTypes.map((type) => (type.id === typeId && !type.builtIn ? { ...type, ...patch } : type))
      });
    },
    [markProjectChanged, project]
  );

  const handleUpdateLinkType = useCallback(
    (typeId: string, patch: Partial<LinkTypeDefinition>) => {
      markProjectChanged({
        ...touchProject(project),
        linkTypes: project.linkTypes.map((type) => (type.id === typeId && !type.builtIn ? { ...type, ...patch } : type))
      });
    },
    [markProjectChanged, project]
  );

  const handleDeleteItemType = useCallback(
    (typeId: string) => {
      markProjectChanged(deleteItemTypeFromProject(project, typeId));
    },
    [markProjectChanged, project]
  );

  const handleDeleteLinkType = useCallback(
    (typeId: string) => {
      const nextProject = deleteLinkTypeFromProject(project, typeId);
      markProjectChanged(nextProject);
      if (defaultRelationshipType === typeId) {
        setDefaultRelationshipType(nextProject.linkTypes[0]?.id ?? "relates_to");
      }
    },
    [defaultRelationshipType, markProjectChanged, project]
  );

  const downloadProjectBackup = useCallback(() => {
    const url = URL.createObjectURL(createProjectBundle(project));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.title.trim() || "storyteller"}.storyteller.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [project]);

  const downloadRuntimeBundle = useCallback(() => {
    const url = URL.createObjectURL(createRuntimeBundleBlob(project));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.title.trim() || "storyteller"}.storyruntime.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [project]);

  const handleSelectProjectFolder = useCallback(async () => {
    if (!hasFolderProjectSupport()) {
      setStatus(FOLDER_ACCESS_UNAVAILABLE_MESSAGE);
      return;
    }

    try {
      const handle = await window.showDirectoryPicker?.({
        id: "storyteller-project",
        mode: "readwrite"
      });

      if (!handle) {
        setStatus("Choose a project folder to save");
        return;
      }

      await writeProjectToDirectory(project, handle);
      setFolderHandle(handle);
      setCloudProjectId(null);
      setCloudVersion(null);
      setStorageMode("local");
      setCloudSyncStatus(cloudUser ? "idle" : "signed_out");
      setIsDirty(false);
      setStatus("Project folder selected and saved");
      onRecentProjectChanged({
        id: seed?.id ?? createLocalProjectRouteId("folder"),
        title: project.title,
        source: "folder",
        projectMode: project.projectMode,
        updatedAt: project.updatedAt,
        folderName: handle.name,
        project
      });
    } catch (error) {
      setStatus(projectFolderErrorMessage(error, "Choose a project folder to save"));
    }
  }, [cloudUser, onRecentProjectChanged, project, seed]);

  const handleSaveProject = useCallback(async () => {
    try {
      if (!hasFolderProjectSupport()) {
        setStatus(FOLDER_ACCESS_UNAVAILABLE_MESSAGE);
        return;
      }

      const handle =
        folderHandle ??
        (await window.showDirectoryPicker?.({
          id: "storyteller-project",
          mode: "readwrite"
      }));

      if (!handle) {
        setStatus("Choose a project folder to save");
        return;
      }

      await writeProjectToDirectory(project, handle);
      setFolderHandle(handle);
      setCloudProjectId(null);
      setCloudVersion(null);
      setStorageMode("local");
      setCloudSyncStatus(cloudUser ? "idle" : "signed_out");
      setIsDirty(false);
      setStatus("Project saved");
      onRecentProjectChanged({
        id: seed?.id ?? createLocalProjectRouteId("folder"),
        title: project.title,
        source: folderHandle ? "folder" : "browser",
        projectMode: project.projectMode,
        updatedAt: project.updatedAt,
        folderName: handle.name,
        project
      });
    } catch (error) {
      setStatus(projectFolderErrorMessage(error, "Choose a project folder to save"));
    }
  }, [cloudUser, folderHandle, onRecentProjectChanged, project, seed]);

  const handleExportBackup = useCallback(() => {
    downloadProjectBackup();
    setStatus("Backup exported");
  }, [downloadProjectBackup]);

  const handleExportRuntime = useCallback(() => {
    downloadRuntimeBundle();
    setStatus("Runtime exported");
  }, [downloadRuntimeBundle]);

  const handleSaveToCloud = useCallback(async () => {
    if (!cloudUser) {
      setStatus("Sign in before saving to cloud");
      return;
    }

    setCloudSyncStatus("saving");

    try {
      const savedProject =
        cloudProjectId && cloudVersion !== null
          ? await saveCloudProject(cloudProjectId, cloudVersion, project)
          : await createCloudProject(project);

      setCloudProjectId(savedProject.id);
      setCloudVersion(savedProject.version);
      setFolderHandle(null);
      setStorageMode("cloud");
      setCloudSyncStatus("saved");
      setIsDirty(false);
      setStatus("Cloud project saved");
      onCloudProjectSaved(savedProject);
    } catch (error) {
      if (error instanceof CloudProjectConflictError) {
        setCloudSyncStatus("conflict");
        setCloudConflictOpen(true);
        setStatus("Cloud version conflict");
        return;
      }

      setCloudSyncStatus("error");
      setStatus((error as Error).message);
    }
  }, [cloudProjectId, cloudUser, cloudVersion, onCloudProjectSaved, project]);

  const handleMoveLocalProjectToCloud = useCallback(async () => {
    if (storageMode === "cloud") {
      setStatus("Project is already cloud-backed");
      return;
    }

    if (!cloudUser) {
      setStatus("Sign in before moving this project to cloud");
      return;
    }

    setCloudSyncStatus("saving");

    try {
      const savedProject = await createCloudProject(project);

      setCloudProjectId(savedProject.id);
      setCloudVersion(savedProject.version);
      setFolderHandle(null);
      setStorageMode("cloud");
      setCloudSyncStatus("saved");
      setIsDirty(false);
      setStatus("Project moved to cloud");
      onCloudProjectSaved(savedProject);
    } catch (error) {
      setCloudSyncStatus("error");
      setStatus((error as Error).message);
    }
  }, [cloudUser, onCloudProjectSaved, project, storageMode]);

  const handleReloadRemoteProject = useCallback(async () => {
    if (!cloudProjectId) {
      throw new Error("No cloud project is open.");
    }

    const loadedProject = await openCloudProject(cloudProjectId);

    loadProjectIntoWorkspace(loadedProject.project, "Remote project reloaded", {
      cloudProjectId: loadedProject.id,
      cloudVersion: loadedProject.version,
      storageMode: "cloud"
    });
  }, [cloudProjectId, loadProjectIntoWorkspace]);

  const handleSaveCloudCopy = useCallback(async () => {
    if (!cloudUser) {
      throw new Error("Sign in before saving to cloud.");
    }

    const copyProject = {
      ...project,
      title: `${project.title} Copy`
    };
    const savedProject = await createCloudProject(copyProject);

    loadProjectIntoWorkspace(savedProject.project, "Cloud copy saved", {
      cloudProjectId: savedProject.id,
      cloudVersion: savedProject.version,
      storageMode: "cloud"
    });
    onCloudProjectSaved(savedProject);
  }, [cloudUser, loadProjectIntoWorkspace, onCloudProjectSaved, project]);

  useEffect(() => {
    function handleWorkspaceShortcut(event: KeyboardEvent) {
      if (guideOpen || cloudConflictOpen || isShortcutEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const hasModifier = event.ctrlKey || event.metaKey;
      const hasOnlyModifier = hasModifier && !event.altKey && !event.shiftKey;

      if (hasOnlyModifier && key === "s") {
        event.preventDefault();
        void (storageMode === "cloud" ? handleSaveToCloud() : handleSaveProject());
        return;
      }

      if (hasOnlyModifier && key === "e") {
        event.preventDefault();
        handleExportBackup();
        return;
      }

      if (hasOnlyModifier && key === "f") {
        event.preventDefault();
        sidebarSearchInputRef.current?.focus();
        sidebarSearchInputRef.current?.select();
        return;
      }

      if (hasOnlyModifier && (key === "backspace" || key === "delete")) {
        event.preventDefault();
        if (selection?.kind === "entity") {
          handleDeleteEntity(selection.id);
        } else if (selection?.kind === "relationship") {
          handleDeleteRelationship(selection.id);
        }
        return;
      }

      if (event.altKey && !event.ctrlKey && !event.metaKey && gameToolsVisible) {
        if (key === "1") {
          event.preventDefault();
          setActiveGameTool("state");
          return;
        }

        if (key === "2") {
          event.preventDefault();
          setActiveGameTool("preview");
          return;
        }

        if (key === "3") {
          event.preventDefault();
          setActiveGameTool("continuity");
          return;
        }
      }

      if (hasModifier || event.altKey) {
        return;
      }

      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        setGuideOpen(true);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();

        if (triggerPick) {
          handleCancelTriggerPick();
          return;
        }

        if (activePage === "settings") {
          setActivePage("workspace");
          return;
        }

        if (rulebookOpen) {
          setRulebookOpen(false);
          return;
        }

        if (agentOpen) {
          setAgentOpen(false);
          return;
        }

        if (gameToolsVisible) {
          setGameToolsOpen(false);
          return;
        }

        if (selection || selectedTimelineEventId) {
          setSelection(null);
          setSelectedTimelineEventId(null);
        }
        return;
      }

      if (event.shiftKey && key === "t") {
        event.preventDefault();
        handleAddTimelineTrack();
        return;
      }

      if (event.shiftKey) {
        return;
      }

      const focusDepthByKey: Record<string, GraphFocusDepth> = {
        "0": "all",
        "1": 1,
        "2": 2,
        "3": 3,
        "4": 4
      };

      if (key in focusDepthByKey) {
        event.preventDefault();
        handleGraphFocusDepthChange(focusDepthByKey[key]);
        return;
      }

      switch (key) {
        case "r":
          event.preventDefault();
          setActivePage("workspace");
          setRulebookOpen((open) => !open);
          return;
        case "a":
          if (agentAvailable) {
            event.preventDefault();
            setActivePage("workspace");
            setAgentOpen((open) => !open);
          }
          return;
        case "b":
          if (gameToolsAvailable) {
            event.preventDefault();
            setActivePage("workspace");
            setGameToolsOpen((open) => !open);
          }
          return;
        case "w":
          if (project.projectMode === "game_story") {
            event.preventDefault();
            handleGraphViewChange("world");
          }
          return;
        case "g":
          if (project.projectMode === "game_story") {
            event.preventDefault();
            handleGraphViewChange("story_flow");
          }
          return;
        case "t":
          event.preventDefault();
          setTimelineCollapsed((collapsed) => !collapsed);
          return;
      }

      const shortcutItemType = itemTypeShortcutForKey(key, graphView);

      if (
        shortcutItemType &&
        project.itemTypes.some(
          (type) =>
            type.id === shortcutItemType &&
            (project.projectMode !== "game_story" ||
              (graphView === "story_flow" ? isGameStoryItemType(type.id) : !isGameStoryItemType(type.id)))
        )
      ) {
        event.preventDefault();
        setActivePage("workspace");
        handleCreateEntity(shortcutItemType);
      }
    }

    window.addEventListener("keydown", handleWorkspaceShortcut);

    return () => window.removeEventListener("keydown", handleWorkspaceShortcut);
  }, [
    activePage,
    agentOpen,
    cloudConflictOpen,
    gameToolsAvailable,
    gameToolsVisible,
    graphView,
    guideOpen,
    handleAddTimelineTrack,
    handleCancelTriggerPick,
    handleCreateEntity,
    handleDeleteEntity,
    handleDeleteRelationship,
    handleExportBackup,
    handleExportRuntime,
    handleGraphFocusDepthChange,
    handleGraphViewChange,
    handleSaveProject,
    handleSaveToCloud,
    project.itemTypes,
    project.projectMode,
    rulebookOpen,
    selectedTimelineEventId,
    selection,
    storageMode,
    triggerPick
  ]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-project">
          <strong>{project.title}</strong>
          <div className="topbar-meta">
            <span>{Object.keys(project.entities).length} items</span>
            <span>{project.relationships.length + project.gameplayTransitions.length} links</span>
            {project.projectMode === "game_story" ? <span>{continuityIssueCount} issues</span> : null}
            {isDirty ? <span className="topbar-status is-dirty">Unsaved</span> : null}
            {storageMode === "local" ? (
              <span>
                Folder: <strong>{folderHandle?.name ?? "Not selected"}</strong>
              </span>
            ) : null}
            <span>
              Storage: <strong>{storageMode === "cloud" ? "Cloud" : "Local"}</strong>
            </span>
            <span>
              Cloud: <strong>{cloudStatusLabel(cloudSyncStatus)}</strong>
            </span>
          </div>
        </div>
        <nav className="topbar-actions" aria-label="Project commands">
          <Link className="toolbar-button" aria-label="Project Home" title="Project Home" data-tooltip="Project Home" to="/">
            <Database aria-hidden="true" />
          </Link>
          <HeaderIconButton label="Select Folder" onClick={() => void handleSelectProjectFolder()}>
            <FolderPlus aria-hidden="true" />
          </HeaderIconButton>
          {storageMode === "local" ? (
            <HeaderIconButton
              label="Move to Cloud"
              active={cloudSyncStatus === "saving"}
              onClick={() => void handleMoveLocalProjectToCloud()}
            >
              <CloudUpload aria-hidden="true" />
            </HeaderIconButton>
          ) : null}
          <HeaderIconButton
            label="Save Project"
            active={cloudSyncStatus === "saving"}
            shortcut={`${modifierShortcutLabel}+S`}
            ariaKeyShortcuts="Control+S Meta+S"
            onClick={() => void (storageMode === "cloud" ? handleSaveToCloud() : handleSaveProject())}
          >
            <Save aria-hidden="true" />
          </HeaderIconButton>
          <HeaderIconButton label="Export Runtime" onClick={handleExportRuntime}>
            <Download aria-hidden="true" />
          </HeaderIconButton>
          <HeaderIconButton label="Rulebook" shortcut="R" ariaKeyShortcuts="R" onClick={handleOpenRulebook}>
            <ScrollText aria-hidden="true" />
          </HeaderIconButton>
          {agentAvailable ? (
            <HeaderIconButton
              label="AI Agent"
              active={agentOpen}
              shortcut="A"
              ariaKeyShortcuts="A"
              onClick={() => {
                setActivePage("workspace");
                setAgentOpen((open) => !open);
              }}
            >
              <Bot aria-hidden="true" />
            </HeaderIconButton>
          ) : null}
          {gameToolsAvailable ? (
            <HeaderIconButton
              label="Branching RPG"
              active={gameToolsVisible}
              shortcut="B"
              ariaKeyShortcuts="B"
              onClick={() => {
                setActivePage("workspace");
                setGameToolsOpen((open) => !open);
              }}
            >
              <Gamepad2 aria-hidden="true" />
            </HeaderIconButton>
          ) : null}
          <HeaderIconButton label="Guide" active={guideOpen} shortcut="?" ariaKeyShortcuts="?" onClick={() => setGuideOpen(true)}>
            <CircleHelp aria-hidden="true" />
          </HeaderIconButton>
          <HeaderIconButton
            label={activePage === "settings" ? "Back to Workspace" : "Open Settings"}
            active={activePage === "settings"}
            shortcut="Esc"
            ariaKeyShortcuts="Escape"
            onClick={() => setActivePage((page) => (page === "settings" ? "workspace" : "settings"))}
          >
            {activePage === "settings" ? <ArrowLeft aria-hidden="true" /> : <Settings2 aria-hidden="true" />}
          </HeaderIconButton>
        </nav>
      </header>

      {guideOpen ? <InAppGuide onClose={() => setGuideOpen(false)} /> : null}
      {cloudConflictOpen ? (
        <CloudConflictDialog
          onClose={() => setCloudConflictOpen(false)}
          onExportBackup={handleExportBackup}
          onReloadRemote={handleReloadRemoteProject}
          onSaveCopy={handleSaveCloudCopy}
        />
      ) : null}

      {activePage === "settings" ? (
        <SettingsPage
          project={project}
          defaultRelationshipType={defaultRelationshipType}
          onAddItemType={handleAddItemType}
          onAddLinkType={handleAddLinkType}
          onBackToWorkspace={() => setActivePage("workspace")}
          onDefaultRelationshipTypeChange={setDefaultRelationshipType}
          onDeleteItemType={handleDeleteItemType}
          onDeleteLinkType={handleDeleteLinkType}
          onExportBackup={handleExportBackup}
          onProjectTitleChange={handleProjectTitleChange}
          onUpdateItemType={handleUpdateItemType}
          onUpdateLinkType={handleUpdateLinkType}
        />
      ) : (
        <main className={workspaceClassName}>
          <Sidebar
            project={project}
            search={search}
            searchInputRef={sidebarSearchInputRef}
            onSelectEntity={(id) => setSelection({ kind: "entity", id })}
            onSearchChange={setSearch}
          />

          <section className="graph-column">
            <section className="graph-shell" aria-label="Story graph">
              <GraphToolbar
                project={project}
                graphView={graphView}
                graphFocusDepth={graphFocusDepth}
                graphFocusDepthOptions={graphFocusDepthOptions}
                onCreateEntity={handleCreateEntity}
                onGraphFocusDepthChange={handleGraphFocusDepthChange}
                onGraphViewChange={handleGraphViewChange}
              />
              {triggerPickPrompt ? (
                <div className="graph-pick-prompt" role="status">
                  <span>{triggerPickPrompt}</span>
                  <button type="button" className="text-tool-button" onClick={handleCancelTriggerPick}>
                    Cancel
                  </button>
                </div>
              ) : null}
              <ReactFlow
                nodes={flowNodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.25 }}
                onNodesChange={handleNodesChange}
                onConnect={handleConnect}
                onNodeClick={(_, node) => handleNodeClick(node.id)}
                onEdgeClick={(_, edge) => setSelection({ kind: "relationship", id: edge.id })}
                onPaneClick={() => {
                  if (triggerPick) {
                    handleCancelTriggerPick();
                    return;
                  }

                  setSelection(null);
                }}
              >
                <Background color="#c8d1cd" gap={22} size={1.2} variant={BackgroundVariant.Dots} />
                <MiniMap pannable zoomable nodeStrokeWidth={3} />
                <Controls />
              </ReactFlow>
            </section>
            <TimelinePanel
              project={project}
              selectedEventId={selectedTimelineEventId}
              collapsed={timelineCollapsed}
              onToggleCollapsed={() => setTimelineCollapsed((collapsed) => !collapsed)}
              onAddTrack={handleAddTimelineTrack}
              onMoveEvent={handleMoveTimelineEvent}
              onDeleteEmptyTrack={handleDeleteEmptyTimelineTrack}
              onRenameTrack={handleRenameTimelineTrack}
              onScrubTimelineOrder={handleTimelineScrub}
              onSelectEvent={(eventId) => {
                setSelectedTimelineEventId(eventId);
                if (eventId) {
                  setSelection({ kind: "entity", id: eventId });
                }
              }}
            />
          </section>

          {inspectorVisible ? (
            <DetailInspector
              project={project}
              selection={selection}
              onStartTriggerPick={handleStartTriggerPick}
              onEntityChange={handleEntityChange}
              onRelationshipChange={handleRelationshipChange}
              onSelectEntityInGraph={handleSelectEntityInGraph}
              onTimelineEffect={handleTimelineEffect}
              onDeleteEntity={handleDeleteEntity}
              onDeleteRelationship={handleDeleteRelationship}
            />
          ) : null}

          {gameToolsVisible ? (
            <GameStoryPanel
              project={project}
              activeTab={activeGameTool}
              onActiveTabChange={setActiveGameTool}
              onProjectChange={markProjectChanged}
              onSelectEntity={(id) => setSelection({ kind: "entity", id })}
              onSelectRelationship={(id) => setSelection({ kind: "relationship", id })}
            />
          ) : null}

          {agentAvailable && agentOpen ? (
            <AgentPanel
              project={project}
              onClose={() => setAgentOpen(false)}
              onProjectChange={markProjectChanged}
              onSelectEntity={(id) => setSelection({ kind: "entity", id })}
              onSelectRelationship={(id) => setSelection({ kind: "relationship", id })}
              onStatusChange={setStatus}
            />
          ) : null}

          {rulebookOpen ? (
            <RulebookSidebar
              project={project}
              onClose={() => setRulebookOpen(false)}
              onCreateRule={handleCreateWorldRule}
              onDeleteRule={handleDeleteEntity}
              onFocusRule={handleFocusWorldRule}
              onRuleChange={handleEntityChange}
            />
          ) : null}
        </main>
      )}
    </div>
  );
}

interface HeaderIconButtonProps {
  active?: boolean;
  ariaKeyShortcuts?: string;
  children: ReactNode;
  label: string;
  onClick: () => void;
  shortcut?: string;
}

function HeaderIconButton({
  active = false,
  ariaKeyShortcuts,
  children,
  label,
  onClick,
  shortcut
}: HeaderIconButtonProps) {
  const tooltip = shortcut ? `${label} (${shortcut})` : label;

  return (
    <button
      type="button"
      className={active ? "toolbar-button is-active" : "toolbar-button"}
      aria-label={label}
      aria-keyshortcuts={ariaKeyShortcuts}
      title={tooltip}
      data-tooltip={tooltip}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function isShortcutEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest("input, textarea, select, [contenteditable]")
  );
}

function itemTypeShortcutForKey(key: string, graphView: GraphView): ItemTypeId | null {
  switch (key) {
    case "c":
      return "character";
    case "n":
      return "note";
    case "l":
      return "location";
    case "e":
      return graphView === "story_flow" ? "ending" : BUILT_IN_EVENT_TYPE_ID;
    case "i":
      return "item";
    case "f":
      return "faction";
    case "u":
      return BUILT_IN_WORLD_RULE_TYPE_ID;
    case "s":
      return "scene";
    case "q":
      return "quest";
    case "d":
      return "dialogue";
    default:
      return null;
  }
}

function firstProjectSelection(project: StoryProject): Selection | null {
  const firstEntity = Object.keys(project.entities)[0];

  return firstEntity ? { kind: "entity", id: firstEntity } : null;
}

function hasVisibleInspector(project: StoryProject, selection: Selection | null): boolean {
  if (selection?.kind === "entity") {
    return Boolean(project.entities[selection.id]);
  }

  if (selection?.kind === "relationship") {
    return (
      project.relationships.some((relationship) => relationship.id === selection.id) ||
      project.gameplayTransitions.some((transition) => transition.id === selection.id)
    );
  }

  return false;
}

function createEntityGraphFocus(
  project: StoryProject,
  selection: Selection | null,
  depth: GraphFocusDepth,
  graphView: GraphView
): EntityGraphFocus | null {
  const visibleEntityIds = graphViewEntityIds(project, graphView);

  if (
    depth === "all" ||
    selection?.kind !== "entity" ||
    !project.entities[selection.id] ||
    !visibleEntityIds.has(selection.id)
  ) {
    return null;
  }

  const connectedEntityIds = new Set([selection.id]);
  const relationshipIds = new Set<string>();
  let frontier = [selection.id];
  const relationships = graphViewRelationships(project, graphView);

  for (let currentDepth = 0; currentDepth < depth && frontier.length; currentDepth += 1) {
    const frontierIds = new Set(frontier);
    const nextFrontier: string[] = [];

    for (const relationship of relationships) {
      const sourceInFrontier = frontierIds.has(relationship.sourceId);
      const targetInFrontier = frontierIds.has(relationship.targetId);

      if (!sourceInFrontier && !targetInFrontier) {
        continue;
      }

      relationshipIds.add(relationship.id);

      const relatedEntityIds = [relationship.sourceId, relationship.targetId];

      for (const entityId of relatedEntityIds) {
        if (!project.entities[entityId] || !visibleEntityIds.has(entityId) || connectedEntityIds.has(entityId)) {
          continue;
        }

        connectedEntityIds.add(entityId);
        nextFrontier.push(entityId);
      }
    }

    frontier = nextFrontier;
  }

  return {
    connectedEntityIds,
    relationshipIds
  };
}

function projectNodes(
  project: StoryProject,
  selection: Selection | null,
  graphFocus: EntityGraphFocus | null,
  graphView: GraphView
): Node<EntityNodeData, "storyEntity">[] {
  const layout = projectLayoutForView(project, graphView);
  const parallelHandlesByEntityId = parallelRelationshipHandlesByEntityId(graphViewRelationships(project, graphView));

  return graphViewEntities(project, graphView).map((entity) => {
    const gameMetadata = entity.gameStory ? normalizeGameStoryEntityMetadata(entity.gameStory, entity.type) : null;
    const outgoingTargets = outgoingGraphViewTargets(project, entity.id);
    const parallelHandles = parallelHandlesByEntityId.get(entity.id);

    return {
      id: entity.id,
      type: "storyEntity",
      position: layout[entity.id] ?? { x: 80, y: 80 },
      data: {
        entity,
        itemType: findItemType(project, entity.type),
        sourceHandles: parallelHandles?.sourceHandles ?? [],
        targetHandles: parallelHandles?.targetHandles ?? [],
        isSelected: selection?.kind === "entity" && selection.id === entity.id,
        isConnectedToFocus: graphFocus?.connectedEntityIds.has(entity.id) ?? false,
        isFaded: Boolean(graphFocus && !graphFocus.connectedEntityIds.has(entity.id)),
        isGameStart: graphView === "story_flow" && project.gameStory?.startNodeId === entity.id,
        isGameEnding: graphView === "story_flow" && gameMetadata?.role === "ending",
        isGameCriticalPath: graphView === "story_flow" && Boolean(gameMetadata?.criticalPath),
        isGameGated: graphView === "story_flow" && Boolean(gameMetadata?.entryConditions.length),
        isGameDeadEnd:
          graphView === "story_flow" &&
          Boolean(gameMetadata) &&
          gameMetadata?.role !== "ending" &&
          outgoingTargets.length === 0
      }
    };
  });
}

function syncProjectNodes(
  currentNodes: Node<EntityNodeData, "storyEntity">[],
  project: StoryProject,
  selection: Selection | null,
  graphFocus: EntityGraphFocus | null,
  graphView: GraphView
): Node<EntityNodeData, "storyEntity">[] {
  const currentNodeById = new Map(currentNodes.map((node) => [node.id, node]));
  const layout = projectLayoutForView(project, graphView);
  const parallelHandlesByEntityId = parallelRelationshipHandlesByEntityId(graphViewRelationships(project, graphView));

  return graphViewEntities(project, graphView).map((entity) => {
    const currentNode = currentNodeById.get(entity.id);
    const savedPosition = layout[entity.id];
    const gameMetadata = entity.gameStory ? normalizeGameStoryEntityMetadata(entity.gameStory, entity.type) : null;
    const outgoingTargets = outgoingGraphViewTargets(project, entity.id);
    const parallelHandles = parallelHandlesByEntityId.get(entity.id);
    const position = isFinitePoint(savedPosition)
      ? savedPosition
      : isFinitePoint(currentNode?.position)
        ? currentNode.position
        : { x: 80, y: 80 };

    return {
      ...currentNode,
      id: entity.id,
      type: "storyEntity",
      position,
      data: {
        entity,
        itemType: findItemType(project, entity.type),
        sourceHandles: parallelHandles?.sourceHandles ?? [],
        targetHandles: parallelHandles?.targetHandles ?? [],
        isSelected: selection?.kind === "entity" && selection.id === entity.id,
        isConnectedToFocus: graphFocus?.connectedEntityIds.has(entity.id) ?? false,
        isFaded: Boolean(graphFocus && !graphFocus.connectedEntityIds.has(entity.id)),
        isGameStart: graphView === "story_flow" && project.gameStory?.startNodeId === entity.id,
        isGameEnding: graphView === "story_flow" && gameMetadata?.role === "ending",
        isGameCriticalPath: graphView === "story_flow" && Boolean(gameMetadata?.criticalPath),
        isGameGated: graphView === "story_flow" && Boolean(gameMetadata?.entryConditions.length),
        isGameDeadEnd:
          graphView === "story_flow" &&
          Boolean(gameMetadata) &&
          gameMetadata?.role !== "ending" &&
          outgoingTargets.length === 0
      }
    };
  });
}

function graphViewEntities(project: StoryProject, graphView: GraphView): StoryEntity[] {
  return Object.values(project.entities).filter((entity) => entityVisibleInGraph(entity, graphView));
}

function graphViewEntityIds(project: StoryProject, graphView: GraphView): Set<string> {
  return new Set(graphViewEntities(project, graphView).map((entity) => entity.id));
}

function graphViewRelationships(project: StoryProject, graphView: GraphView): StoryRelationship[] {
  const visibleEntityIds = graphViewEntityIds(project, graphView);

  if (graphView === "story_flow") {
    return getGameStoryRelationships(project).filter(
      (relationship) => visibleEntityIds.has(relationship.sourceId) && visibleEntityIds.has(relationship.targetId)
    );
  }

  return project.relationships.filter((relationship) => {
    if (!visibleEntityIds.has(relationship.sourceId) || !visibleEntityIds.has(relationship.targetId)) {
      return false;
    }

    return !isGameStoryLinkType(relationship.type) && !relationship.gameStory;
  });
}

interface ParallelRelationshipLayout {
  sourceHandle: string;
  targetHandle: string;
  labelOffset: number;
}

interface EntityParallelHandles {
  sourceHandles: EntityNodeHandle[];
  targetHandles: EntityNodeHandle[];
}

function parallelRelationshipLayoutById(relationships: StoryRelationship[]): Map<string, ParallelRelationshipLayout> {
  const layoutByRelationshipId = new Map<string, ParallelRelationshipLayout>();

  for (const parallelRelationships of parallelRelationshipGroups(relationships).values()) {
    if (parallelRelationships.length <= 1) {
      continue;
    }

    parallelRelationships.forEach((relationship, index) => {
      layoutByRelationshipId.set(relationship.id, {
        sourceHandle: parallelSourceHandleId(relationship.targetId, index),
        targetHandle: parallelTargetHandleId(relationship.sourceId, index),
        labelOffset: relationshipLabelOffset(index)
      });
    });
  }

  return layoutByRelationshipId;
}

function parallelRelationshipHandlesByEntityId(relationships: StoryRelationship[]): Map<string, EntityParallelHandles> {
  const handlesByEntityId = new Map<string, EntityParallelHandles>();

  for (const parallelRelationships of parallelRelationshipGroups(relationships).values()) {
    if (parallelRelationships.length <= 1) {
      continue;
    }

    parallelRelationships.forEach((relationship, index) => {
      const sourceHandles = entityParallelHandles(handlesByEntityId, relationship.sourceId);
      const targetHandles = entityParallelHandles(handlesByEntityId, relationship.targetId);
      const offset = relationshipHandleOffset(index);

      sourceHandles.sourceHandles.push({
        id: parallelSourceHandleId(relationship.targetId, index),
        offset
      });
      targetHandles.targetHandles.push({
        id: parallelTargetHandleId(relationship.sourceId, index),
        offset
      });
    });
  }

  return handlesByEntityId;
}

function parallelRelationshipGroups(relationships: StoryRelationship[]): Map<string, StoryRelationship[]> {
  const relationshipsBySourceTarget = new Map<string, StoryRelationship[]>();

  for (const relationship of relationships) {
    const key = `${relationship.sourceId}\u0000${relationship.targetId}`;
    relationshipsBySourceTarget.set(key, [...(relationshipsBySourceTarget.get(key) ?? []), relationship]);
  }

  return relationshipsBySourceTarget;
}

function entityParallelHandles(handlesByEntityId: Map<string, EntityParallelHandles>, entityId: string): EntityParallelHandles {
  const handles = handlesByEntityId.get(entityId) ?? {
    sourceHandles: [],
    targetHandles: []
  };

  handlesByEntityId.set(entityId, handles);

  return handles;
}

function parallelSourceHandleId(targetId: string, index: number): string {
  return `parallel-source-${targetId}-${index}`;
}

function parallelTargetHandleId(sourceId: string, index: number): string {
  return `parallel-target-${sourceId}-${index}`;
}

function relationshipHandleOffset(index: number): number {
  const lane = Math.floor(index / 2) + 1;
  const direction = index % 2 === 0 ? -1 : 1;

  return lane * direction * PARALLEL_HANDLE_OFFSET_STEP;
}

function relationshipLabelOffset(index: number): number {
  const lane = Math.floor(index / 2) + 1;
  const direction = index % 2 === 0 ? -1 : 1;

  return lane * direction * RELATIONSHIP_LABEL_OFFSET_STEP;
}

function outgoingGraphViewTargets(project: StoryProject, entityId: string): string[] {
  const gameNodeIds = new Set(getGameStoryNodes(project).map((entity) => entity.id));
  const branchTargets = project.gameplayTransitions
    .filter((transition) => transition.sourceNodeId === entityId)
    .map((transition) => transition.targetNodeId);
  const legacyBranchTargets = project.relationships
    .filter((relationship) => relationship.sourceId === entityId && relationship.type === "branches_to")
    .map((relationship) => relationship.targetId);
  const responseTargets =
    project.entities[entityId]?.gameStory?.dialogue?.responses
      .map((response) => response.targetNodeId)
      .filter((targetId): targetId is string => Boolean(targetId)) ?? [];

  return [...branchTargets, ...legacyBranchTargets, ...responseTargets].filter((targetId) => gameNodeIds.has(targetId));
}

function relationshipOpacity(active: boolean, fadedByFocus: boolean, connectedToFocus: boolean): number {
  if (fadedByFocus) {
    return active ? 0.12 : 0.08;
  }

  if (!active) {
    return connectedToFocus ? 0.42 : 0.28;
  }

  return 1;
}

function relationshipLabelOpacity(active: boolean, fadedByFocus: boolean, connectedToFocus: boolean): number {
  if (fadedByFocus) {
    return active ? 0.2 : 0.12;
  }

  if (!active) {
    return connectedToFocus ? 0.58 : 0.42;
  }

  return 1;
}

function isPositionNodeChange(change: NodeChange): change is PositionNodeChange {
  return change.type === "position";
}

function isValidPositionNodeChange(change: NodeChange): change is ValidPositionNodeChange {
  return isPositionNodeChange(change) && isFinitePoint(change.position);
}

function isFinitePoint(point: Point | undefined): point is Point {
  return point !== undefined && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function readStoredGraphFocusDepth(): GraphFocusDepth {
  if (typeof window === "undefined") {
    return 1;
  }

  try {
    return parseGraphFocusDepth(window.localStorage.getItem(GRAPH_FOCUS_DEPTH_STORAGE_KEY)) ?? 1;
  } catch {
    return 1;
  }
}

function writeStoredGraphFocusDepth(depth: GraphFocusDepth) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(GRAPH_FOCUS_DEPTH_STORAGE_KEY, String(depth));
  } catch {
    // Ignore unavailable browser storage; focus depth can still work for the current session.
  }
}

function readStoredRecentProjects(): RecentProjectCard[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const value = window.localStorage.getItem(RECENT_PROJECTS_STORAGE_KEY);

    if (!value) {
      return [];
    }

    const projects = JSON.parse(value) as RecentProjectCard[];

    return Array.isArray(projects) ? projects.filter(isRecentProjectCard).slice(0, 12) : [];
  } catch {
    return [];
  }
}

function writeStoredRecentProjects(projects: RecentProjectCard[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(RECENT_PROJECTS_STORAGE_KEY, JSON.stringify(projects.slice(0, 12)));
  } catch {
    // Browser storage is a convenience cache only; project files and cloud rows remain canonical.
  }
}

function starterProjectForMode(projectMode: ProjectMode) {
  const starterProject = getStarterProjects().find((project) => project.projectMode === projectMode);

  if (!starterProject) {
    throw new Error(`No sample project is available for ${projectMode === "game_story" ? "Game Story" : "Story"} mode.`);
  }

  return starterProject;
}

function starterProjectIdForMode(projectMode: ProjectMode): string {
  return starterProjectForMode(projectMode).id;
}

function sampleProjectErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Could not load the sample project.";

  return `Could not create the sample project. ${message}`;
}

function upsertRecentProject(projects: RecentProjectCard[], project: RecentProjectCard): RecentProjectCard[] {
  return [project, ...projects.filter((currentProject) => currentProject.id !== project.id)]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 12);
}

function workspaceSeedFromRecentProject(
  projectId: string,
  recentProjects: RecentProjectCard[]
): WorkspaceProjectSeed | undefined {
  const recentProject = recentProjects.find((project) => project.id === projectId);

  if (!recentProject?.project) {
    return undefined;
  }

  return {
    id: recentProject.id,
    project: recentProject.project,
    status:
      recentProject.source === "backup"
        ? "Recent backup restored"
        : recentProject.source === "folder"
          ? "Recent folder snapshot restored"
          : "Recent project restored",
    storageMode: "local"
  };
}

function isRecentProjectCard(value: unknown): value is RecentProjectCard {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RecentProjectCard>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    (candidate.source === "folder" || candidate.source === "backup" || candidate.source === "browser") &&
    (candidate.projectMode === "story" || candidate.projectMode === "game_story") &&
    typeof candidate.updatedAt === "string"
  );
}

function createLocalProjectRouteId(source: RecentProjectSource): string {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  return `${source}-${randomId}`;
}

function isLocalProjectRouteId(projectId: string): boolean {
  return projectId.startsWith("browser-") || projectId.startsWith("folder-") || projectId.startsWith("backup-");
}

function parseGraphFocusDepth(value: string | null): GraphFocusDepth | null {
  if (value === "1") {
    return 1;
  }

  if (value === "2") {
    return 2;
  }

  if (value === "3") {
    return 3;
  }

  if (value === "4") {
    return 4;
  }

  return value === "all" ? "all" : null;
}

function cloudStatusLabel(status: CloudSyncStatus): string {
  switch (status) {
    case "signed_out":
      return "Signed out";
    case "idle":
      return "Ready";
    case "saving":
      return "Saving";
    case "saved":
      return "Saved";
    case "conflict":
      return "Conflict";
    case "error":
      return "Error";
  }
}

function upsertCloudProjectSummary(
  projects: CloudProjectSummary[],
  project: CloudProjectSummary
): CloudProjectSummary[] {
  return [project, ...projects.filter((currentProject) => currentProject.id !== project.id)].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
}

function parseCloudStoredSettings(value: unknown): CloudStoredSettings {
  if (!value || typeof value !== "object") {
    return {};
  }

  const candidate = value as Partial<CloudStoredSettings>;
  const settings: CloudStoredSettings = {};

  const graphFocusDepth = parseGraphFocusDepth(String(candidate.graphFocusDepth ?? ""));

  if (graphFocusDepth) {
    settings.graphFocusDepth = graphFocusDepth;
  }

  return settings;
}

function projectFolderErrorMessage(error: unknown, abortMessage: string): string {
  const name = error instanceof DOMException ? error.name : "";
  const message = error instanceof Error ? error.message : "";

  if (name === "AbortError") {
    return abortMessage;
  }

  if (/user gesture|secure context|not allowed|not supported/i.test(message)) {
    return FOLDER_ACCESS_UNAVAILABLE_MESSAGE;
  }

  return message || "Could not access the project folder";
}
