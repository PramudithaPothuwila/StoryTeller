import {
  addEdge,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  MarkerType,
  MiniMap,
  Node,
  NodeChange,
  NodeTypes,
  ReactFlow,
  ReactFlowProvider
} from "@xyflow/react";
import { BookOpen, Gamepad2, ScrollText } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DetailInspector } from "./components/DetailInspector";
import { EntityNode, EntityNodeData } from "./components/EntityNode";
import { GameStoryPanel, type GameToolTab } from "./components/GameStoryPanel";
import { RulebookSidebar } from "./components/RulebookSidebar";
import { Sidebar } from "./components/Sidebar";
import { TimelinePanel } from "./components/TimelinePanel";
import { TypeManager } from "./components/TypeManager";
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
  findItemType,
  findLinkType,
  getGameContinuityIssues,
  getGameStoryNodes,
  getTimelineEvents,
  isRelationshipActiveAt,
  isGameStoryLinkType,
  moveTimelineEventInProject,
  nextEntityPosition,
  nextTimelineOrder,
  normalizeGameStoryEntityMetadata,
  normalizeGameStoryRelationshipMetadata,
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

const nodeTypes = {
  storyEntity: EntityNode
} satisfies NodeTypes;

const FOLDER_ACCESS_UNAVAILABLE_MESSAGE =
  "Folder selection is unavailable in this browser. Use a browser with folder access to save folder projects.";
