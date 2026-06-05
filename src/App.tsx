import {
  addEdge,
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
  Selection,
  StoryEntity,
  StoryProject,
  StoryRelationship,
  TimelineEffectDraft
} from "./types";

type PositionNodeChange = NodeChange & {
  id: string;
  position: {
    x: number;
    y: number;
  };
};

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
  const [project, setProject] = useState<StoryProject>(() => initialProject);
  const [selection, setSelection] = useState<Selection | null>(() => firstProjectSelection(initialProject));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Ready");
  const [isDirty, setIsDirty] = useState(false);
  const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [defaultRelationshipType, setDefaultRelationshipType] = useState<LinkTypeId>("relates_to");
  const [typeManagerOpen, setTypeManagerOpen] = useState(false);
  const [selectedTimelineEventId, setSelectedTimelineEventId] = useState<string | null>(null);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      try {
        const starterProject = await loadStarterProject();

        if (cancelled) {
          return;
        }

        setProject(starterProject);
        setSelection(firstProjectSelection(starterProject));
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
        setStatus((error as Error).message);
      }
    }

    void loadProject();

    return () => {
      cancelled = true;
    };
  }, []);

  const nodes = useMemo<Node<EntityNodeData, "storyEntity">[]>(
    () =>
      Object.values(project.entities).map((entity) => ({
        id: entity.id,
        type: "storyEntity",
        position: project.layout[entity.id] ?? { x: 80, y: 80 },
        data: {
          entity,
          itemType: findItemType(project, entity.type),
          isSelected: selection?.kind === "entity" && selection.id === entity.id
        }
      })),
    [project, selection]
  );

  const edges = useMemo<Edge[]>(
    () =>
      project.relationships.map((relationship) => {
        const resolvedRelationship = resolveRelationshipAt(project, relationship, selectedTimelineEventId);
        const linkType = findLinkType(project, resolvedRelationship.type);
        const active = isRelationshipActiveAt(project, relationship, selectedTimelineEventId);
        const selected = selection?.kind === "relationship" && selection.id === relationship.id;

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
                  color: selected ? "#be123c" : linkType.color
                }
              : undefined,
          style: {
            stroke: selected ? "#be123c" : linkType.color,
            strokeWidth: selected ? 3 : 2,
            opacity: active ? 1 : 0.28,
            strokeDasharray: active ? undefined : "7 7"
          },
          labelStyle: {
            fill: "#17201f",
            fontWeight: 700,
            fontSize: 12,
            opacity: active ? 1 : 0.42
          },
          labelBgStyle: {
            fill: "#ffffff",
            fillOpacity: active ? 0.9 : 0.55
          }
        };
      }),
    [project, selectedTimelineEventId, selection]
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
      const positionChanges = changes.filter(isPositionNodeChange);

      if (!positionChanges.length) {
        return;
      }

      const nextLayout = { ...project.layout };

      for (const change of positionChanges) {
        nextLayout[change.id] = change.position;
      }

      markProjectChanged(setProjectLayout(project, nextLayout));
    },
    [markProjectChanged, project]
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
      setProject(loadedProject);
      setFolderHandle(handle);
      setSelection(firstProjectSelection(loadedProject));
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
      setProject(loadedProject);
      setFolderHandle(null);
      setSelection(firstProjectSelection(loadedProject));
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
              nodes={nodes}
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

function isPositionNodeChange(change: NodeChange): change is PositionNodeChange {
  return change.type === "position" && "position" in change && Boolean(change.position);
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
