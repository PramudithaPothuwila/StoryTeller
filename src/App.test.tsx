import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import { createBlankProject } from "./data/story";

vi.mock("@xyflow/react", () => ({
  addEdge: (edge: unknown, edges: unknown[]) => [...edges, edge],
  Background: () => null,
  BackgroundVariant: {
    Dots: "dots"
  },
  Controls: () => null,
  MarkerType: {
    ArrowClosed: "arrowclosed"
  },
  MiniMap: () => null,
  ReactFlow: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    fileClickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    anchorClickSpy.mockRestore();
    fileClickSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("renders project verbs and removes storage-demo labels", async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByDisplayValue("Loaded Project")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "New Project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Backup" })).toBeInTheDocument();
    expect(screen.getByText("Not selected")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save folder" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open folder" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
  });

  it("asks for a project folder and saves immediately when creating a new project", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByDisplayValue("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "New Project" }));

    await waitFor(() => expect(writeProjectToDirectory).toHaveBeenCalledTimes(1));
    expect(window.showDirectoryPicker).toHaveBeenCalledTimes(1);
    expect(writeProjectToDirectory).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Untitled Story" }),
      folderHandle
    );
    expect(screen.getByDisplayValue("Untitled Story")).toBeInTheDocument();
    expect(screen.getByText("Project saved")).toBeInTheDocument();
    expect(screen.getByText("Story Folder")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Project" }));

    await waitFor(() => expect(writeProjectToDirectory).toHaveBeenCalledTimes(2));
    expect(window.showDirectoryPicker).toHaveBeenCalledTimes(1);
  });

  it("does not create a new project when folder access is unavailable", async () => {
    vi.mocked(hasFolderProjectSupport).mockReturnValue(false);
    render(<App />);
    await waitFor(() => expect(screen.getByDisplayValue("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "New Project" }));

    expect(writeProjectToDirectory).not.toHaveBeenCalled();
    expect(createProjectBundle).not.toHaveBeenCalled();
    expect(anchorClickSpy).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Loaded Project")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Folder selection is unavailable in this browser. Use a browser with folder access to save folder projects."
      )
    ).toBeInTheDocument();
  });

  it("keeps the current project if new project folder selection is cancelled", async () => {
    window.showDirectoryPicker = vi.fn(async () => undefined as unknown as FileSystemDirectoryHandle);
    render(<App />);
    await waitFor(() => expect(screen.getByDisplayValue("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "New Project" }));

    await waitFor(() => expect(screen.getByText("Choose a project folder to create a new project")).toBeInTheDocument());
    expect(writeProjectToDirectory).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Loaded Project")).toBeInTheDocument();
  });

  it("selects a project folder and saves the current project into it", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByDisplayValue("Loaded Project")).toBeInTheDocument());

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
    await waitFor(() => expect(screen.getByDisplayValue("Loaded Project")).toBeInTheDocument());

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
    await waitFor(() => expect(screen.getByDisplayValue("Loaded Project")).toBeInTheDocument());

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
    await waitFor(() => expect(screen.getByDisplayValue("Loaded Project")).toBeInTheDocument());

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
    await waitFor(() => expect(screen.getByDisplayValue("Loaded Project")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Open Project" }));

    await waitFor(() => expect(readProjectFromDirectory).toHaveBeenCalledWith(folderHandle));
    expect(screen.getByDisplayValue("Opened Project")).toBeInTheDocument();
    expect(screen.getByText("Project opened")).toBeInTheDocument();
  });

  it("falls back to opening a backup file when folder access is unavailable", async () => {
    vi.mocked(hasFolderProjectSupport).mockReturnValue(false);
    const { container } = render(<App />);
    await waitFor(() => expect(screen.getByDisplayValue("Loaded Project")).toBeInTheDocument());

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
    expect(screen.getByDisplayValue("Backup Project")).toBeInTheDocument();
    expect(screen.getByText("Project opened from backup")).toBeInTheDocument();
  });
});
