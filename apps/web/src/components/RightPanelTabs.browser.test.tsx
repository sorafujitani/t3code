import "~/index.css";

import { useState } from "react";
import { startWorkspaceFocus } from "../lib/workspaceFocus";
import { ThreadId } from "@t3tools/contracts";
import { DEFAULT_RESOLVED_KEYBINDINGS } from "@t3tools/shared/keybindings";
import { describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render, stubGlobal } from "../../test/render";
import { dispatchMenuAction } from "../shortcuts/dispatcher";
import type { RightPanelSurface } from "../rightPanelStore";
import { HistorySwipeNavigation } from "./HistorySwipeNavigation";
import { RightPanelTabs } from "./RightPanelTabs";

it.each([
  { kind: "side-chat", id: "side-chat:a", threadId: ThreadId.make("a") },
  { kind: "diff", id: "diff" },
  { kind: "files", id: "files" },
  {
    kind: "file",
    id: "file:README.md",
    relativePath: "README.md",
    revealLine: null,
    revealRequestId: 0,
  },
  { kind: "pull-requests", id: "pull-requests" },
  {
    kind: "pull-request",
    id: "pull-request:1",
    projectId: "p",
    repository: "owner/repo",
    number: 1,
  },
  { kind: "device", id: "device" },
  { kind: "preview", id: "browser:new", resourceId: null },
] satisfies RightPanelSurface[])(
  "handles navigation, close, and menu shortcuts for $kind",
  async (surface) => {
    const onActivate = vi.fn();
    const onClose = vi.fn();
    const noop = () => {};
    const surfaces = [
      surface,
      { kind: "side-chat", id: "side-chat:b", threadId: ThreadId.make("b") },
    ] as const;
    function Panel() {
      const [active, setActive] = useState<RightPanelSurface>(surface);
      return (
        <RightPanelTabs
          mode="inline"
          open
          keybindings={DEFAULT_RESOLVED_KEYBINDINGS}
          getShortcutContext={() => ({
            terminalFocus: false,
            terminalOpen: false,
            previewFocus: false,
            previewOpen: false,
            isWeb: true,
            isDesktop: false,
          })}
          surfaces={surfaces}
          environmentId={null}
          activeSurfaceId={active.id}
          pendingSurfaceIds={new Set()}
          previewSessions={{}}
          desktopByTabId={{}}
          terminalLabelsById={new Map()}
          onActivate={(next) => {
            onActivate(next);
            setActive(next);
          }}
          onCloseSurface={onClose}
          onCloseOtherSurfaces={noop}
          onCloseSurfacesToRight={noop}
          onCloseAllSurfaces={noop}
          onCopyFilePath={noop}
          onAddBrowser={noop}
          onAddBrowserInProfile={noop}
          onAddTerminal={noop}
          onAddDiff={noop}
          onAddFiles={noop}
          onAddPullRequest={noop}
          onAddPullRequests={noop}
          onAddDevice={noop}
          onAddSideChat={noop}
          browserAvailable={false}
          terminalAvailable
          diffAvailable
          filesAvailable
          pullRequestAvailable
          pullRequestsAvailable
          deviceAvailable={false}
          sideChatAvailable
        >
          <div data-side-chat-pane key={active.id}>
            <button>Bring back</button>
            <div data-workspace-area="composer">
              <div
                role="textbox"
                aria-label="Side input"
                data-testid="composer-editor"
                contentEditable
                suppressContentEditableWarning
              >
                Draft
              </div>
            </div>
          </div>
        </RightPanelTabs>
      );
    }
    await using screen = await render(<Panel />);
    using cleanup = new DisposableStack();
    cleanup.defer(startWorkspaceFocus(screen.router!));
    let editor = screen.getByRole("textbox", { name: "Side input" }).element();
    editor.focus();
    const mod = navigator.platform.toLowerCase().includes("mac")
      ? { metaKey: true }
      : { ctrlKey: true };
    editor.blur();
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        ...mod,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(onActivate).not.toHaveBeenCalled();
    editor.focus();
    editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        ...mod,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(onActivate).not.toHaveBeenCalled();
    editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        shiftKey: true,
        key: "ArrowRight",
        code: "ArrowRight",
        ...mod,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(onActivate).toHaveBeenCalledWith(surfaces[1]);
    await expect.element(screen.getByRole("textbox", { name: "Side input" })).toHaveFocus();
    editor = screen.getByRole("textbox", { name: "Side input" }).element();
    const closeEvent = new KeyboardEvent("keydown", {
      key: "w",
      code: "KeyW",
      ...mod,
      bubbles: true,
      cancelable: true,
    });
    editor.dispatchEvent(closeEvent);
    expect(closeEvent.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledExactlyOnceWith(surfaces[1]);
    editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "w",
        code: "KeyW",
        ...mod,
        repeat: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    dispatchMenuAction("rightPanel.close");
    expect(onClose).toHaveBeenCalledTimes(2);
    editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "t",
        code: "KeyT",
        ...mod,
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await expect.element(page.getByRole("menuitem", { name: /Side chat/ })).toBeVisible();
    dispatchMenuAction("rightPanel.close");
    expect(onClose).toHaveBeenCalledTimes(2);
  },
);

const navigateHistory = vi.hoisted(() => vi.fn());
vi.mock("../navigationHistory", () => ({ canNavigateHistory: () => true, navigateHistory }));

// Chromium starts a gesture scroll, and Electron reports its begin, only for a
// wheel event the page did not preventDefault; it then scrolls the latched scroller.
function trackpad() {
  const begin = new Set<() => void>();
  const end = new Set<() => void>();
  const subscribe = (listeners: Set<() => void>) => (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  let scrolling = false;
  return {
    bridge: { onTrackpadScrollBegin: subscribe(begin), onTrackpadScrollEnd: subscribe(end) },
    scroll(target: Element, deltas: readonly number[]) {
      let scroller: Element | null = target;
      while (
        scroller &&
        (scroller.scrollWidth <= scroller.clientWidth ||
          !/auto|scroll/.test(getComputedStyle(scroller).overflowX))
      ) {
        scroller = scroller.parentElement;
      }
      for (const deltaX of deltas) {
        const event = new WheelEvent("wheel", {
          deltaX,
          bubbles: true,
          cancelable: true,
          composed: true,
        });
        target.dispatchEvent(event);
        if (event.defaultPrevented) continue;
        if (scroller) scroller.scrollLeft += deltaX;
        if (scrolling) continue;
        scrolling = true;
        for (const listener of begin) listener();
      }
      if (scrolling) for (const listener of end) listener();
      scrolling = false;
    },
  };
}

const surfaces: RightPanelSurface[] = Array.from({ length: 16 }, (_, index) => ({
  id: `terminal:${index}`,
  kind: "terminal",
  resourceId: `${index}`,
  terminalIds: [`${index}`],
  activeTerminalId: `${index}`,
}));

describe("RightPanelTabs", () => {
  it("a flick that scrolls the tab strip to its left edge keeps the thread, a swipe from the edge goes back", async () => {
    navigateHistory.mockReset();
    const { bridge, scroll } = trackpad();
    using _bridge = stubGlobal("desktopBridge", bridge);
    using _platform = vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    const panel = document.createElement("div");
    panel.style.cssText = "width: 320px; height: 200px; display: flex";
    const noop = () => {};
    await using screen = await render(
      <>
        <HistorySwipeNavigation />
        <RightPanelTabs
          mode="embedded"
          keybindings={[]}
          getShortcutContext={() => ({
            terminalFocus: false,
            terminalOpen: false,
            previewFocus: false,
            previewOpen: false,
            isWeb: true,
            isDesktop: false,
          })}
          surfaces={surfaces}
          environmentId={null}
          activeSurfaceId={null}
          pendingSurfaceIds={new Set()}
          previewSessions={{}}
          desktopByTabId={{}}
          terminalLabelsById={new Map(surfaces.map((surface) => [surface.id, "Terminal"]))}
          onActivate={noop}
          onCloseSurface={noop}
          onCloseOtherSurfaces={noop}
          onCloseSurfacesToRight={noop}
          onCloseAllSurfaces={noop}
          onCopyFilePath={noop}
          onAddBrowser={noop}
          onAddBrowserInProfile={noop}
          onAddTerminal={noop}
          onAddDiff={noop}
          onAddFiles={noop}
          onAddPullRequest={noop}
          onAddPullRequests={noop}
          onAddDevice={noop}
          browserAvailable={false}
          terminalAvailable
          diffAvailable={false}
          filesAvailable={false}
          pullRequestAvailable={false}
          pullRequestsAvailable={false}
          deviceAvailable={false}
        >
          {null}
        </RightPanelTabs>
      </>,
      { container: panel },
    );
    const viewport = screen.container.querySelector<HTMLElement>(
      '[data-right-panel-tab-list] [data-slot="scroll-area-viewport"]',
    )!;
    expect(viewport.scrollWidth - viewport.clientWidth).toBeGreaterThan(120);
    viewport.scrollLeft = 120;

    const momentum = Array.from({ length: 24 }, (_, index) => -60 * 0.85 ** index);
    scroll(viewport.querySelector("[data-active-tab]")!, [-10, -20, -30, ...momentum]);

    expect(viewport.scrollLeft).toBe(0);
    expect(navigateHistory).not.toHaveBeenCalled();

    viewport.scrollLeft = 0;
    scroll(viewport.querySelector("[data-active-tab]")!, [-40, -40, -40, -40, -40]);

    expect(navigateHistory).toHaveBeenCalledExactlyOnceWith("back");
  });
});
