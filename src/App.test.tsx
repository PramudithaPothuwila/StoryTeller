import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import {
  createProjectBundle,
  hasFolderProjectSupport,
  projectFromBundleFile,
  readProjectFromDirectory,
  writeProjectToDirectory
} from "./data/projectFiles";
import { loadStarterProject } from "./data/starterProject";
import {
  addGameStateVariableToProject,
  createBlankProject,
  createStoryEntity,
  createStoryRelationship,
  setProjectModeInProject,
  updateGameStateVariableInProject,
  updateGameStoryProjectMetadata
} from "./data/story";

vi.mock("@xyflow/react", () => ({
  addEdge: (edge: unknown, edges: unknown[]) => [...edges, edge],
  applyNodeChanges: (
    changes: Array<{
      dimensions?: { height: number; width: number };
      id: string;
      position?: { x: number; y: number };
      type: string;
    }>,
    nodes: any[]
  ) =>
    nodes.map((node) => {
      const change = changes.find((item) => item.id === node.id);

      if (change?.type === "dimensions" && change.dimensions) {
        return { ...node, measured: change.dimensions };
      }

      return change?.type === "position" && change.position ? { ...node, position: change.position } : node;
    }),
  Background: () => null,
  BackgroundVariant: {
    Dots: "dots"
  },
  Controls: () => null,
  MarkerType: {
    ArrowClosed: "arrowclosed"
  },
  MiniMap: () => null,
  ReactFlow: ({
    children,
    edges = [],
    onConnect,
    onEdgeClick,
    onNodeClick,
    onPaneClick,
    nodes = [],
    onNodesChange
  }: {
    children: ReactNode;
    edges?: Array<{
      data?: { labelOffset?: number };
      id: string;
      label?: ReactNode;
      labelStyle?: { opacity?: number };
      markerEnd?: { color?: string };
      source: string;
      style?: { opacity?: number; stroke?: string; strokeWidth?: number };
      target: string;
      type?: string;
    }>;
    onConnect?: (connection: { source: string; target: string }) => void;
    onEdgeClick?: (event: unknown, edge: unknown) => void;
    onNodeClick?: (event: unknown, node: unknown) => void;
    onPaneClick?: () => void;
      nodes?: Array<{
        data: {
          entity: { title: string };
          isConnectedToFocus?: boolean;
          isFaded?: boolean;
          isGameDeadEnd?: boolean;
          isGameEnding?: boolean;
          isGameStart?: boolean;
          isSelected?: boolean;
        };
      id: string;
      measured?: { height: number; width: number };
      position: { x: number; y: number };
    }>;
    onNodesChange?: (
      changes: Array<{
        dimensions?: { height: number; width: number };
        id: string;
        position?: { x: number; y: number };
        type: string;
      }>
    ) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onPaneClick?.()}>
        Click graph pane
      </button>
      {nodes.length ? (
        <>
          <button
            type="button"
            onClick={() => onNodesChange?.([{ id: nodes[0].id, type: "dimensions", dimensions: { width: 230, height: 128 } }])}
          >
            Initialize first graph node
          </button>
          <button
            type="button"
            onClick={() => onNodesChange?.([{ id: nodes[0].id, type: "position", position: { x: 321, y: 654 } }])}
          >
            Move first graph node
          </button>
          <button
            type="button"
            onClick={() => onNodesChange?.([{ id: nodes[0].id, type: "position", position: { x: 123, y: 456 } }])}
          >
            Move first graph node alternate
          </button>
          {nodes.length > 1 ? (
            <button type="button" onClick={() => onConnect?.({ source: nodes[0].id, target: nodes[1].id })}>
              Connect first graph nodes
            </button>
          ) : null}
        </>
      ) : null}
      {nodes.map((node) => (
        <button
          type="button"
          key={node.id}
          onClick={(event) => onNodeClick?.(event, node)}
          data-connected={`${node.data.isConnectedToFocus ?? false}`}
          data-faded={`${node.data.isFaded ?? false}`}
          data-game-dead-end={`${node.data.isGameDeadEnd ?? false}`}
          data-game-ending={`${node.data.isGameEnding ?? false}`}
          data-game-start={`${node.data.isGameStart ?? false}`}
          data-measured={`${node.measured?.width ?? ""},${node.measured?.height ?? ""}`}
          data-position={`${node.position.x},${node.position.y}`}
          data-selected={`${node.data.isSelected ?? false}`}
          data-testid={`flow-node-${node.id}`}
        >
          {node.data.entity.title}
        </button>
      ))}
      {edges.map((edge) => (
        <button
          type="button"
          key={edge.id}
          onClick={(event) => onEdgeClick?.(event, edge)}
          data-label-opacity={`${edge.labelStyle?.opacity ?? ""}`}
          data-label-offset={`${edge.data?.labelOffset ?? ""}`}
          data-label={`${edge.label ?? ""}`}
          data-marker-color={edge.markerEnd?.color ?? ""}
          data-opacity={`${edge.style?.opacity ?? ""}`}
          data-source={edge.source}
          data-stroke={edge.style?.stroke ?? ""}
          data-stroke-width={`${edge.style?.strokeWidth ?? ""}`}
          data-target={edge.target}
          data-testid={`flow-edge-${edge.id}`}
          data-type={edge.type ?? ""}
        >
          {edge.id}
        </button>
      ))}
      {children}
    </div>
  ),
  ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock("./data/starterProject", async () => {
  const story = await vi.importActual<typeof import("./data/story")>("./data/story");

  return {
    createLoadingProject: () => story.createBlankProject("Loading Story..."),
    loadStarterProject: vi.fn(async () => story.createBlankProject("Loaded Project"))
  };
});

vi.mock("./data/projectFiles", async () => {
  const actual = await vi.importActual<typeof import("./data/projectFiles")>("./data/projectFiles");
  const story = await vi.importActual<typeof import("./data/story")>("./data/story");

  return {
    ...actual,
    createProjectBundle: vi.fn(() => new Blob(["{}"], { type: "application/json" })),
    hasFolderProjectSupport: vi.fn(() => true),
    projectFromBundleFile: vi.fn(async () => story.createBlankProject("Backup Project")),
    readProjectFromDirectory: vi.fn(async () => story.createBlankProject("Opened Project")),
    writeProjectToDirectory: vi.fn(async () => undefined)
  };
});

describe("App project commands", () => {
  const folderHandle = {
    kind: "directory",
    name: "Story Folder"
  } as FileSystemDirectoryHandle;
  let anchorClickSpy: ReturnType<typeof vi.spyOn>;
  let fileClickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(loadStarterProject).mockResolvedValue(createBlankProject("Loaded Project"));
    vi.mocked(hasFolderProjectSupport).mockReturnValue(true);
    vi.mocked(readProjectFromDirectory).mockResolvedValue(createBlankProject("Opened Project"));
    vi.mocked(projectFromBundleFile).mockResolvedValue(createBlankProject("Backup Project"));
    vi.mocked(createProjectBundle).mockReturnValue(new Blob(["{}"], { type: "application/json" }));
    window.showDirectoryPicker = vi.fn(async () => folderHandle);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:storyteller")
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn()
    });
    window.localStorage.clear();
    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    fileClickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.unstubAllGlobals();
    anchorClickSpy.mockRestore();
    fileClickSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("renders icon project commands with tooltips and removes storage-demo labels", async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText("Loaded Project")).toBeInTheDocument());

    expect(document.querySelector(".workspace")).not.toHaveClass("has-inspector");
    expect(document.querySelector(".inspector")).toBeNull();
    expect(screen.queryByText("Select an item")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rulebook" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Backup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guide" })).toHaveAttribute("title", "Guide");
    expect(screen.getByRole("button", { name: "Open Settings" })).toHaveAttribute("title", "Open Settings");
    expect(screen.getByRole("button", { name: "Save Project" })).toHaveAttribute("title", "Save Project");
    expect(screen.getByText("Not selected")).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Graph tools" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Character" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Graph focus depth" })).toBeInTheDocument();
    expect(document.querySelector(".graph-depth-select__single-value")).toHaveTextContent("1");
    expect(screen.queryByRole("button", { name: "Switch to Story Flow" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Add Item" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save folder" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open folder" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
  });

  it("opens and closes the in-app guide from the topbar", async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Guide" }));

    const guide = screen.getByRole("dialog", { name: "Guide" });
    expect(within(guide).getByText("Create and Find Story Items")).toBeInTheDocument();
    expect(within(guide).getByText("Use the Graph")).toBeInTheDocument();
    expect(within(guide).getByText(/graph depth dropdown/)).toBeInTheDocument();
    expect(within(guide).getByText("Save and Configure")).toBeInTheDocument();

    fireEvent.click(within(guide).getByRole("button", { name: "Close guide" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Guide" })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Guide" }));
    expect(screen.getByRole("dialog", { name: "Guide" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Guide" })).not.toBeInTheDocument());
  });

  it("opens and closes the AI agent panel from the topbar", async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "AI Agent" }));

    expect(screen.getByRole("complementary", { name: "AI Agent" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Story Agent" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close AI Agent" }));

    await waitFor(() => expect(screen.queryByRole("complementary", { name: "AI Agent" })).not.toBeInTheDocument());
  });

  it("blocks AI agent requests until an API key is provided", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await waitFor(() => expect(screen.getByText("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "AI Agent" }));
    fireEvent.change(screen.getByPlaceholderText(/Ask for focused story structure changes/), {
      target: { value: "Add a rival." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask Agent" }));

    expect(await screen.findByText("Add an API key in Settings before asking the agent.")).toBeInTheDocument();
    expect(screen.getByText("Agent needs an API key")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("previews and applies a mocked AI agent change plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            summary: "Add a rival character.",
            assumptions: ["The rival should remain tentative."],
            followUpQuestions: [],
            changes: [
              {
                operation: "create_entity",
                summary: "Create rival",
                entity: {
                  id: "character-rival",
                  type: "character",
                  title: "Rival",
                  summary: "A pressure point for the protagonist."
                }
              }
            ]
          })
        })
      }))
    );
    render(<App />);

    await waitFor(() => expect(screen.getByText("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
    fireEvent.change(screen.getByLabelText("Agent API key"), { target: { value: "sk-test" } });
    expect(screen.getByText(/The Agent API must support OpenAPI-compatible Responses API behavior/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));

    await waitFor(() => expect(document.querySelector(".workspace")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "AI Agent" }));
    fireEvent.change(screen.getByPlaceholderText(/Ask for focused story structure changes/), {
      target: { value: "Add a rival." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask Agent" }));

    expect(await screen.findByText("Create rival")).toBeInTheDocument();
    expect(screen.getByText("The rival should remain tentative.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Apply 1 Change" }));

    expect(await screen.findByTestId("flow-node-character-rival")).toHaveTextContent("Rival");
    expect(screen.getByText("Agent changes applied")).toBeInTheDocument();
  });

  it("disables applying invalid AI agent plans", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            summary: "Connect missing people.",
            assumptions: [],
            followUpQuestions: [],
            changes: [
              {
                operation: "create_relationship",
                summary: "Create impossible link",
                relationship: {
                  id: "link-missing",
                  sourceId: "character-a",
                  targetId: "character-b",
                  type: "knows"
                }
              }
            ]
          })
        })
      }))
    );
    render(<App />);

    await waitFor(() => expect(screen.getByText("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
    fireEvent.change(screen.getByLabelText("Agent API key"), { target: { value: "sk-test" } });
    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));

    await waitFor(() => expect(document.querySelector(".workspace")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "AI Agent" }));
    fireEvent.change(screen.getByPlaceholderText(/Ask for focused story structure changes/), {
      target: { value: "Connect two missing characters." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask Agent" }));

    expect(await screen.findByText("Relationship source does not exist: character-a")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply 1 Change" })).toBeDisabled();
  });

  it("opens settings to edit project configuration and workspace defaults", async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument());
    expect(document.querySelector(".workspace")).toBeNull();
    expect(screen.getByLabelText("Project title")).toHaveValue("Loaded Project");
    expect(screen.queryByRole("button", { name: "Graph focus depth 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add item type" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI Agent" })).toBeInTheDocument();
    expect(screen.getByLabelText("Agent model")).toHaveValue("gpt-5.5");
    expect(screen.getByLabelText("Agent base URL")).toHaveValue("https://api.openai.com/v1");
    expect(screen.getByText(/The Agent API must support OpenAPI-compatible Responses API behavior/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Project title"), { target: { value: "Settings Project" } });
    expect(screen.getByText("Settings Project")).toBeInTheDocument();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Game Story" }));
    expect(screen.getByLabelText("Default Link")).toHaveValue("branches_to");

    fireEvent.change(screen.getByLabelText("Default Link"), { target: { value: "knows" } });
    expect(screen.getByLabelText("Default Link")).toHaveValue("knows");

    fireEvent.click(screen.getByRole("button", { name: "Back to Workspace" }));

    await waitFor(() => expect(document.querySelector(".workspace")).not.toBeNull());
    expect(screen.queryByLabelText("Project title")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to Story Flow" })).toHaveClass("is-active");
  });

  it("hides the detail inspector when the graph pane clears an entity selection", async () => {
    const project = createBlankProject("Selection Project");
    const hero = createStoryEntity("character", project.itemTypes, "Pane Click Hero");

    vi.mocked(loadStarterProject).mockResolvedValue({
      ...project,
      entities: {
        [hero.id]: hero
      }
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText("Selection Project")).toBeInTheDocument());
    expect(document.querySelector(".workspace")).toHaveClass("has-inspector");
    expect(screen.getByRole("button", { name: "Delete selected item" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Click graph pane" }));

    await waitFor(() => expect(document.querySelector(".workspace")).not.toHaveClass("has-inspector"));
    expect(document.querySelector(".inspector")).toBeNull();
    expect(screen.queryByText("Select an item")).not.toBeInTheDocument();
    expect(screen.getByTestId(`flow-node-${hero.id}`)).toHaveAttribute("data-selected", "false");

    fireEvent.click(screen.getByTestId(`flow-node-${hero.id}`));

    await waitFor(() => expect(document.querySelector(".workspace")).toHaveClass("has-inspector"));
    expect(screen.getByRole("button", { name: "Delete selected item" })).toBeInTheDocument();
  });

  it("hides the detail inspector after deleting the selected entity", async () => {
    const project = createBlankProject("Delete Entity Project");
    const hero = createStoryEntity("character", project.itemTypes, "Short-Lived Hero");

    vi.mocked(loadStarterProject).mockResolvedValue({
      ...project,
      entities: {
        [hero.id]: hero
      }
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText("Delete Entity Project")).toBeInTheDocument());
    expect(document.querySelector(".workspace")).toHaveClass("has-inspector");

    fireEvent.click(screen.getByRole("button", { name: "Delete selected item" }));

    await waitFor(() => expect(document.querySelector(".workspace")).not.toHaveClass("has-inspector"));
    expect(document.querySelector(".inspector")).toBeNull();
    expect(screen.queryByTestId(`flow-node-${hero.id}`)).not.toBeInTheDocument();
  });

  it("keeps relationship inspection visible and hides it after deleting the relationship", async () => {
    const project = createBlankProject("Relationship Inspector Project");
    const source = createStoryEntity("character", project.itemTypes, "Source Character");
    const target = createStoryEntity("location", project.itemTypes, "Target Harbor");
    const relationship = createStoryRelationship(project, source.id, target.id, "relates_to");

    vi.mocked(loadStarterProject).mockResolvedValue({
      ...project,
      entities: {
        [source.id]: source,
        [target.id]: target
      },
      relationships: [relationship]
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText("Relationship Inspector Project")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId(`flow-edge-${relationship.id}`));

    await waitFor(() => expect(screen.getByRole("button", { name: "Delete selected relationship" })).toBeInTheDocument());
    expect(document.querySelector(".workspace")).toHaveClass("has-inspector");
    expect(screen.getByText("Relationship")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete selected relationship" }));

    await waitFor(() => expect(document.querySelector(".workspace")).not.toHaveClass("has-inspector"));
    expect(document.querySelector(".inspector")).toBeNull();
    expect(screen.queryByTestId(`flow-edge-${relationship.id}`)).not.toBeInTheDocument();
  });

  it("opens the rulebook sidebar to create, filter, focus, and delete world rules", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Rulebook" }));

    const rulebook = screen.getByRole("complementary", { name: "Rulebook" });
    expect(within(rulebook).getByText("Rulebook")).toBeInTheDocument();

    fireEvent.click(within(rulebook).getByRole("button", { name: "New Rule" }));

    await waitFor(() => expect(within(rulebook).getByLabelText("Rule title")).toHaveValue("New World Rule"));

    fireEvent.change(within(rulebook).getByLabelText("Rule title"), { target: { value: "Blue Fire Rule" } });
    fireEvent.change(within(rulebook).getByLabelText("Rule domain"), { target: { value: "Magic" } });
    fireEvent.change(within(rulebook).getByLabelText("Rule status"), { target: { value: "Canon" } });
    fireEvent.change(within(rulebook).getByLabelText("Rule statement"), {
      target: { value: "Blue fire only burns reflected lies." }
    });

    await waitFor(() => expect(within(rulebook).getAllByText("Blue Fire Rule").length).toBeGreaterThan(0));
    expect(within(rulebook).getByText("Magic / Canon")).toBeInTheDocument();

    fireEvent.change(within(rulebook).getByLabelText("Rulebook search"), { target: { value: "reflected lies" } });
    fireEvent.change(within(rulebook).getByLabelText("Filter rules by domain"), { target: { value: "Magic" } });
    fireEvent.change(within(rulebook).getByLabelText("Filter rules by status"), { target: { value: "Canon" } });

    expect(within(rulebook).getAllByText("Blue Fire Rule").length).toBeGreaterThan(0);

    fireEvent.click(within(rulebook).getByRole("button", { name: "Focus In Graph" }));

    const ruleNode = await waitFor(() => {
      const node = document.querySelector('[data-testid^="flow-node-world-rule-"]');
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });

    expect(ruleNode).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("complementary", { name: "Rulebook" })).toBeInTheDocument();

    fireEvent.click(within(rulebook).getByRole("button", { name: "Delete Rule" }));

    await waitFor(() => expect(document.querySelector('[data-testid^="flow-node-world-rule-"]')).toBeNull());
    expect(within(rulebook).getAllByText("No rules").length).toBeGreaterThan(0);
  });

  it("asks for a project folder and saves immediately when creating a new project", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "New Project" }));

    await waitFor(() => expect(writeProjectToDirectory).toHaveBeenCalledTimes(1));
    expect(window.showDirectoryPicker).toHaveBeenCalledTimes(1);
    expect(writeProjectToDirectory).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Untitled Story" }),
      folderHandle
    );
    expect(screen.getByText("Untitled Story")).toBeInTheDocument();
    expect(screen.getByText("Project saved")).toBeInTheDocument();
    expect(screen.getByText("Story Folder")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Project" }));

    await waitFor(() => expect(writeProjectToDirectory).toHaveBeenCalledTimes(2));
    expect(window.showDirectoryPicker).toHaveBeenCalledTimes(1);
  });

  it("does not create a new project when folder access is unavailable", async () => {
    vi.mocked(hasFolderProjectSupport).mockReturnValue(false);
    render(<App />);
    await waitFor(() => expect(screen.getByText("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "New Project" }));

    expect(writeProjectToDirectory).not.toHaveBeenCalled();
    expect(createProjectBundle).not.toHaveBeenCalled();
    expect(anchorClickSpy).not.toHaveBeenCalled();
    expect(screen.getByText("Loaded Project")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Folder selection is unavailable in this browser. Use a browser with folder access to save folder projects."
      )
    ).toBeInTheDocument();
  });

  it("keeps the current project if new project folder selection is cancelled", async () => {
    window.showDirectoryPicker = vi.fn(async () => undefined as unknown as FileSystemDirectoryHandle);
    render(<App />);
    await waitFor(() => expect(screen.getByText("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "New Project" }));

    await waitFor(() => expect(screen.getByText("Choose a project folder to create a new project")).toBeInTheDocument());
    expect(writeProjectToDirectory).not.toHaveBeenCalled();
    expect(screen.getByText("Loaded Project")).toBeInTheDocument();
  });

  it("selects a project folder and saves the current project into it", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Select Folder" }));

    await waitFor(() => expect(writeProjectToDirectory).toHaveBeenCalledTimes(1));
    expect(window.showDirectoryPicker).toHaveBeenCalledTimes(1);
    expect(writeProjectToDirectory).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Loaded Project" }), folderHandle);
    expect(screen.getByText("Project folder selected and saved")).toBeInTheDocument();
    expect(screen.getByText("Story Folder")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Project" }));

    await waitFor(() => expect(writeProjectToDirectory).toHaveBeenCalledTimes(2));
    expect(window.showDirectoryPicker).toHaveBeenCalledTimes(1);
  });

  it("shows a friendly status when the browser blocks folder selection", async () => {
    window.showDirectoryPicker = vi.fn(async () => {
      throw new Error("Failed to execute 'showDirectoryPicker' on 'Window': Must be handling a user gesture.");
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Select Folder" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Folder selection is unavailable in this browser. Use a browser with folder access to save folder projects."
        )
      ).toBeInTheDocument()
    );
    expect(writeProjectToDirectory).not.toHaveBeenCalled();
  });

  it("saves to the chosen project folder and reuses that folder on later saves", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Save Project" }));

    await waitFor(() => expect(writeProjectToDirectory).toHaveBeenCalledTimes(1));
    expect(window.showDirectoryPicker).toHaveBeenCalledTimes(1);
    expect(writeProjectToDirectory).toHaveBeenLastCalledWith(expect.any(Object), folderHandle);
    expect(screen.getByText("Project saved")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Project" }));

    await waitFor(() => expect(writeProjectToDirectory).toHaveBeenCalledTimes(2));
    expect(window.showDirectoryPicker).toHaveBeenCalledTimes(1);
  });

  it("does not auto-export a backup when saving without folder support", async () => {
    vi.mocked(hasFolderProjectSupport).mockReturnValue(false);
    render(<App />);
    await waitFor(() => expect(screen.getByText("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Save Project" }));

    expect(createProjectBundle).not.toHaveBeenCalled();
    expect(anchorClickSpy).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Folder selection is unavailable in this browser. Use a browser with folder access to save folder projects."
      )
    ).toBeInTheDocument();
  });

  it("opens a folder project when folder access is supported", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Open Project" }));

    await waitFor(() => expect(readProjectFromDirectory).toHaveBeenCalledWith(folderHandle));
    expect(screen.getByText("Opened Project")).toBeInTheDocument();
    expect(screen.getByText("Project opened")).toBeInTheDocument();
  });

  it("keeps graph nodes rendered after node position changes", async () => {
    const project = createBlankProject("Graph Project");
    const hero = createStoryEntity("character", project.itemTypes, "Draggable Hero");
    vi.mocked(loadStarterProject).mockResolvedValue({
      ...project,
      entities: {
        [hero.id]: hero
      },
      layout: {
        [hero.id]: { x: 10, y: 20 }
      }
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText("Graph Project")).toBeInTheDocument());
    expect(screen.getByTestId(`flow-node-${hero.id}`)).toHaveAttribute("data-position", "10,20");

    fireEvent.click(screen.getByRole("button", { name: "Initialize first graph node" }));

    await waitFor(() =>
      expect(screen.getByTestId(`flow-node-${hero.id}`)).toHaveAttribute("data-measured", "230,128")
    );
    expect(screen.getByText("Starter project loaded")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Move first graph node" }));

    await waitFor(() =>
      expect(screen.getByTestId(`flow-node-${hero.id}`)).toHaveAttribute("data-position", "321,654")
    );
    expect(screen.getByTestId(`flow-node-${hero.id}`)).toHaveTextContent("Draggable Hero");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("offsets relationship labels for multiple outgoing links from the same entity", async () => {
    const project = createBlankProject("Relationship Labels Project");
    const hero = createStoryEntity("character", project.itemTypes, "Label Source");
    const ally = createStoryEntity("character", project.itemTypes, "First Target");
    const clue = createStoryEntity("note", project.itemTypes, "Second Target");
    const faction = createStoryEntity("faction", project.itemTypes, "Third Target");
    const firstLink = createStoryRelationship(project, hero.id, ally.id, "relates_to");
    const secondLink = createStoryRelationship(project, hero.id, clue.id, "knows");
    const thirdLink = createStoryRelationship(project, hero.id, faction.id, "opposes");

    vi.mocked(loadStarterProject).mockResolvedValue({
      ...project,
      entities: {
        [hero.id]: hero,
        [ally.id]: ally,
        [clue.id]: clue,
        [faction.id]: faction
      },
      relationships: [firstLink, secondLink, thirdLink],
      layout: {
        [hero.id]: { x: 10, y: 20 },
        [ally.id]: { x: 310, y: 20 },
        [clue.id]: { x: 310, y: 220 },
        [faction.id]: { x: 310, y: 420 }
      }
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText("Relationship Labels Project")).toBeInTheDocument());
    expect(screen.getByTestId(`flow-edge-${firstLink.id}`)).toHaveAttribute("data-type", "relationship");
    expect(screen.getByTestId(`flow-edge-${firstLink.id}`)).toHaveAttribute("data-label", "Relates to");
    expect(screen.getByTestId(`flow-edge-${firstLink.id}`)).toHaveAttribute("data-label-offset", "-18");
    expect(screen.getByTestId(`flow-edge-${secondLink.id}`)).toHaveAttribute("data-label-offset", "18");
    expect(screen.getByTestId(`flow-edge-${thirdLink.id}`)).toHaveAttribute("data-label-offset", "-36");
  });

  it("highlights the selected graph item and fades unrelated neighborhoods", async () => {
    const project = createBlankProject("Focus Project");
    const hero = createStoryEntity("character", project.itemTypes, "Focused Hero");
    const ally = createStoryEntity("character", project.itemTypes, "Connected Ally");
    const outsider = createStoryEntity("character", project.itemTypes, "Outside Lead");
    const clue = createStoryEntity("note", project.itemTypes, "Outside Clue");
    const heroLink = createStoryRelationship(project, hero.id, ally.id, "relates_to");
    const outsideLink = createStoryRelationship(project, outsider.id, clue.id, "relates_to");

    vi.mocked(loadStarterProject).mockResolvedValue({
      ...project,
      entities: {
        [hero.id]: hero,
        [ally.id]: ally,
        [outsider.id]: outsider,
        [clue.id]: clue
      },
      relationships: [heroLink, outsideLink],
      layout: {
        [hero.id]: { x: 10, y: 20 },
        [ally.id]: { x: 310, y: 20 },
        [outsider.id]: { x: 10, y: 240 },
        [clue.id]: { x: 310, y: 240 }
      }
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText("Focus Project")).toBeInTheDocument());

    expect(screen.getByTestId(`flow-node-${hero.id}`)).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId(`flow-node-${hero.id}`)).toHaveAttribute("data-connected", "true");
    expect(screen.getByTestId(`flow-node-${ally.id}`)).toHaveAttribute("data-connected", "true");
    expect(screen.getByTestId(`flow-node-${outsider.id}`)).toHaveAttribute("data-faded", "true");
    expect(screen.getByTestId(`flow-edge-${heroLink.id}`)).toHaveAttribute("data-opacity", "1");
    expect(screen.getByTestId(`flow-edge-${heroLink.id}`)).toHaveAttribute("data-stroke-width", "3");
    expect(screen.getByTestId(`flow-edge-${outsideLink.id}`)).toHaveAttribute("data-opacity", "0.12");

    fireEvent.click(screen.getByTestId(`flow-node-${outsider.id}`));

    await waitFor(() => expect(screen.getByTestId(`flow-node-${outsider.id}`)).toHaveAttribute("data-selected", "true"));
    expect(screen.getByTestId(`flow-node-${clue.id}`)).toHaveAttribute("data-connected", "true");
    expect(screen.getByTestId(`flow-node-${hero.id}`)).toHaveAttribute("data-faded", "true");
    expect(screen.getByTestId(`flow-edge-${heroLink.id}`)).toHaveAttribute("data-opacity", "0.12");
    expect(screen.getByTestId(`flow-edge-${outsideLink.id}`)).toHaveAttribute("data-opacity", "1");
    expect(screen.getByTestId(`flow-edge-${outsideLink.id}`)).toHaveAttribute("data-stroke-width", "3");
  });

  it("changes graph focus depth and persists the browser preference", async () => {
    const fixture = createFocusDepthProject();
    vi.mocked(loadStarterProject).mockResolvedValue(fixture.project);

    render(<App />);

    await waitFor(() => expect(screen.getByText("Focus Depth Project")).toBeInTheDocument());
    expect(screen.getByTestId(`flow-node-${fixture.ally.id}`)).toHaveAttribute("data-connected", "true");
    expect(screen.getByTestId(`flow-node-${fixture.clue.id}`)).toHaveAttribute("data-faded", "true");
    expect(screen.getByTestId(`flow-edge-${fixture.allyLink.id}`)).toHaveAttribute("data-opacity", "0.12");

    expect(screen.queryByRole("button", { name: "Graph focus depth 0" })).not.toBeInTheDocument();
    const depthSelect = screen.getByRole("combobox", { name: "Graph focus depth" });
    fireEvent.keyDown(depthSelect, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "2" }));
    expect(window.localStorage.getItem("storyteller.graphFocusDepth")).toBe("2");

    await waitFor(() => expect(screen.getByTestId(`flow-node-${fixture.clue.id}`)).toHaveAttribute("data-connected", "true"));
    expect(screen.getByTestId(`flow-node-${fixture.faction.id}`)).toHaveAttribute("data-faded", "true");

    fireEvent.keyDown(depthSelect, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "3" }));

    await waitFor(() => expect(screen.getByTestId(`flow-node-${fixture.faction.id}`)).toHaveAttribute("data-connected", "true"));
    expect(screen.getByTestId(`flow-node-${fixture.relic.id}`)).toHaveAttribute("data-faded", "true");

    fireEvent.keyDown(depthSelect, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "4" }));
    expect(window.localStorage.getItem("storyteller.graphFocusDepth")).toBe("4");

    await waitFor(() => expect(screen.getByTestId(`flow-node-${fixture.relic.id}`)).toHaveAttribute("data-connected", "true"));

    fireEvent.keyDown(depthSelect, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "All" }));
    expect(window.localStorage.getItem("storyteller.graphFocusDepth")).toBe("all");

    await waitFor(() => expect(screen.getByTestId(`flow-node-${fixture.relic.id}`)).toHaveAttribute("data-faded", "false"));
    expect(screen.getByTestId(`flow-node-${fixture.hero.id}`)).toHaveAttribute("data-connected", "false");
  });

  it("restores graph focus depth from browser storage", async () => {
    const fixture = createFocusDepthProject();
    window.localStorage.setItem("storyteller.graphFocusDepth", "3");
    vi.mocked(loadStarterProject).mockResolvedValue(fixture.project);

    render(<App />);

    await waitFor(() => expect(screen.getByText("Focus Depth Project")).toBeInTheDocument());
    expect(screen.getByRole("combobox", { name: "Graph focus depth" })).toBeInTheDocument();
    expect(document.querySelector(".graph-depth-select__single-value")).toHaveTextContent("3");
    expect(screen.getByTestId(`flow-node-${fixture.faction.id}`)).toHaveAttribute("data-connected", "true");
    expect(screen.getByTestId(`flow-node-${fixture.relic.id}`)).toHaveAttribute("data-faded", "true");
  });

  it("switches to Game Story Mode and creates state-backed game nodes", async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Game Story" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to Workspace" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Switch to Story Flow" })).toHaveClass("is-active"));
    expect(screen.getByRole("button", { name: "Branching RPG" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Game Story Tools" })).not.toBeInTheDocument();
    expect(document.querySelector(".workspace")).not.toHaveClass("has-game-tools");
    expect(screen.getByRole("button", { name: "Switch to Story Flow" })).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: "Add Scene" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Character" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add Scene" }));

    const sceneNode = await waitFor(() => {
      const node = document.querySelector('[data-testid^="flow-node-scene-"]');
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });

    expect(sceneNode).toHaveAttribute("data-game-start", "true");
    expect(screen.getByLabelText("Game node role")).toHaveValue("scene");

    fireEvent.click(screen.getByRole("button", { name: "Branching RPG" }));

    await waitFor(() => expect(screen.getByRole("complementary", { name: "Game Story Tools" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Branching RPG" })).toHaveClass("is-active");
    expect(document.querySelector(".workspace")).toHaveClass("has-game-tools");

    fireEvent.click(screen.getByRole("button", { name: "Variable" }));

    await waitFor(() => expect(screen.getByText("State Variables")).toBeInTheDocument());
    expect(document.querySelector(".state-variable-card")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Branching RPG" }));

    await waitFor(() => expect(screen.queryByRole("complementary", { name: "Game Story Tools" })).not.toBeInTheDocument());
    expect(document.querySelector(".workspace")).not.toHaveClass("has-game-tools");
  });

  it("filters Story Flow to game nodes and opens the optional preview tools", async () => {
    const fixture = createGameStoryFixture();
    vi.mocked(loadStarterProject).mockResolvedValue(fixture.project);

    render(<App />);

    await waitFor(() => expect(screen.getByText("Game Flow Project")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Switch to Story Flow" })).toHaveClass("is-active");
    expect(screen.getByTestId(`flow-node-${fixture.start.id}`)).toHaveAttribute("data-game-start", "true");
    expect(screen.getByTestId(`flow-node-${fixture.ending.id}`)).toHaveAttribute("data-game-ending", "true");
    expect(screen.queryByTestId(`flow-node-${fixture.character.id}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`flow-edge-${fixture.branch.id}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Switch to World" }));

    await waitFor(() => expect(screen.getByTestId(`flow-node-${fixture.character.id}`)).toBeInTheDocument());
    expect(screen.getByTestId(`flow-node-${fixture.start.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`flow-edge-${fixture.branch.id}`)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Switch to Story Flow" }));
    await waitFor(() => expect(screen.getByTestId(`flow-edge-${fixture.branch.id}`)).toBeInTheDocument());
    expect(screen.queryByRole("complementary", { name: "Game Story Tools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Preview/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId(`flow-edge-${fixture.branch.id}`));

    await waitFor(() => expect(screen.getByText("Branch Fields")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Open the gate")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Branching RPG" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() => expect(screen.getByText("Open the gate")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Open the gate/ }));

    await waitFor(() => expect(document.querySelector(".play-current-node h3")).toHaveTextContent("Bright Ending"));
  });

  it("keeps World and Story Flow node positions independent", async () => {
    const fixture = createGameStoryFixture();
    vi.mocked(loadStarterProject).mockResolvedValue(fixture.project);

    render(<App />);

    await waitFor(() => expect(screen.getByText("Game Flow Project")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Switch to Story Flow" })).toHaveClass("is-active");
    expect(screen.getByTestId(`flow-node-${fixture.start.id}`)).toHaveAttribute("data-position", "50,60");

    fireEvent.click(screen.getByRole("button", { name: "Move first graph node" }));

    await waitFor(() =>
      expect(screen.getByTestId(`flow-node-${fixture.start.id}`)).toHaveAttribute("data-position", "321,654")
    );

    fireEvent.click(screen.getByRole("button", { name: "Switch to World" }));

    await waitFor(() =>
      expect(screen.getByTestId(`flow-node-${fixture.start.id}`)).toHaveAttribute("data-position", "0,20")
    );

    fireEvent.click(screen.getByRole("button", { name: "Move first graph node alternate" }));

    await waitFor(() =>
      expect(screen.getByTestId(`flow-node-${fixture.start.id}`)).toHaveAttribute("data-position", "123,456")
    );

    fireEvent.click(screen.getByRole("button", { name: "Switch to Story Flow" }));

    await waitFor(() =>
      expect(screen.getByTestId(`flow-node-${fixture.start.id}`)).toHaveAttribute("data-position", "321,654")
    );
  });

  it("creates branch relationships when connecting nodes in Story Flow", async () => {
    let project = setProjectModeInProject(createBlankProject("Branch Connect Project"), "game_story");
    const start = createStoryEntity("scene", project.itemTypes, "Start", "story_flow");
    const ending = createStoryEntity("ending", project.itemTypes, "Ending", "story_flow");
    project = updateGameStoryProjectMetadata(
      {
        ...project,
        entities: {
          [start.id]: start,
          [ending.id]: ending
        },
        layout: {
          [start.id]: { x: 0, y: 20 },
          [ending.id]: { x: 260, y: 240 }
        },
        storyFlowLayout: {
          [start.id]: { x: 50, y: 60 },
          [ending.id]: { x: 310, y: 60 }
        }
      },
      { startNodeId: start.id }
    );
    vi.mocked(loadStarterProject).mockResolvedValue(project);

    render(<App />);

    await waitFor(() => expect(screen.getByText("Branch Connect Project")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Connect first graph nodes" }));

    const branchEdge = await waitFor(() => {
      const edge = document.querySelector('[data-label="Branches to"]');
      expect(edge).not.toBeNull();
      return edge as HTMLElement;
    });

    expect(branchEdge).toHaveAttribute("data-source", start.id);
    expect(branchEdge).toHaveAttribute("data-target", ending.id);
  });

  it("creates new items only in the active graph by default", async () => {
    vi.mocked(loadStarterProject).mockResolvedValue(setProjectModeInProject(createBlankProject("Independent Items"), "game_story"));

    render(<App />);

    await waitFor(() => expect(screen.getByText("Independent Items")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Switch to Story Flow" })).toHaveClass("is-active");
    fireEvent.click(screen.getByRole("button", { name: "Add Scene" }));

    const storyNode = await waitFor(() => {
      const node = document.querySelector('[data-testid^="flow-node-scene-"]');
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });

    fireEvent.click(screen.getByRole("button", { name: "Switch to World" }));
    await waitFor(() => expect(storyNode).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Add Character" }));

    const worldNode = await waitFor(() => {
      const node = document.querySelector('[data-testid^="flow-node-character-"]');
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });

    fireEvent.click(screen.getByRole("button", { name: "Switch to Story Flow" }));

    await waitFor(() => expect(worldNode).not.toBeInTheDocument());
    expect(document.querySelector('[data-testid^="flow-node-scene-"]')).not.toBeNull();
  });

  it("toggles eligible game item visibility between Story Flow, World, and both graphs", async () => {
    const fixture = createGameStoryFixture();
    vi.mocked(loadStarterProject).mockResolvedValue(fixture.project);

    render(<App />);

    await waitFor(() => expect(screen.getByText("Game Flow Project")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId(`flow-node-${fixture.start.id}`));
    expect(screen.getByLabelText("Graph visibility")).toHaveValue("both");

    fireEvent.change(screen.getByLabelText("Graph visibility"), { target: { value: "world" } });

    await waitFor(() => expect(screen.queryByTestId(`flow-node-${fixture.start.id}`)).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Switch to World" }));
    await waitFor(() => expect(screen.getByTestId(`flow-node-${fixture.start.id}`)).toBeInTheDocument());

    fireEvent.click(screen.getByTestId(`flow-node-${fixture.start.id}`));
    expect(screen.getByLabelText("Graph visibility")).toHaveValue("world");
    fireEvent.change(screen.getByLabelText("Graph visibility"), { target: { value: "story_flow" } });

    await waitFor(() => expect(screen.queryByTestId(`flow-node-${fixture.start.id}`)).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Switch to Story Flow" }));
    await waitFor(() => expect(screen.getByTestId(`flow-node-${fixture.start.id}`)).toBeInTheDocument());

    fireEvent.click(screen.getByTestId(`flow-node-${fixture.start.id}`));
    expect(screen.getByLabelText("Graph visibility")).toHaveValue("story_flow");
    fireEvent.change(screen.getByLabelText("Graph visibility"), { target: { value: "both" } });
    fireEvent.click(screen.getByRole("button", { name: "Switch to World" }));

    await waitFor(() => expect(screen.getByTestId(`flow-node-${fixture.start.id}`)).toBeInTheDocument());
  });

  it("opens the optional RPG sidebar to inspect continuity issues", async () => {
    const fixture = createGameStoryFixture({ includeLonelyScene: true });
    vi.mocked(loadStarterProject).mockResolvedValue(fixture.project);

    render(<App />);

    await waitFor(() => expect(screen.getByText("Game Flow Project")).toBeInTheDocument());
    expect(screen.getByText(/\d+ issues/)).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Game Story Tools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Continuity/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Unreachable node")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Branching RPG" }));
    fireEvent.click(screen.getByRole("button", { name: /Continuity/ }));

    await waitFor(() => expect(screen.getByText("Unreachable node")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Unreachable node"));

    await waitFor(() => expect(screen.getByTestId(`flow-node-${fixture.lonely!.id}`)).toHaveAttribute("data-selected", "true"));
  });

  it("scrubs graph time from the timeline without changing the selected graph item", async () => {
    const project = createBlankProject("Timeline Scrub Project");
    const source = createStoryEntity("character", project.itemTypes, "Mara Vale");
    const target = createStoryEntity("character", project.itemTypes, "Orin Ash");
    const before = createStoryEntity("event", project.itemTypes, "Before the Meeting");
    const meeting = createStoryEntity("event", project.itemTypes, "The Meeting");
    const relationship = {
      ...createStoryRelationship(project, source.id, target.id, "knows"),
      startsAtEventId: meeting.id
    };
    before.timeline = { order: 1, effects: [] };
    meeting.timeline = { order: 2, effects: [] };

    vi.mocked(loadStarterProject).mockResolvedValue({
      ...project,
      entities: {
        [source.id]: source,
        [target.id]: target,
        [before.id]: before,
        [meeting.id]: meeting
      },
      relationships: [relationship],
      layout: {
        [source.id]: { x: 10, y: 20 },
        [target.id]: { x: 310, y: 20 },
        [before.id]: { x: 10, y: 240 },
        [meeting.id]: { x: 310, y: 240 }
      }
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText("Timeline Scrub Project")).toBeInTheDocument());
    expect(screen.getByTestId(`flow-node-${source.id}`)).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId(`flow-edge-${relationship.id}`)).toHaveAttribute("data-opacity", "1");

    fireEvent.change(screen.getByLabelText("Timeline time"), { target: { value: "1" } });

    await waitFor(() => expect(screen.getByTestId(`flow-edge-${relationship.id}`)).toHaveAttribute("data-opacity", "0.42"));
    expect(screen.getByTestId(`flow-node-${source.id}`)).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId(`flow-node-${before.id}`)).toHaveAttribute("data-selected", "false");

    fireEvent.click(screen.getByRole("button", { name: "Show full graph state" }));

    await waitFor(() => expect(screen.getByTestId(`flow-edge-${relationship.id}`)).toHaveAttribute("data-opacity", "1"));
    expect(screen.getByTestId(`flow-node-${source.id}`)).toHaveAttribute("data-selected", "true");
  });

  it("falls back to opening a backup file when folder access is unavailable", async () => {
    vi.mocked(hasFolderProjectSupport).mockReturnValue(false);
    const { container } = render(<App />);
    await waitFor(() => expect(screen.getByText("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Open Project" }));

    expect(fileClickSpy).toHaveBeenCalledTimes(1);

    const input = container.querySelector('input[type="file"]');
    expect(input).toBeInstanceOf(HTMLInputElement);

    fireEvent.change(input!, {
      target: {
        files: [new File(["{}"], "backup.storyteller.json", { type: "application/json" })]
      }
    });

    await waitFor(() => expect(projectFromBundleFile).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Backup Project")).toBeInTheDocument();
    expect(screen.getByText("Project opened from backup")).toBeInTheDocument();
  });
});

function createFocusDepthProject() {
  const project = createBlankProject("Focus Depth Project");
  const hero = createStoryEntity("character", project.itemTypes, "Focused Hero");
  const ally = createStoryEntity("character", project.itemTypes, "First Ally");
  const clue = createStoryEntity("note", project.itemTypes, "Second Clue");
  const faction = createStoryEntity("faction", project.itemTypes, "Third Faction");
  const relic = createStoryEntity("item", project.itemTypes, "Fourth Relic");
  const heroLink = createStoryRelationship(project, hero.id, ally.id, "relates_to");
  const allyLink = createStoryRelationship(project, ally.id, clue.id, "relates_to");
  const clueLink = createStoryRelationship(project, clue.id, faction.id, "relates_to");
  const factionLink = createStoryRelationship(project, faction.id, relic.id, "relates_to");

  return {
    project: {
      ...project,
      entities: {
        [hero.id]: hero,
        [ally.id]: ally,
        [clue.id]: clue,
        [faction.id]: faction,
        [relic.id]: relic
      },
      relationships: [heroLink, allyLink, clueLink, factionLink],
      layout: {
        [hero.id]: { x: 10, y: 20 },
        [ally.id]: { x: 310, y: 20 },
        [clue.id]: { x: 610, y: 20 },
        [faction.id]: { x: 910, y: 20 },
        [relic.id]: { x: 1210, y: 20 }
      }
    },
    hero,
    ally,
    clue,
    faction,
    relic,
    heroLink,
    allyLink,
    clueLink,
    factionLink
  };
}

function createGameStoryFixture(options: { includeLonelyScene?: boolean } = {}) {
  let project = setProjectModeInProject(createBlankProject("Game Flow Project"), "game_story");
  project = addGameStateVariableToProject(project, "flag");
  const variable = project.gameStory!.stateVariables[0];
  project = updateGameStateVariableInProject(project, variable.id, {
    id: "gate-open",
    label: "Gate Open",
    defaultValue: false
  });
  const start = createStoryEntity("scene", project.itemTypes, "Gate Scene", "both");
  const ending = createStoryEntity("ending", project.itemTypes, "Bright Ending", "both");
  const character = createStoryEntity("character", project.itemTypes, "Gatekeeper");
  const lonely = options.includeLonelyScene ? createStoryEntity("scene", project.itemTypes, "Lonely Scene", "both") : null;
  const branch = {
    ...createStoryRelationship(project, start.id, ending.id, "branches_to"),
    gameStory: {
      choiceText: "Open the gate",
      requirements: [],
      effects: [
        {
          id: "effect-open-gate",
          variableId: "gate-open",
          operation: "set" as const,
          value: true
        }
      ],
      consequenceNotes: "The gate opens.",
      priority: 0
    }
  };
  const entities = {
    [start.id]: start,
    [ending.id]: ending,
    [character.id]: character,
    ...(lonely ? { [lonely.id]: lonely } : {})
  };

  project = updateGameStoryProjectMetadata(
    {
      ...project,
      entities,
      relationships: [branch],
      layout: Object.fromEntries(
        Object.values(entities).map((entity, index) => [entity.id, { x: index * 260, y: index % 2 === 0 ? 20 : 240 }])
      ),
      storyFlowLayout: Object.fromEntries(
        Object.values(entities)
          .filter((entity) =>
            entity.type === "scene" || entity.type === "quest" || entity.type === "dialogue" || entity.type === "ending"
          )
          .map((entity, index) => [entity.id, { x: 50 + index * 260, y: 60 }])
      )
    },
    { startNodeId: start.id }
  );

  return {
    project,
    start,
    ending,
    character,
    lonely,
    branch
  };
}
