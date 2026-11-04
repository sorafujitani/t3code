import { useState } from "react";
import { startWorkspaceFocus } from "../lib/workspaceFocus";
import { ThreadId } from "@t3tools/contracts";
import { DEFAULT_RESOLVED_KEYBINDINGS } from "@t3tools/shared/keybindings";
import { expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "../../test/render";
import { dispatchMenuAction } from "../shortcuts/dispatcher";
import type { RightPanelSurface } from "../rightPanelStore";
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
