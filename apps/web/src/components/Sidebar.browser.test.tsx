import { DEFAULT_CLIENT_SETTINGS, EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { useLocation } from "@tanstack/react-router";
import { createRef } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { render } from "../../test/render";
import { openCommandPalette } from "../commandPaletteBus";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { __setClientSettingsForTests, getClientSettings } from "../hooks/useSettings";
import { useThreadRouteTarget } from "../hooks/useThreadRouteTarget";
import { useProjects, useQuietThreadShells } from "../state/entities";
import { makeThreadFixture } from "../test-fixtures";
import { resolveThreadRouteTarget } from "../threadRoutes";
import { useUiStateStore } from "../uiStateStore";
import type { Project } from "../types";
import { ComposerPromptEditorTiptap } from "./ComposerPromptEditorTiptap";
import Sidebar from "./Sidebar";
import { SidebarProvider } from "./ui/sidebar";

vi.mock("../state/entities", { spy: true });
vi.mock("../hooks/useHandleNewThread", { spy: true });
vi.mock("../hooks/useThreadRouteTarget", { spy: true });
vi.mock("../commandPaletteBus", () => ({
  openCommandPalette: vi.fn(),
  isCommandPaletteOpen: () => false,
}));
vi.mock("./sidebar/SidebarChrome", () => ({
  SidebarChromeHeader: () => null,
  SidebarChromeFooter: () => null,
}));

function project(id: string): Project {
  return {
    id: ProjectId.make(id),
    environmentId: EnvironmentId.make("local"),
    title: id,
    workspaceRoot: `/projects/${id}`,
    repositoryIdentity: null,
    defaultModelSelection: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    scripts: [],
  };
}

describe("sidebar header new thread", () => {
  it.each([
    { mode: "normal", count: 2, shift: false, picker: true },
    { mode: "boring", count: 2, shift: false, picker: true },
    { mode: "boring", count: 2, shift: true, picker: false },
    { mode: "boring", count: 1, shift: false, picker: false },
    { mode: "legacy", count: 2, shift: false, picker: false },
  ] as const)("$mode sidebar, $count projects, shift=$shift: picker=$picker", async (scenario) => {
    using stack = new DisposableStack();
    const previousSettings = getClientSettings();
    stack.defer(() => __setClientSettingsForTests(previousSettings));
    __setClientSettingsForTests({
      ...DEFAULT_CLIENT_SETTINGS,
      boringSidebarEnabled: scenario.mode === "boring",
      legacySidebarEnabled: scenario.mode === "legacy",
    });
    const projects = [project("active"), project("idle")].slice(0, scenario.count);
    const currentProjectRef = {
      environmentId: projects[0]!.environmentId,
      projectId: projects[0]!.id,
    };
    const startThread = vi.fn().mockResolvedValue(null);
    vi.mocked(useProjects).mockReturnValue(projects);
    vi.mocked(useHandleNewThread).mockReturnValue({
      activeDraftThread: null,
      activeThread: null,
      defaultProjectRef: currentProjectRef,
      handleNewThread: startThread,
      routeDraftId: null,
      routeThreadRef: null,
    });
    vi.mocked(openCommandPalette).mockClear();
    await using screen = await render(
      <SidebarProvider>
        <Sidebar routeReveal={{ observedKey: null, pendingKey: null }} />
      </SidebarProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "New thread", exact: true }), {
      modifiers: scenario.shift ? ["Shift"] : [],
    });

    if (scenario.picker) {
      expect(openCommandPalette).toHaveBeenCalledExactlyOnceWith({ open: "new-thread-in" });
      expect(startThread).not.toHaveBeenCalled();
    } else {
      expect(openCommandPalette).not.toHaveBeenCalled();
      expect(startThread).toHaveBeenCalledExactlyOnceWith(currentProjectRef);
    }
  });
});

it("opens the top scoped thread and navigates from the focused composer", async () => {
  using _platform = vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
  using stack = new DisposableStack();
  // The test router has no parameterized routes; derive the active thread from its location.
  vi.mocked(useThreadRouteTarget).mockImplementation(function useRouteTarget() {
    const pathname = useLocation({ select: (location) => location.pathname });
    const [, environmentId, threadId] = pathname.split("/");
    return resolveThreadRouteTarget({ environmentId, threadId });
  });
  stack.defer(() => vi.mocked(useThreadRouteTarget).mockReset());
  const previousSettings = getClientSettings();
  stack.defer(() => __setClientSettingsForTests(previousSettings));
  __setClientSettingsForTests(DEFAULT_CLIENT_SETTINGS);
  useUiStateStore.setState(useUiStateStore.getInitialState(), true);
  const projects = [project("active"), project("idle")];
  vi.mocked(useProjects).mockReturnValue(projects);
  const threads = [
    makeThreadFixture({
      id: ThreadId.make("older"),
      environmentId: EnvironmentId.make("local"),
      projectId: ProjectId.make("idle"),
      latestUserMessageAt: "2026-01-01T00:00:00.000Z",
    }),
    makeThreadFixture({
      id: ThreadId.make("newer"),
      environmentId: EnvironmentId.make("local"),
      projectId: ProjectId.make("idle"),
      latestUserMessageAt: "2026-01-02T00:00:00.000Z",
    }),
  ];
  vi.mocked(useQuietThreadShells).mockReturnValue(threads);
  stack.defer(() => vi.mocked(useQuietThreadShells).mockReset());
  vi.mocked(useHandleNewThread).mockReturnValue({
    activeDraftThread: null,
    activeThread: null,
    defaultProjectRef: null,
    handleNewThread: vi.fn(),
    routeDraftId: null,
    routeThreadRef: null,
  });
  await using screen = await render(
    <SidebarProvider>
      <Sidebar routeReveal={{ observedKey: null, pendingKey: null }} />
      <ComposerPromptEditorTiptap
        editorRef={createRef()}
        value="Draft message"
        cursor={5}
        contextRecords={new Map()}
        skills={[]}
        disabled={false}
        placeholder="Message"
        ariaLabel="Message"
        onChange={() => {}}
        onPaste={() => {}}
      />
    </SidebarProvider>,
  );
  await userEvent.click(screen.getByLabelText("Filter threads by project", { exact: true }));
  await userEvent.click(page.getByRole("option", { name: /idle/ }));
  await vi.waitFor(() => expect(screen.router?.state.location.pathname).toBe("/local/newer"));
  await userEvent.click(screen.getByRole("textbox", { name: "Message" }));
  const editor = screen.getByRole("textbox", { name: "Message" }).element();
  for (const [key, threadId] of [
    ["ArrowUp", "newer"],
    ["ArrowDown", "older"],
    ["ArrowDown", "older"],
    ["ArrowUp", "newer"],
  ] as const) {
    editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await vi.waitFor(() =>
      expect(screen.router?.state.location.pathname).toBe(`/local/${threadId}`),
    );
    expect(document.activeElement).toBe(editor);
    expect(window.getSelection()?.isCollapsed).toBe(true);
  }
});