const GRAPH_FOCUS_DEPTH_STORAGE_KEY = "storyteller.graphFocusDepth";
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
  const [defaultRelationshipType, setDefaultRelationshipType] = useState<LinkTypeId>("relates_to");
  const [typeManagerOpen, setTypeManagerOpen] = useState(false);
  const [rulebookOpen, setRulebookOpen] = useState(false);
  const [selectedTimelineEventId, setSelectedTimelineEventId] = useState<string | null>(null);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [graphView, setGraphView] = useState<GraphView>("world");
  const [activeGameTool, setActiveGameTool] = useState<GameToolTab>("state");
  const backupInputRef = useRef<HTMLInputElement>(null);
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

  const edges = useMemo<Edge[]>(
    () =>
      graphRelationships.map((relationship) => {
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
          type: "default",
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
      }),
    [graphFocus, graphRelationships, graphView, project, selectedTimelineEventId, selection]
  );
  const inspectorVisible = hasVisibleInspector(project, selection);
  const gameToolsVisible = project.projectMode === "game_story";
  const workspaceClassName = [
    "workspace",
    inspectorVisible ? "has-inspector" : "",
    rulebookOpen ? "has-rulebook" : "",
    gameToolsVisible ? "has-game-tools" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const markProjectChanged = useCallback((nextProject: StoryProject) => {
    setProject(nextProject);
    setIsDirty(true);
    setStatus("Unsaved changes");
  }, []);

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
    }
  }, []);

  const handleCreateEntity = useCallback(
    (type: ItemTypeId) => {
      const entity = createStoryEntity(type, project.itemTypes);

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
    [markProjectChanged, project]
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
        const nextLayout = { ...currentProject.layout };
        let moved = false;

        for (const change of positionChanges) {
          if (!currentProject.entities[change.id]) {
            continue;
          }

          const currentPosition = currentProject.layout[change.id] ?? { x: 80, y: 80 };

          if (currentPosition.x !== change.position.x || currentPosition.y !== change.position.y) {
            nextLayout[change.id] = {
              x: change.position.x,
              y: change.position.y
            };
            moved = true;
          }
        }

        return moved ? setProjectLayout(currentProject, nextLayout) : currentProject;
      });

      setIsDirty(true);
      setStatus("Unsaved changes");
    },
    []
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
      setProject(nextProject);
      setFolderHandle(handle);
      setSelection(null);
      setGraphView("world");
      setFlowNodes(projectNodes(nextProject, null, null, "world"));
      setSelectedTimelineEventId(null);
      setIsDirty(false);
      setStatus("Project saved");
    } catch (error) {
      setStatus(projectFolderErrorMessage(error, "Choose a project folder to create a new project"));
      return;
    }
  }, []);

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
      setIsDirty(false);
      setStatus("Project folder selected and saved");
    } catch (error) {
      setStatus(projectFolderErrorMessage(error, "Choose a project folder to save"));
    }
  }, [project]);

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
      setIsDirty(false);
      setStatus("Project saved");
    } catch (error) {
      setStatus(projectFolderErrorMessage(error, "Choose a project folder to save"));
    }
  }, [folderHandle, project]);

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
      const nextSelection = firstProjectSelection(loadedProject);
      const nextGraphView = loadedProject.projectMode === "game_story" ? "story_flow" : "world";
      const nextGraphFocus = createEntityGraphFocus(loadedProject, nextSelection, graphFocusDepthRef.current, nextGraphView);
      setProject(loadedProject);
      setFolderHandle(handle);
      setSelection(nextSelection);
      setGraphView(nextGraphView);
      setFlowNodes(projectNodes(loadedProject, nextSelection, nextGraphFocus, nextGraphView));
      setSelectedTimelineEventId(null);
      setIsDirty(false);
      setStatus("Project opened");
    } catch (error) {
      setStatus(projectFolderErrorMessage(error, "Choose a project folder to open"));
    }
  }, []);

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
      const nextSelection = firstProjectSelection(loadedProject);
      const nextGraphView = loadedProject.projectMode === "game_story" ? "story_flow" : "world";
      const nextGraphFocus = createEntityGraphFocus(loadedProject, nextSelection, graphFocusDepthRef.current, nextGraphView);
      setProject(loadedProject);
      setFolderHandle(null);
      setSelection(nextSelection);
      setGraphView(nextGraphView);
      setFlowNodes(projectNodes(loadedProject, nextSelection, nextGraphFocus, nextGraphView));
      setSelectedTimelineEventId(null);
      setIsDirty(false);
      setStatus("Project opened from backup");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      if (backupInputRef.current) {
        backupInputRef.current.value = "";
      }
    }
  }, []);

  return (
    <div className="app-shell">
      <input
        ref={backupInputRef}
        className="visually-hidden"
        type="file"
        accept=".storyteller.json,application/json"
        onChange={(event) => void handleImportFileSelected(event.target.files?.[0] ?? null)}
      />

      <header className="topbar">
        <div>
          <strong>{project.title}</strong>
          <span>{Object.keys(project.entities).length} items</span>
          <span>{project.relationships.length} links</span>
          {project.projectMode === "game_story" ? <span>{continuityIssueCount} issues</span> : null}
        </div>
        <div className="topbar-actions">
          <div className="mode-toggle" role="group" aria-label="Project mode">
            <button
              type="button"
              className={project.projectMode === "story" ? "is-active" : ""}
              aria-pressed={project.projectMode === "story"}
              onClick={() => handleProjectModeChange("story")}
            >
              <BookOpen aria-hidden="true" />
              Story
            </button>
            <button
              type="button"
              className={project.projectMode === "game_story" ? "is-active" : ""}
              aria-pressed={project.projectMode === "game_story"}
              onClick={() => handleProjectModeChange("game_story")}
            >
              <Gamepad2 aria-hidden="true" />
              Game Story
            </button>
          </div>
          <button type="button" onClick={() => setRulebookOpen(true)}>
            <ScrollText aria-hidden="true" />
            Rulebook
          </button>
        </div>
      </header>

      <main className={workspaceClassName}>
        <Sidebar
          project={project}
          search={search}
          status={status}
          isDirty={isDirty}
          projectFolderName={folderHandle?.name ?? null}
          defaultRelationshipType={defaultRelationshipType}
          onCreateEntity={handleCreateEntity}
          onNewProject={handleNewProject}
          onOpenTypeManager={() => setTypeManagerOpen(true)}
          onOpenProject={handleOpenProject}
          onSelectProjectFolder={handleSelectProjectFolder}
          onSaveProject={handleSaveProject}
          onExportBackup={handleExportBackup}
          onSelectEntity={(id) => setSelection({ kind: "entity", id })}
          onSearchChange={setSearch}
          onProjectTitleChange={handleProjectTitleChange}
          onDefaultRelationshipTypeChange={setDefaultRelationshipType}
        />

        <section className="graph-column">
          <section className="graph-shell" aria-label="Story graph">
            {project.projectMode === "game_story" ? (
              <div className="graph-view-control" role="group" aria-label="Graph view">
                <button
                  type="button"
                  className={graphView === "world" ? "is-active" : ""}
                  onClick={() => handleGraphViewChange("world")}
                >
                  World
                </button>
                <button
                  type="button"
                  className={graphView === "story_flow" ? "is-active" : ""}
                  onClick={() => handleGraphViewChange("story_flow")}
                >
                  Story Flow
                </button>
              </div>
            ) : null}
            <div className="graph-focus-control" role="group" aria-label="Graph focus depth">
              {graphFocusDepthOptions.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className={graphFocusDepth === option.value ? "is-active" : ""}
                  aria-label={`Graph focus depth ${option.label}`}
                  title={`Graph focus depth ${option.label}`}
                  onClick={() => handleGraphFocusDepthChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <ReactFlow
              nodes={flowNodes}
              edges={edges}
              nodeTypes={nodeTypes}
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

      {typeManagerOpen ? (
        <TypeManager
          project={project}
          onClose={() => setTypeManagerOpen(false)}
          onAddItemType={handleAddItemType}
          onAddLinkType={handleAddLinkType}
          onUpdateItemType={handleUpdateItemType}
          onUpdateLinkType={handleUpdateLinkType}
          onDeleteItemType={handleDeleteItemType}
          onDeleteLinkType={handleDeleteLinkType}
        />
      ) : null}

    </div>
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
  return graphViewEntities(project, graphView).map((entity) => {
    const gameMetadata = entity.gameStory ? normalizeGameStoryEntityMetadata(entity.gameStory, entity.type) : null;
    const outgoingTargets = outgoingGraphViewTargets(project, entity.id);

    return {
    id: entity.id,
    type: "storyEntity",
    position: project.layout[entity.id] ?? { x: 80, y: 80 },
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

  return graphViewEntities(project, graphView).map((entity) => {
    const currentNode = currentNodeById.get(entity.id);
    const savedPosition = project.layout[entity.id];
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
  if (graphView === "story_flow") {
    return getGameStoryNodes(project);
  }

  return Object.values(project.entities);
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

    return graphView === "story_flow" ? isGameStoryLinkType(relationship.type) || Boolean(relationship.gameStory) : true;
  });
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
