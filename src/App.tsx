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
  Save,
  ScrollText,
  Settings2,
  Trash2
} from "lucide-react";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentPanel } from "./components/AgentPanel";
import { CloudAuthDialog, CloudConflictDialog, CloudProjectsDialog } from "./components/CloudDialogs";
import { DetailInspector } from "./components/DetailInspector";
import { EntityNode, EntityNodeData } from "./components/EntityNode";
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
  getTimelineEvents,
  isRelationshipActiveAt,
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
  setProjectModeInProject,
  touchProject,
  updateGameStoryProjectMetadata,
  updateEntityInProject,
  updateRelationshipInProject
} from "./data/story";
import { createLoadingProject, loadStarterProject } from "./data/starterProject";
import {
  createProjectBundle,
  hasFolderProjectSupport,
  projectFromBundleFile,
  readProjectFromDirectory,
  writeProjectToDirectory
} from "./data/projectFiles";
import { AgentSettings, readStoredAgentSettings, writeStoredAgentSettings } from "./data/agent";
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
  subscribeToCloudAuth,
  writeCloudUserSettings
} from "./data/cloudProjects";
import {
  BUILT_IN_EVENT_TYPE_ID,
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
type ActivePage = "workspace" | "settings";

interface CloudStoredSettings {
  agentSettings?: AgentSettings;
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
const RELATIONSHIP_LABEL_OFFSET_STEP = 18;
const graphFocusDepthOptions: Array<{ label: string; value: GraphFocusDepth }> = [
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "All", value: "all" }
];

export function App() {
  return (
    <ReactFlowProvider>
      <StoryWorkspace />
    </ReactFlowProvider>
  );
}

function StoryWorkspace() {
  const initialProject = useMemo(() => createLoadingProject(), []);
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
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode>("local");
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>("signed_out");
  const [cloudVersion, setCloudVersion] = useState<number | null>(null);
  const [cloudProjects, setCloudProjects] = useState<CloudProjectSummary[]>([]);
  const [cloudProjectsLoading, setCloudProjectsLoading] = useState(false);
  const [cloudAuthOpen, setCloudAuthOpen] = useState(false);
  const [cloudProjectsOpen, setCloudProjectsOpen] = useState(false);
  const [cloudConflictOpen, setCloudConflictOpen] = useState(false);
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(() => readStoredAgentSettings());
  const [defaultRelationshipType, setDefaultRelationshipType] = useState<LinkTypeId>("relates_to");
  const [activePage, setActivePage] = useState<ActivePage>("workspace");
  const [guideOpen, setGuideOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [gameToolsOpen, setGameToolsOpen] = useState(false);
  const [rulebookOpen, setRulebookOpen] = useState(false);
  const [selectedTimelineEventId, setSelectedTimelineEventId] = useState<string | null>(null);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [graphView, setGraphView] = useState<GraphView>("world");
  const [activeGameTool, setActiveGameTool] = useState<GameToolTab>("state");
  const backupInputRef = useRef<HTMLInputElement>(null);
  const cloudImportInputRef = useRef<HTMLInputElement>(null);
  const cloudSettingsUserRef = useRef<string | null>(null);
  const graphFocus = useMemo(
    () => createEntityGraphFocus(project, selection, graphFocusDepth, graphView),
    [graphFocusDepth, graphView, project, selection]
  );
  const graphRelationships = useMemo(() => graphViewRelationships(project, graphView), [graphView, project]);
  const continuityIssueCount = useMemo(
    () => (project.projectMode === "game_story" ? getGameContinuityIssues(project).length : 0),
    [project]
  );

  useEffect(() => {
    graphFocusDepthRef.current = graphFocusDepth;
  }, [graphFocusDepth]);

  useEffect(() => {
    writeStoredAgentSettings(agentSettings);
  }, [agentSettings]);

  useEffect(() => {
    let cancelled = false;

    async function loadCloudUser() {
      try {
        const user = await getCurrentCloudUser();

        if (!cancelled) {
          setCloudUser(user);
          setCloudSyncStatus(user ? "idle" : "signed_out");
        }
      } catch {
        if (!cancelled) {
          setCloudUser(null);
          setCloudSyncStatus("signed_out");
        }
      }
    }

    void loadCloudUser();

    const unsubscribe = subscribeToCloudAuth((user) => {
      if (cancelled) {
        return;
      }

      setCloudUser(user);
      setCloudSyncStatus(user ? "idle" : "signed_out");

      if (!user) {
        setCloudProjectId(null);
        setCloudVersion(null);
        setStorageMode("local");
        cloudSettingsUserRef.current = null;
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

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

        if (settings.agentSettings) {
          setAgentSettings(settings.agentSettings);
        }

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
      const settings: CloudStoredSettings = {
        agentSettings,
        graphFocusDepth
      };

      void writeCloudUserSettings(settings).catch((error) => setStatus((error as Error).message));
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [agentSettings, cloudUser, graphFocusDepth]);

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
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
        setFlowNodes(projectNodes(blankProject, null, null, "world"));
        setStatus((error as Error).message);
      }
    }

    void loadProject();

    return () => {
      cancelled = true;
    };
  }, []);

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
    }
  }, [project.projectMode]);

  const edges = useMemo<RelationshipEdgeType[]>(
    () => {
      const labelOffsetByRelationshipId = relationshipLabelOffsetById(graphRelationships);

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
          label: gameRelationship?.choiceText || resolvedRelationship.label || linkType.label,
          type: "relationship",
          data: {
            labelOffset: labelOffsetByRelationshipId.get(relationship.id) ?? 0
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
      setFlowNodes(projectNodes(loadedProject, nextSelection, nextGraphFocus, nextGraphView));
      setSelectedTimelineEventId(null);
      setIsDirty(false);
      setStatus(nextStatus);
    },
    [cloudUser]
  );

  const handleProjectModeChange = useCallback(
    (projectMode: ProjectMode) => {
      if (project.projectMode === projectMode) {
        return;
      }

      const nextProject = setProjectModeInProject(project, projectMode);
      const nextGraphView = projectMode === "game_story" ? "story_flow" : "world";
      markProjectChanged(nextProject);
      setGraphView(nextGraphView);

      if (projectMode === "game_story") {
        setDefaultRelationshipType("branches_to");
      } else {
        setDefaultRelationshipType("relates_to");
      }
    },
    [markProjectChanged, project]
  );

  const handleGraphViewChange = useCallback((nextGraphView: GraphView) => {
    setGraphView(nextGraphView);

    if (nextGraphView === "story_flow") {
      setDefaultRelationshipType("branches_to");
    } else {
      setDefaultRelationshipType((currentType) => (isGameStoryLinkType(currentType) ? "relates_to" : currentType));
    }
  }, []);

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

      const relationshipType = graphView === "story_flow" && project.projectMode === "game_story" ? "branches_to" : defaultRelationshipType;
      const relationship = createStoryRelationship(project, connection.source, connection.target, relationshipType);
      const nextEdges = addEdge({ ...connection, id: relationship.id }, edges);

      if (nextEdges.length === edges.length) {
        return;
      }

      markProjectChanged({
        ...touchProject(project),
        relationships: [...project.relationships, relationship]
      });
      setSelection({ kind: "relationship", id: relationship.id });
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

  const handleNewProject = useCallback(async () => {
    const nextProject = createBlankProject();

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
        setStatus("Choose a project folder to create a new project");
        return;
      }

      await writeProjectToDirectory(nextProject, handle);
      loadProjectIntoWorkspace(nextProject, "Project saved", {
        folderHandle: handle,
        storageMode: "local"
      });
    } catch (error) {
      setStatus(projectFolderErrorMessage(error, "Choose a project folder to create a new project"));
      return;
    }
  }, [loadProjectIntoWorkspace]);

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

  const handleFocusWorldRule = useCallback((id: string) => {
    setSelection({ kind: "entity", id });
  }, []);

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
    } catch (error) {
      setStatus(projectFolderErrorMessage(error, "Choose a project folder to save"));
    }
  }, [cloudUser, project]);

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
    } catch (error) {
      setStatus(projectFolderErrorMessage(error, "Choose a project folder to save"));
    }
  }, [cloudUser, folderHandle, project]);

  const handleOpenProject = useCallback(async () => {
    if (!hasFolderProjectSupport()) {
      backupInputRef.current?.click();
      return;
    }

    try {
      const handle = await window.showDirectoryPicker?.({
        id: "storyteller-project",
        mode: "readwrite"
      });

      if (!handle) {
        setStatus("Choose a project folder to open");
        return;
      }

      const loadedProject = await readProjectFromDirectory(handle);
      loadProjectIntoWorkspace(loadedProject, "Project opened", {
        folderHandle: handle,
        storageMode: "local"
      });
    } catch (error) {
      setStatus(projectFolderErrorMessage(error, "Choose a project folder to open"));
    }
  }, [loadProjectIntoWorkspace]);

  const handleExportBackup = useCallback(() => {
    downloadProjectBackup();
    setStatus("Backup exported");
  }, [downloadProjectBackup]);

  const handleImportFileSelected = useCallback(async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const loadedProject = await projectFromBundleFile(file);
      loadProjectIntoWorkspace(loadedProject, "Project opened from backup", {
        storageMode: "local"
      });
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      if (backupInputRef.current) {
        backupInputRef.current.value = "";
      }
    }
  }, [loadProjectIntoWorkspace]);

  const refreshCloudProjects = useCallback(async () => {
    if (!cloudUser) {
      setCloudAuthOpen(true);
      setStatus("Sign in to use cloud projects");
      return;
    }

    setCloudProjectsLoading(true);

    try {
      setCloudProjects(await listCloudProjects());
    } catch (error) {
      setStatus((error as Error).message);
      setCloudSyncStatus("error");
    } finally {
      setCloudProjectsLoading(false);
    }
  }, [cloudUser]);

  const handleOpenCloudProjects = useCallback(async () => {
    if (!cloudUser) {
      setCloudAuthOpen(true);
      setStatus("Sign in to use cloud projects");
      return;
    }

    setCloudProjectsOpen(true);
    await refreshCloudProjects();
  }, [cloudUser, refreshCloudProjects]);

  const handlePasswordSignIn = useCallback(async (email: string, password: string) => {
    const user = await signInWithPassword(email, password);
    setCloudUser(user);
    setCloudSyncStatus("idle");
    setStatus("Signed in");
  }, []);

  const handleMagicLink = useCallback(async (email: string) => {
    await sendMagicLink(email);
    setStatus("Magic link sent");
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOutCloudUser();
    setCloudUser(null);
    setCloudProjectId(null);
    setCloudVersion(null);
    setStorageMode("local");
    setCloudSyncStatus("signed_out");
    setStatus("Signed out");
  }, []);

  const handleOpenCloudProject = useCallback(
    async (id: string) => {
      const loadedProject = await openCloudProject(id);

      loadProjectIntoWorkspace(loadedProject.project, "Cloud project opened", {
        cloudProjectId: loadedProject.id,
        cloudVersion: loadedProject.version,
        storageMode: "cloud"
      });
      setCloudProjectsOpen(false);
    },
    [loadProjectIntoWorkspace]
  );

  const handleDeleteCloudProject = useCallback(
    async (id: string) => {
      await deleteCloudProject(id);

      if (cloudProjectId === id) {
        setCloudProjectId(null);
        setCloudVersion(null);
        setStorageMode("local");
        setCloudSyncStatus(cloudUser ? "idle" : "signed_out");
      }

      setStatus("Cloud project deleted");
      await refreshCloudProjects();
    },
    [cloudProjectId, cloudUser, refreshCloudProjects]
  );

  const handleSaveToCloud = useCallback(async () => {
    if (!cloudUser) {
      setCloudAuthOpen(true);
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
      setCloudProjects((projects) => upsertCloudProjectSummary(projects, savedProject));
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
  }, [cloudProjectId, cloudUser, cloudVersion, project]);

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
    setCloudProjects((projects) => upsertCloudProjectSummary(projects, savedProject));
  }, [cloudUser, loadProjectIntoWorkspace, project]);

  const handleImportBackupToCloudSelected = useCallback(
    async (file: File | null) => {
      if (!file) {
        return;
      }

      if (!cloudUser) {
        setCloudAuthOpen(true);
        setStatus("Sign in before importing to cloud");
        return;
      }

      try {
        const importedProject = await projectFromBundleFile(file);
        const savedProject = await createCloudProject(importedProject);

        loadProjectIntoWorkspace(savedProject.project, "Backup imported to cloud", {
          cloudProjectId: savedProject.id,
          cloudVersion: savedProject.version,
          storageMode: "cloud"
        });
        setCloudProjects((projects) => upsertCloudProjectSummary(projects, savedProject));
        setCloudProjectsOpen(false);
      } catch (error) {
        setCloudSyncStatus("error");
        setStatus((error as Error).message);
      } finally {
        if (cloudImportInputRef.current) {
          cloudImportInputRef.current.value = "";
        }
      }
    },
    [cloudUser, loadProjectIntoWorkspace]
  );

  return (
    <div className="app-shell">
      <input
        ref={backupInputRef}
        className="visually-hidden"
        type="file"
        accept=".storyteller.json,application/json"
        onChange={(event) => void handleImportFileSelected(event.target.files?.[0] ?? null)}
      />
      <input
        ref={cloudImportInputRef}
        className="visually-hidden"
        type="file"
        accept=".storyteller.json,application/json"
        onChange={(event) => void handleImportBackupToCloudSelected(event.target.files?.[0] ?? null)}
      />

      <header className="topbar">
        <div className="topbar-project">
          <strong>{project.title}</strong>
          <div className="topbar-meta">
            <span>{Object.keys(project.entities).length} items</span>
            <span>{project.relationships.length} links</span>
            {project.projectMode === "game_story" ? <span>{continuityIssueCount} issues</span> : null}
            <span className={isDirty ? "topbar-status is-dirty" : "topbar-status"}>{status}</span>
            <span>
              Folder: <strong>{folderHandle?.name ?? "Not selected"}</strong>
            </span>
            <span>
              Storage: <strong>{storageMode === "cloud" ? "Cloud" : "Local"}</strong>
            </span>
            <span>
              Cloud: <strong>{cloudStatusLabel(cloudSyncStatus)}</strong>
            </span>
            {cloudVersion !== null ? (
              <span>
                Version: <strong>{cloudVersion}</strong>
              </span>
            ) : null}
          </div>
        </div>
        <nav className="topbar-actions" aria-label="Project commands">
          <HeaderIconButton
            label={cloudUser ? "Sign Out" : "Sign In"}
            active={Boolean(cloudUser)}
            onClick={() => setCloudAuthOpen(true)}
          >
            {cloudUser ? <LogOut aria-hidden="true" /> : <LogIn aria-hidden="true" />}
          </HeaderIconButton>
          <HeaderIconButton label="Cloud Projects" onClick={() => void handleOpenCloudProjects()}>
            <Database aria-hidden="true" />
          </HeaderIconButton>
          <HeaderIconButton label="Save to Cloud" active={cloudSyncStatus === "saving"} onClick={() => void handleSaveToCloud()}>
            <CloudUpload aria-hidden="true" />
          </HeaderIconButton>
          {cloudProjectId ? (
            <HeaderIconButton label="Delete Cloud Project" onClick={() => void handleDeleteCloudProject(cloudProjectId)}>
              <Trash2 aria-hidden="true" />
            </HeaderIconButton>
          ) : null}
          <HeaderIconButton label="New Project" onClick={() => void handleNewProject()}>
            <FilePlus2 aria-hidden="true" />
          </HeaderIconButton>
          <HeaderIconButton label="Open Project" onClick={() => void handleOpenProject()}>
            <FolderOpen aria-hidden="true" />
          </HeaderIconButton>
          <HeaderIconButton label="Select Folder" onClick={() => void handleSelectProjectFolder()}>
            <FolderPlus aria-hidden="true" />
          </HeaderIconButton>
          <HeaderIconButton label="Save Project" onClick={() => void handleSaveProject()}>
            <Save aria-hidden="true" />
          </HeaderIconButton>
          <HeaderIconButton label="Export Backup" onClick={handleExportBackup}>
            <Download aria-hidden="true" />
          </HeaderIconButton>
          <HeaderIconButton label="Rulebook" onClick={handleOpenRulebook}>
            <ScrollText aria-hidden="true" />
          </HeaderIconButton>
          <HeaderIconButton
            label="AI Agent"
            active={agentOpen}
            onClick={() => {
              setActivePage("workspace");
              setAgentOpen((open) => !open);
            }}
          >
            <Bot aria-hidden="true" />
          </HeaderIconButton>
          {gameToolsAvailable ? (
            <HeaderIconButton
              label="Branching RPG"
              active={gameToolsVisible}
              onClick={() => {
                setActivePage("workspace");
                setGameToolsOpen((open) => !open);
              }}
            >
              <Gamepad2 aria-hidden="true" />
            </HeaderIconButton>
          ) : null}
          <HeaderIconButton label="Guide" active={guideOpen} onClick={() => setGuideOpen(true)}>
            <CircleHelp aria-hidden="true" />
          </HeaderIconButton>
          <HeaderIconButton
            label={activePage === "settings" ? "Back to Workspace" : "Open Settings"}
            active={activePage === "settings"}
            onClick={() => setActivePage((page) => (page === "settings" ? "workspace" : "settings"))}
          >
            {activePage === "settings" ? <ArrowLeft aria-hidden="true" /> : <Settings2 aria-hidden="true" />}
          </HeaderIconButton>
        </nav>
      </header>

      {guideOpen ? <InAppGuide onClose={() => setGuideOpen(false)} /> : null}
      {cloudAuthOpen ? (
        <CloudAuthDialog
          user={cloudUser}
          onClose={() => setCloudAuthOpen(false)}
          onMagicLink={handleMagicLink}
          onPasswordSignIn={handlePasswordSignIn}
          onSignOut={handleSignOut}
        />
      ) : null}
      {cloudProjectsOpen ? (
        <CloudProjectsDialog
          projects={cloudProjects}
          loading={cloudProjectsLoading}
          onClose={() => setCloudProjectsOpen(false)}
          onDelete={handleDeleteCloudProject}
          onImportBackupToCloud={() => cloudImportInputRef.current?.click()}
          onOpen={handleOpenCloudProject}
          onRefresh={refreshCloudProjects}
        />
      ) : null}
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
          agentSettings={agentSettings}
          defaultRelationshipType={defaultRelationshipType}
          onAddItemType={handleAddItemType}
          onAddLinkType={handleAddLinkType}
          onAgentSettingsChange={setAgentSettings}
          onBackToWorkspace={() => setActivePage("workspace")}
          onDefaultRelationshipTypeChange={setDefaultRelationshipType}
          onDeleteItemType={handleDeleteItemType}
          onDeleteLinkType={handleDeleteLinkType}
          onProjectModeChange={handleProjectModeChange}
          onProjectTitleChange={handleProjectTitleChange}
          onUpdateItemType={handleUpdateItemType}
          onUpdateLinkType={handleUpdateLinkType}
        />
      ) : (
        <main className={workspaceClassName}>
          <Sidebar
            project={project}
            search={search}
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
              <ReactFlow
                nodes={flowNodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.25 }}
                onNodesChange={handleNodesChange}
                onConnect={handleConnect}
                onNodeClick={(_, node) => setSelection({ kind: "entity", id: node.id })}
                onEdgeClick={(_, edge) => setSelection({ kind: "relationship", id: edge.id })}
                onPaneClick={() => setSelection(null)}
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
              onEntityChange={handleEntityChange}
              onRelationshipChange={handleRelationshipChange}
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

          {agentOpen ? (
            <AgentPanel
              agentSettings={agentSettings}
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
  children: ReactNode;
  label: string;
  onClick: () => void;
}

function HeaderIconButton({ active = false, children, label, onClick }: HeaderIconButtonProps) {
  return (
    <button
      type="button"
      className={active ? "toolbar-button is-active" : "toolbar-button"}
      aria-label={label}
      title={label}
      data-tooltip={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
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
    return project.relationships.some((relationship) => relationship.id === selection.id);
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

  return graphViewEntities(project, graphView).map((entity) => {
    const gameMetadata = entity.gameStory ? normalizeGameStoryEntityMetadata(entity.gameStory, entity.type) : null;
    const outgoingTargets = outgoingGraphViewTargets(project, entity.id);

    return {
      id: entity.id,
      type: "storyEntity",
      position: layout[entity.id] ?? { x: 80, y: 80 },
      data: {
        entity,
        itemType: findItemType(project, entity.type),
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

  return graphViewEntities(project, graphView).map((entity) => {
    const currentNode = currentNodeById.get(entity.id);
    const savedPosition = layout[entity.id];
    const gameMetadata = entity.gameStory ? normalizeGameStoryEntityMetadata(entity.gameStory, entity.type) : null;
    const outgoingTargets = outgoingGraphViewTargets(project, entity.id);
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

  return project.relationships.filter((relationship) => {
    if (!visibleEntityIds.has(relationship.sourceId) || !visibleEntityIds.has(relationship.targetId)) {
      return false;
    }

    return graphView === "story_flow"
      ? isGameStoryLinkType(relationship.type) || Boolean(relationship.gameStory)
      : !isGameStoryLinkType(relationship.type) && !relationship.gameStory;
  });
}

function relationshipLabelOffsetById(relationships: StoryRelationship[]): Map<string, number> {
  const relationshipsBySourceId = new Map<string, StoryRelationship[]>();

  for (const relationship of relationships) {
    relationshipsBySourceId.set(relationship.sourceId, [
      ...(relationshipsBySourceId.get(relationship.sourceId) ?? []),
      relationship
    ]);
  }

  const offsetByRelationshipId = new Map<string, number>();

  for (const sourceRelationships of relationshipsBySourceId.values()) {
    if (sourceRelationships.length === 1) {
      offsetByRelationshipId.set(sourceRelationships[0].id, 0);
      continue;
    }

    sourceRelationships.forEach((relationship, index) => {
      offsetByRelationshipId.set(relationship.id, relationshipLabelOffset(index));
    });
  }

  return offsetByRelationshipId;
}

function relationshipLabelOffset(index: number): number {
  const lane = Math.floor(index / 2) + 1;
  const direction = index % 2 === 0 ? -1 : 1;

  return lane * direction * RELATIONSHIP_LABEL_OFFSET_STEP;
}

function outgoingGraphViewTargets(project: StoryProject, entityId: string): string[] {
  const branchTargets = project.relationships
    .filter((relationship) => relationship.sourceId === entityId && relationship.type === "branches_to")
    .map((relationship) => relationship.targetId);
  const responseTargets =
    project.entities[entityId]?.gameStory?.dialogue?.responses
      .map((response) => response.targetNodeId)
      .filter((targetId): targetId is string => Boolean(targetId)) ?? [];

  return [...branchTargets, ...responseTargets].filter((targetId) => Boolean(project.entities[targetId]));
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

  if (isAgentSettings(candidate.agentSettings)) {
    settings.agentSettings = candidate.agentSettings;
  }

  const graphFocusDepth = parseGraphFocusDepth(String(candidate.graphFocusDepth ?? ""));

  if (graphFocusDepth) {
    settings.graphFocusDepth = graphFocusDepth;
  }

  return settings;
}

function isAgentSettings(value: unknown): value is AgentSettings {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as Partial<AgentSettings>).apiKey === "string" &&
    typeof (value as Partial<AgentSettings>).baseUrl === "string" &&
    typeof (value as Partial<AgentSettings>).model === "string"
  );
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
