import { test, expect } from "@playwright/test";

test("real multi-user workflow: upload, research, citation, edit, export, isolation", async ({
  page,
}) => {
  const suffix = Date.now().toString(),
    email = `admin-${suffix}@example.com`,
    password = "ResearchPass123!";
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.goto("/");
  const setup = await page.request.get("/api/auth/status");
  const setupRequired = (await setup.json()).setup_required;
  if (!setupRequired)
    await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await page.getByLabel("你的名字").fill("研究员");
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page
    .getByRole("button", {
      name: setupRequired ? "创建管理员，开始研究" : "创建账号",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "创建第一个项目" }).click();
  await page.getByLabel("项目名称").fill("Agentic-RAG 技术研究");
  await page
    .getByLabel("项目描述")
    .fill("双语资料整理、检索闭环与报告产出的完整体验。");
  await page.getByRole("button", { name: "创建项目", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "每一次研究，都向前一步。" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/overview.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "资料库", exact: true }).click();
  await page.getByRole("button", { name: "导入双语示例" }).click();
  await expect(page.getByRole("status")).toContainText("2 份资料");
  await expect(
    page.getByText("Evidence-workflow-sample.md", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".document-name")
    .filter({ hasText: "Agentic-RAG研究笔记（演示）.md" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText(/背景与原理 · 第/)).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.screenshot({
    path: "../docs/screenshots/library.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "研究任务", exact: true }).click();
  await page.getByRole("button", { name: "新建研究任务" }).click();
  await page.getByLabel("研究主题").fill("Agentic-RAG 的应用、证据与局限");
  await page
    .getByLabel("研究要求")
    .fill("比较中英文资料，保留来源，指出缺失的量化数据。");
  await page.getByRole("button", { name: "开始研究", exact: true }).click();
  await expect(page.getByRole("button", { name: "查看报告" })).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.getByText("本地证据摘录模式", { exact: false }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/research.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "收集的证据", exact: false }).click();
  await page.getByRole("button", { name: "查看完整证据" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "查看报告" }).click();
  await expect(page.locator(".markdown-body")).toContainText("[E1]");
  await page.getByRole("button", { name: "[E1]", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "编辑报告" }).click();
  await page
    .getByLabel("报告内容")
    .fill(
      (await page.getByLabel("报告内容").inputValue()) +
        "\n\n## 人工核验\n已核对演示资料来源。",
    );
  await page.getByRole("button", { name: "保存版本" }).click();
  await expect(page.getByText("v2", { exact: true })).toBeVisible();
  await expect(page.locator(".markdown-body")).toContainText(
    "已核对演示资料来源。",
  );
  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: "导出 Word" }).click();
  const downloaded = await downloading;
  expect(downloaded.suggestedFilename()).toContain(".docx");
  await page.screenshot({
    path: "../docs/screenshots/report.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "系统设置", exact: true }).click();
  await expect(page.getByLabel("模型 API 地址")).toBeVisible();
  await page.getByLabel("模型名称").fill("custom-compatible-model");
  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(page.getByText("设置已保存，对新任务生效")).toBeVisible();
  await page.getByRole("button", { name: "用户管理", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "管理成员，守好边界。" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "展开导航" }).click();
  await page.getByRole("button", { name: "工作概览", exact: true }).click();
  await expect(page.locator(".sidebar")).not.toHaveClass(/open/);
  await expect(
    page.getByRole("heading", { name: "每一次研究，都向前一步。" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "../docs/screenshots/mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "展开导航" }).click();
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await page.getByLabel("你的名字").fill("独立成员");
  await page
    .getByLabel("邮箱", { exact: true })
    .fill(`member-${suffix}@example.com`);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "创建第一个项目" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "展开导航" }).click();
  await expect(
    page.getByRole("button", { name: "用户管理", exact: false }),
  ).toHaveCount(0);
  const response = await page.request.get("/api/projects");
  expect(await response.json()).toEqual([]);
  expect(failures).toEqual([]);
});
