# Research Workspace Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement tasks with independent review.

**Goal:** 交付可运行的多用户双语资料研究与报告工作台。

**Architecture:** 前后端分离，HTTP API 为边界，LangGraph 负责可观测闭环。配置、检索、文档与供应商各自独立。

**Tech Stack:** React/TypeScript/Vite; FastAPI/SQLAlchemy/Alembic; LangGraph/Chroma; pytest/Playwright.

**Spec:** docs/superpowers/specs/2026-11-02-research-workspace-design.md

## Global Constraints

- READ.md 每次恢复上下文先读；保留用户原始规则并记录实际进度。
- 不伪造模型生成、联网、任务进度或样例业务数据；无密钥用明确的本地摘录模式。
- 会话与 owner_id 权限隔离；密钥只来自环境，不返回前端。
- 范围为文本 PDF/DOCX/MD/TXT，不支持 OCR 和旧版 DOC。
- 无自动 push/publish；工作在 feat/research-workspace。

## 验证进度（2026-11-02）

三个任务均已实现并联调。最新结果：后端 25 passed、前端 3 passed、生产构建通过、真实浏览器端到端 1 passed。审查发现及修复记录在 docs/briefs/final-review.md，具体验证边界见 docs/verification.md。云端密钥尚未提供，因此真实服务效果仍待配置后检验。

## Task 1: Backend vertical slice

Files: backend/app/{main,config,db,models,auth,schemas}.py; backend/app/api/{projects,documents,tasks,admin,reports}.py; backend/app/services/{parsing,retrieval,providers,research}.py; backend/tests/test_system.py; backend/pyproject.toml; backend/alembic/.

- [x] 首先创建 pytest 集成测试：初始管理员设置只可一次、member 不能访问 admin、两个用户不能读取彼此项目/文档/任务/报告、Markdown 上传后产生定位 chunk、无密钥研究产生有来源的摘录报告、删除资料清除索引、失败/取消任务可重试。
- [x] 执行 `.venv/Scripts/python -m pytest backend/tests -q` 观察缺失 API 导致的失败。
- [x] 实现 SQLAlchemy 模型、迁移、cookie 会话与角色约束，上传限制、分块和双语混合检索。
- [x] 实现 LangGraph 预算与去重规则、真实供应商适配器、来源检查、持久事件、报告编辑与导出。
- [x] 执行测试并记录输出；使用独立审查修复权限和生命周期缺陷。

## Task 2: Interactive frontend

Files: frontend/package.json, frontend/src/{App,api,types}.tsx/ts, frontend/src/components/, frontend/src/pages/, frontend/src/styles.css.

Consumes: spec 中固定 API contract。Produces: localhost:5173 proxy /api to :8000。

- [x] 创建用户行为测试：首次设置/登录；项目创建；资料上传；任务创建、完成和报告引用；管理入口按角色显示；失败显示原因。
- [x] 运行测试确认缺少页面造成失败。
- [x] 实现工作台所有导航页、可访问表单、响应式布局及真实轮询。
- [x] 执行 `npm run build`、前端行为测试，浏览器检查宽屏与窄屏。

## Task 3: Integration and delivery

Files: scripts/{setup,start}.ps1, samples/*.md, .env.example, README.md, READ.md, docs/roadmap.md, .github/workflows/ci.yml.

- [x] 用真实后端运行浏览器端到端：管理员设置 → 双语样例上传 → 本地研究 → 引用预览 → 报告编辑导出 → 普通用户隔离。
- [x] 检查管理员配置和无密钥提示，验证供应商错误可恢复，不泄漏密钥。
- [x] 保存启动、测试、环境配置和当前限制；READ.md 记录完成项、命令、下一步。
- [x] 完成最终 code review；只在验证输出后声明结果。
