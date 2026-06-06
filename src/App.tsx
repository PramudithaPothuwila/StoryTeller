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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DetailInspector } from "./components/DetailInspector";
import { EntityNode, EntityNodeData } from "./components/EntityNode";
import { Sidebar } from "./components/Sidebar";
import { TimelinePanel } from "./components/TimelinePanel";
import { TypeManager } from "./components/TypeManager";
import {
  addEntityToProject,
  applyTimelineEffectToProject,
  createBlankProject,
  createCustomItemType,
  createCustomLinkType,
  createStoryEntity,
  createStoryRelationship,
  deleteEntityFromProject,
  deleteItemTypeFromProject,
  deleteLinkTypeFromProject,
  deleteRelationshipFromProject,
  findItemType,
  findLinkType,
  isRelationshipActiveAt,
  nextEntityPosition,
  nextTimelineOrder,
  resolveRelationshipAt,
  setProjectLayout,
  touchProject,
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
  ItemTypeDefinition,
  ItemTypeId,
  LinkTypeDefinition,
  LinkTypeId,
  Point,
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

const nodeTypes = {
  storyEntity: EntityNode
} satisfies NodeTypes;

const FOLDER_ACCESS_UNAVAILABLE_MESSAGE =
  "Folder selection is unavailable in this browser. Use a browser with folder access to save folder projects.";

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
  const initialGraphFocus = useMemo(
    () => createEntityGraphFocus(initialProject, initialSelection),
    [initialProject, initialSelection]
  );
  const [project, setProject] = useState<StoryProject>(() => initialProject);
  const [selection, setSelection] = useState<Selection | null>(() => initialSelection);
  const [flowNodes, setFlowNodes] = useState<Node<EntityNodeData, "storyEntity">[]>(() =>
    projectNodes(initialProject, initialSelection, initialGraphFocus)
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Ready");
  const [isDirty, setIsDirty] = useState(false);
  const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [defaultRelationshipType, setDefaultRelationshipType] = useState<LinkTypeId>("relates_to");
  const [typeManagerOpen, setTypeManagerOpen] = useState(false);
  const [selectedTimelineEventId, setSelectedTimelineEventId] = useState<string | null>(null);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const graphFocus = useMemo(() => createEntityGraphFocus(project, selection), [project, selection]);

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      try {
        const starterProject = await loadStarterProject();

        if (cancelled) {
          return;
        }

        const nextSelection = firstProjectSelection(starterProject);
        const nextGraphFocus = createEntityGraphFocus(starterProject, nextSelection);
        setProject(starterProject);
        setSelection(nextSelection);
        setFlowNodes(projectNodes(starterProject, nextSelection, nextGraphFocus));
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
        setFlowNodes(projectNodes(blankProject, null, null));
        setStatus((error as Error).message);
      }
    }

    void loadProject();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setFlowNodes((currentNodes) => syncProjectNodes(currentNodes, project, selection, graphFocus));
  }, [graphFocus, project, selection]);

  const edges = useMemo<Edge[]>(
    () =>
      project.relationships.map((relationship) => {
        const resolvedRelationship = resolveRelationshipAt(project, relationship, selectedTimelineEventId);
        const linkType = findLinkType(project, resolvedRelationship.type);
        const active = isRelationshipActiveAt(project, relationship, selectedTimelineEventId);
        const selected = selection?.kind === "relationship" && selection.id === relationship.id;
        const connectedToFocus = graphFocus?.relationshipIds.has(relationship.id) ?? false;
        const fadedByFocus = Boolean(graphFocus && !connectedToFocus);
        const edgeOpacity = relationshipOpacity(active, fadedByFocus, connectedToFocus);
        const markerColor = fadedByFocus ? "#9aa8a4" : selected ? "#be123c" : linkType.color;

        return {
          id: relationship.id,
          source: relationship.sourceId,
          target: relationship.targetId,
          label: resolvedRelationship.label || linkType.label,
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
            strokeDasharray: active ? undefined : "7 7"
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
    [graphFocus, project, selectedTimelineEventId, selection]
  );

  const markProjectChanged = useCallback((nextProject: StoryProject) => {
    setProject(nextProject);
    setIsDirty(true);
    setStatus("Unsaved changes");
  }, []);

  const handleCreateEntity = useCallback(
    (type: ItemTypeId) => {
      const entity = createStoryEntity(type, project.itemTypes);

      if (entity.type === BUILT_IN_EVENT_TYPE_ID) {
        entity.timeline = { order: nextTimelineOrder(project), effects: [] };
      }

      const nextProject = addEntityToProject(project, entity, nextEntityPosition(project));
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

      const relationship = createStoryRelationship(project, connection.source, connection.target, defaultRelationshipType);
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
    [defaultRelationshipType, edges, markProjectChanged, project]
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
      setFlowNodes(projectNodes(nextProject, null, null));
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
      const nextGraphFocus = createEntityGraphFocus(loadedProject, nextSelection);
      setProject(loadedProject);
      setFolderHandle(handle);
      setSelection(nextSelection);
      setFlowNodes(projectNodes(loadedProject, nextSelection, nextGraphFocus));
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
      const nextGraphFocus = createEntityGraphFocus(loadedProject, nextSelection);
      setProject(loadedProject);
      setFolderHandle(null);
      setSelection(nextSelection);
      setFlowNodes(projectNodes(loadedProject, nextSelection, nextGraphFocus));
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
        </div>
      </header>

      <main className="workspace">
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
            onSelectEvent={(eventId) => {
              setSelectedTimelineEventId(eventId);
              if (eventId) {
                setSelection({ kind: "entity", id: eventId });
              }
            }}
          />
        </section>

        <DetailInspector
          project={project}
          selection={selection}
          onEntityChange={handleEntityChange}
          onRelationshipChange={handleRelationshipChange}
          onTimelineEffect={handleTimelineEffect}
          onDeleteEntity={handleDeleteEntity}
          onDeleteRelationship={handleDeleteRelationship}
        />
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

function createEntityGraphFocus(project: StoryProject, selection: Selection | null): EntityGraphFocus | null {
  if (selection?.kind !== "entity" || !project.entities[selection.id]) {
    return null;
  }

  const connectedEntityIds = new Set([selection.id]);
  const relationshipIds = new Set<string>();

  for (const relationship of project.relationships) {
    if (relationship.sourceId !== selection.id && relationship.targetId !== selection.id) {
      continue;
    }

    relationshipIds.add(relationship.id);
    connectedEntityIds.add(relationship.sourceId);
    connectedEntityIds.add(relationship.targetId);
  }

  return {
    connectedEntityIds,
    relationshipIds
  };
}

function projectNodes(
  project: StoryProject,
  selection: Selection | null,
  graphFocus: EntityGraphFocus | null
): Node<EntityNodeData, "storyEntity">[] {
  return Object.values(project.entities).map((entity) => ({
    id: entity.id,
    type: "storyEntity",
    position: project.layout[entity.id] ?? { x: 80, y: 80 },
    data: {
      entity,
      itemType: findItemType(project, entity.type),
      isSelected: selection?.kind === "entity" && selection.id === entity.id,
      isConnectedToFocus: graphFocus?.connectedEntityIds.has(entity.id) ?? false,
      isFaded: Boolean(graphFocus && !graphFocus.connectedEntityIds.has(entity.id))
    }
  }));
}

function syncProjectNodes(
  currentNodes: Node<EntityNodeData, "storyEntity">[],
  project: StoryProject,
  selection: Selection | null,
  graphFocus: EntityGraphFocus | null
): Node<EntityNodeData, "storyEntity">[] {
  const currentNodeById = new Map(currentNodes.map((node) => [node.id, node]));

  return Object.values(project.entities).map((entity) => {
    const currentNode = currentNodeById.get(entity.id);
    const savedPosition = project.layout[entity.id];
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
        isFaded: Boolean(graphFocus && !graphFocus.connectedEntityIds.has(entity.id))
      }
    };
  });
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
