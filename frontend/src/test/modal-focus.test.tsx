import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { StrictMode } from "react";
import { Modal } from "../components/Shared";
import { ResearchPage } from "../pages/Research";

test("research form keeps focus and selection when polling updates its parent", async () => {
  const props = {
    projectId: "p1",
    tasks: [],
    capabilities: null,
    onChange: () => {},
    viewReport: () => {},
  };
  const { rerender } = render(<ResearchPage {...props} />, { wrapper: StrictMode });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "新建研究任务" }));
  const title = screen.getByLabelText("研究主题") as HTMLInputElement;
  await user.type(title, "Agentic RAG");
  title.setSelectionRange(2, 6);
  rerender(<ResearchPage {...props} tasks={[]} />);
  expect(title).toHaveFocus();
  expect([title.selectionStart, title.selectionEnd]).toEqual([2, 6]);

  const instructions = screen.getByLabelText(/研究要求/) as HTMLTextAreaElement;
  await user.type(instructions, "比较中英文资料");
  instructions.setSelectionRange(1, 4);
  rerender(<ResearchPage {...props} tasks={[]} />);
  expect(instructions).toHaveFocus();
  expect([instructions.selectionStart, instructions.selectionEnd]).toEqual([1, 4]);
  expect(title).toHaveValue("Agentic RAG");
  expect(instructions).toHaveValue("比较中英文资料");
});

test("modal uses the latest close handler and restores focus only on unmount", async () => {
  const trigger = document.createElement("button");
  document.body.append(trigger);
  trigger.focus();
  const firstClose = vi.fn(), latestClose = vi.fn();
  const { rerender, unmount } = render(
    <Modal title="编辑" onClose={firstClose}>
      <input aria-label="内容" autoFocus />
      <button>保存</button>
    </Modal>,
  );
  try {
    const input = screen.getByLabelText("内容");
    expect(input).toHaveFocus();
    rerender(
      <Modal title="编辑" onClose={latestClose}>
        <input aria-label="内容" autoFocus />
        <button>保存</button>
      </Modal>,
    );
    expect(input).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "保存" }));
    await user.tab();
    expect(screen.getByRole("button", { name: "关闭" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "保存" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(firstClose).not.toHaveBeenCalled();
    expect(latestClose).toHaveBeenCalledOnce();
    unmount();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  } finally {
    unmount();
    trigger.remove();
  }
});
