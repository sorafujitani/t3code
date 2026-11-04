import { ThreadId } from "@t3tools/contracts";
import { DEFAULT_RESOLVED_KEYBINDINGS } from "@t3tools/shared/keybindings";
import { expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "../../test/render";
import { RightPanelTabs } from "./RightPanelTabs";

it("handles side chat navigation and the panel menu from an embedded composer", async () => {
  const onActivate = vi.fn();
  const noop = () => {};
  const surfaces = [
    { kind: "side-chat", id: "side-chat:a", threadId: ThreadId.make("a") },
    { kind: "side-chat", id: "side-chat:b", threadId: ThreadId.make("b") },
  ] as const;
  await using screen = await render(
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
      activeSurfaceId="side-chat:a"
      pendingSurfaceIds={new Set()}
      previewSessions={{}}
      desktopByTabId={{}}
      terminalLabelsById={new Map()}
      onActivate={onActivate}
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
      <div data-side-chat-pane>
        <textarea aria-label="Side input" />
      </div>
    </RightPanelTabs>,
  );
  const editor = screen.getByRole("textbox", { name: "Side input" }).element();
  editor.focus();
  const mod = navigator.platform.toLowerCase().includes("mac")
    ? { metaKey: true }
    : { ctrlKey: true };
  editor.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      code: "ArrowRight",
      ...mod,
      bubbles: true,
      cancelable: true,
    }),
  );
  expect(onActivate).toHaveBeenCalledWith(surfaces[1]);
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
});
