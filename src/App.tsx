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
import { useCallback, useMemo, useRef, useState } from "react";
import { DetailInspector } from "./components/DetailInspector";
import { EntityNode, EntityNodeData } from "./components/EntityNode";
import { Sidebar } from "./components/Sidebar";
import {
  addEntityToProject,
  createBlankProject,
  createStarterProject,
  createStoryEntity,
  createStoryRelationship,
  deleteEntityFromProject,
  deleteRelationshipFromProject,
  nextEntityPosition,
  relationshipLabel,
  setProjectLayout,
  touchProject,
  updateEntityInProject,
  updateRelationshipInProject
} from "./data/story";
import {
  createProjectBundle,
  hasFolderProjectSupport,
  projectFromBundleFile,
  readProjectFromDirectory,
  writeProjectToDirectory
} from "./data/projectFiles";
import { EntityType, RelationshipType, Selection, StoryEntity, StoryProject, StoryRelationship } from "./types";

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

export function App() {
  return (
    <ReactFlowProvider>
      <StoryWorkspace />
    </ReactFlowProvider>
  );
}

function StoryWorkspace() {
  const initialProject = useMemo(() => createStarterProject(), []);
  const [project, setProject] = useState<StoryProject>(() => initialProject);
  const [selection, setSelection] = useState<Selection | null>(() => firstProjectSelection(initialProject));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Ready");
  const [isDirty, setIsDirty] = useState(false);
  const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [defaultRelationshipType, setDefaultRelationshipType] = useState<RelationshipType>("relates_to");
  const importInputRef = useRef<HTMLInputElement>(null);

  const nodes = useMemo<Node<EntityNodeData, "storyEntity">[]>(
    () =>
      Object.values(project.entities).map((entity) => ({
        id: entity.id,
        type: "storyEntity",
        position: project.layout[entity.id] ?? { x: 80, y: 80 },
        data: {
          entity,
          isSelected: selection?.kind === "entity" && selection.id === entity.id
        }
      })),
    [project.entities, project.layout, selection]
  );

  const edges = useMemo<Edge[]>(
    () =>
      project.relationships.map((relationship) => ({
        id: relationship.id,
        source: relationship.sourceId,
        target: relationship.targetId,
        label: relationship.label || relationshipLabel(relationship.type),
        type: "default",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18
        },
        style: {
          stroke: selection?.kind === "relationship" && selection.id === relationship.id ? "#be123c" : "#46605a",
          strokeWidth: selection?.kind === "relationship" && selection.id === relationship.id ? 3 : 2
        },
        labelStyle: {
          fill: "#17201f",
          fontWeight: 700,
          fontSize: 12
        },
        labelBgStyle: {
          fill: "#ffffff",
          fillOpacity: 0.9
        }
      })),
    [project.relationships, selection]
  );

  const markProjectChanged = useCallback((nextProject: StoryProject) => {
    setProject(nextProject);
    setIsDirty(true);
    setStatus("Unsaved changes");
  }, []);

  const handleCreateEntity = useCallback(
    (type: EntityType) => {
      const entity = createStoryEntity(type);
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

      const relationship = createStoryRelationship(connection.source, connection.target, defaultRelationshipType);
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
      setSelection(null);
    },
    [markProjectChanged, project]
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

  const handleNewProject = useCallback(() => {
    const nextProject = createBlankProject();
    setProject(nextProject);
    setSelection(null);
    setFolderHandle(null);
    setIsDirty(true);
    setStatus("New project");
  }, []);

  const handleSaveFolder = useCallback(async () => {
    try {
      const handle =
        folderHandle ??
        (await window.showDirectoryPicker?.({
          id: "storyteller-project",
          mode: "readwrite"
        }));

      if (!handle) {
        setStatus("Folder save is unavailable in this browser");
        return;
      }

      await writeProjectToDirectory(project, handle);
      setFolderHandle(handle);
      setIsDirty(false);
      setStatus("Saved to folder");
    } catch (error) {
      setStatus((error as Error).message);
    }
  }, [folderHandle, project]);

  const handleOpenFolder = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker?.({
        id: "storyteller-project",
        mode: "readwrite"
      });

      if (!handle) {
        setStatus("Folder open is unavailable in this browser");
        return;
      }

      const loadedProject = await readProjectFromDirectory(handle);
      setProject(loadedProject);
      setFolderHandle(handle);
      setSelection(firstProjectSelection(loadedProject));
      setIsDirty(false);
      setStatus("Opened folder project");
    } catch (error) {
      setStatus((error as Error).message);
    }
  }, []);

  const handleExportBundle = useCallback(() => {
    const url = URL.createObjectURL(createProjectBundle(project));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.title.trim() || "storyteller"}.storyteller.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Exported bundle");
  }, [project]);

  const handleImportBundle = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportFileSelected = useCallback(async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const loadedProject = await projectFromBundleFile(file);
      setProject(loadedProject);
      setFolderHandle(null);
      setSelection(firstProjectSelection(loadedProject));
      setIsDirty(false);
      setStatus("Imported project bundle");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }, []);

  return (
    <div className="app-shell">
      <input
        ref={importInputRef}
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
        <button type="button" onClick={handleNewProject}>
          New Project
        </button>
      </header>

      <main className="workspace">
        <Sidebar
          project={project}
          search={search}
          status={status}
          isDirty={isDirty}
          folderProjectSupported={hasFolderProjectSupport()}
          defaultRelationshipType={defaultRelationshipType}
          onCreateEntity={handleCreateEntity}
          onOpenFolder={handleOpenFolder}
          onSaveFolder={handleSaveFolder}
          onExportBundle={handleExportBundle}
          onImportBundle={handleImportBundle}
          onSelectEntity={(id) => setSelection({ kind: "entity", id })}
          onSearchChange={setSearch}
          onProjectTitleChange={handleProjectTitleChange}
          onDefaultRelationshipTypeChange={setDefaultRelationshipType}
        />

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

        <DetailInspector
          project={project}
          selection={selection}
          onEntityChange={handleEntityChange}
          onRelationshipChange={handleRelationshipChange}
          onDeleteEntity={handleDeleteEntity}
          onDeleteRelationship={handleDeleteRelationship}
        />
      </main>
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
