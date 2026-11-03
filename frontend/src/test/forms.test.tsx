import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { AuthScreen } from "../components/AuthScreen";
import { NewProjectDialog } from "../components/NewProjectDialog";

test("setup submits credentials and surfaces a server validation error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ detail: "该邮箱已注册" }), {
          status: 409,
        }),
    ),
  );
  render(<AuthScreen setupRequired onAuthenticated={() => {}} />);
  await userEvent.type(screen.getByLabelText("你的名字"), "研究员");
  await userEvent.type(screen.getByLabelText("邮箱"), "test@example.com");
  await userEvent.type(screen.getByLabelText("密码"), "StrongPass123!");
  await userEvent.click(
    screen.getByRole("button", { name: "创建管理员，开始研究" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("该邮箱已注册");
});

test("project creation returns the actual persisted project", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: "p1",
            name: "RAG 调研",
            description: "",
            document_count: 0,
            task_count: 0,
            created_at: "2026-11-02",
          }),
          { status: 201 },
        ),
    ),
  );
  const created = vi.fn();
  render(<NewProjectDialog onClose={() => {}} onCreated={created} />);
  await userEvent.type(screen.getByLabelText("项目名称"), "RAG 调研");
  await userEvent.click(screen.getByRole("button", { name: "创建项目" }));
  await waitFor(() =>
    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1", name: "RAG 调研" }),
    ),
  );
});
