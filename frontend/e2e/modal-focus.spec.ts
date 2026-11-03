import { test, expect } from "@playwright/test";

test("typing stays focused across real task and workspace polling", async ({ page }) => {
  const user = { id: "u1", name: "研究员", email: "test@example.com", role: "member", is_active: true, created_at: "2026-11-03" };
  const project = { id: "p1", name: "焦点回归", description: "", created_at: "2026-11-03", document_count: 0, task_count: 1 };
  const task = { id: "t1", project_id: "p1", title: "已有研究", instructions: "", language: "zh", report_type: "research", web_enabled: false, max_rounds: 3, status: "completed", stage: "completed", round: 1, coverage: 1, mode: "extractive", error: "", created_at: "2026-11-03", updated_at: "2026-11-03", report_id: null };
  let workspacePolls = 0, detailPolls = 0;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown;
    switch (path) {
      case "/api/auth/status": body = { setup_required: false }; break;
      case "/api/auth/me": body = user; break;
      case "/api/projects": body = [project]; break;
      case "/api/capabilities": body = { llm_configured: false, search_configured: false, mode: "extractive", embedding_mode: "local_lexical" }; break;
      case "/api/projects/p1/documents": body = []; break;
      case "/api/projects/p1/tasks": workspacePolls++; body = [task]; break;
      case "/api/tasks/t1": detailPolls++; body = { ...task, evidence: [], gaps: [], outline: [], events: [] }; break;
      default: throw new Error(`Unexpected API request: ${path}`);
    }
    await route.fulfill({ json: body });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "研究任务", exact: true }).click();
  await expect.poll(() => detailPolls).toBeGreaterThan(0);
  const opener = page.getByRole("button", { name: "新建研究任务" });
  await opener.click();
  const title = page.getByLabel("研究主题");
  await expect(title).toBeFocused();
  const initialWorkspace = workspacePolls;
  const text = "Agentic RAG focus should stay while typing";
  await title.pressSequentially(text, { delay: 130 });
  await expect(title).toHaveValue(text);
  await expect(title).toBeFocused();
  await expect.poll(() => workspacePolls).toBeGreaterThan(initialWorkspace);
  const instructions = page.getByLabel("研究要求");
  await instructions.fill("比较中英文资料，保留来源");
  await instructions.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(2, 6));
  const initialDetail = detailPolls;
  await expect.poll(() => detailPolls, { timeout: 7000 }).toBeGreaterThan(initialDetail + 1);
  await expect(instructions).toBeFocused();
  expect(await instructions.evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.selectionEnd])).toEqual([2, 6]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();
});
