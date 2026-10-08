// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReadingSyncNotice from "./ReadingSyncNotice";

afterEach(cleanup);

const props = () => ({
  status: "synced" as const,
  pendingCount: 0,
  legacyCount: 2,
  storageAvailable: true,
  retry: vi.fn(),
  importLegacy: vi.fn(),
  dismissLegacy: vi.fn(),
});

describe("ReadingSyncNotice", () => {
  it("requires an explicit action to move existing browser records", () => {
    const actions = props();
    render(<ReadingSyncNotice sync={actions} />);
    expect(actions.importLegacy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "계정에 옮기기" }));
    expect(actions.importLegacy).toHaveBeenCalledOnce();
  });

  it("keeps import disabled until the account records can be checked", () => {
    const actions = props();
    const view = render(
      <ReadingSyncNotice sync={{ ...actions, status: "loading" }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "계정에 옮기기" }));
    view.rerender(
      <ReadingSyncNotice sync={{ ...actions, status: "offline" }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "계정에 옮기기" }));
    expect(actions.importLegacy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "기록 다시 연결" }));
    expect(actions.retry).toHaveBeenCalledOnce();
  });

  it("lets readers postpone import without treating it as consent", () => {
    const actions = props();
    render(<ReadingSyncNotice sync={actions} />);
    fireEvent.click(screen.getByRole("button", { name: "지금은 안 할게요" }));
    expect(actions.dismissLegacy).toHaveBeenCalledOnce();
    expect(actions.importLegacy).not.toHaveBeenCalled();
  });

  it("discloses local-only records and volatile storage after dismissing import", () => {
    render(
      <ReadingSyncNotice
        sync={{
          ...props(),
          legacyCount: 0,
          localOnlyCount: 2,
          storageAvailable: false,
        }}
      />,
    );
    expect(
      screen.getByText(/예전 기록 2권은 아직 이 브라우저에만/),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "최근 기록이 사라질 수 있어요",
    );
  });
});
