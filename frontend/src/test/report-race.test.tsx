import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { test, expect, vi } from "vitest";
import { ReportsPage } from "../pages/Reports";
import type { Task } from "../types";

test("report switching is disabled while a version save is pending", async () => {
  const report = {
    id: "r1",
    task_id: "t1",
    title: "Report A",
    content: "## Claim [E1]\n\nOriginal [E1]",
    version: 1,
    evidence: [
      {
        id: "E1",
        title: "Source",
        text: "Evidence",
        location: "line 1",
        url: null,
        document_id: "d1",
        source_type: "document",
        score: 1,
      },
    ],
    created_at: "2026-11-02",
    updated_at: "2026-11-02",
  };
  let resolveSave!: (value: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, options: RequestInit) =>
      options?.method === "PUT"
        ? new Promise<Response>((resolve) => {
            resolveSave = resolve;
          })
        : Promise.resolve(new Response(JSON.stringify(report))),
    ),
  );
  const tasks = [
    {
      id: "t1",
      report_id: "r1",
      title: "Report A",
      created_at: "2026-11-02",
      language: "en",
    },
    {
      id: "t2",
      report_id: "r2",
      title: "Report B",
      created_at: "2026-11-02",
      language: "en",
    },
  ] as Task[];
  render(
    <ReportsPage
      projectId="p1"
      tasks={tasks}
      requestedReportId="r1"
      onResearch={() => {}}
    />,
  );
  expect(await screen.findAllByRole("button", { name: "[E1]" })).toHaveLength(
    2,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "编辑报告" }),
  );
  await userEvent.type(screen.getByLabelText("报告内容"), " edited");
  await userEvent.click(screen.getByRole("button", { name: "保存版本" }));
  expect(screen.getByRole("button", { name: /Report B/ })).toBeDisabled();
  resolveSave(
    new Response(JSON.stringify({ ...report, content: "edited", version: 2 })),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Report B/ })).toBeEnabled(),
  );
});
