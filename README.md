# 研序 · Research Workspace

基于 Agentic-RAG 的多文件资料整理与报告生成系统。面向作品集与持续开发：多用户、管理员、双语资料、联网搜索、可替换模型、可观察的检索闭环与可追溯报告。

## 启动

需要 Python 3.10+、Node.js 22+。Windows PowerShell：

```powershell
./scripts/setup.ps1
# 编辑 .env 中的 LLM_API_KEY 与 TAVILY_API_KEY
./scripts/start.ps1
```

打开 http://127.0.0.1:5173 。首次访问创建管理员；没有预设密码。之后可注册普通用户。不同用户的项目、资料、任务和报告隔离；管理员在用户管理中维护角色和启停状态，在系统设置中修改模型地址等非敏感参数。密钥只配置在 `.env`，修改后重启后端。

手动启动（两个终端，均在项目根目录）：

```powershell
.venv/Scripts/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

```powershell
cd frontend
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

API 文档：http://127.0.0.1:8000/docs 。开发时前端代理 `/api` 到后端，统一通过前端地址使用，cookie 不需要暴露给 JavaScript。

前端代理地址默认在 `TRUSTED_ORIGINS` 中明确允许。使用其他端口或域名时同步配置；不要将来源校验整体关闭。

## 推荐运行方式

默认推荐云端兼容 OpenAI 协议的 API；`.env` 设置 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`。默认模型名只是可修改的起点，请以供应商实际支持为准。可更换为其他云端兼容接口，或本机提供该协议的服务。

若规划成功但证据评估在约 90 秒后超时，可通过 `LLM_TIMEOUT_SECONDS=180` 调整单次请求读取等待上限（10–300 秒），任务总预算仍为 10 分钟。对于支持 `enable_thinking` 的供应商/模型（如硅基流动部分 Qwen 模型），可设置 `LLM_ENABLE_THINKING=false` 关闭思考模式以降低延迟；其他接口请不设置此变量，避免发送不兼容的参数。修改后重启后端。超时、网络故障、输出截断和格式错误会分别提示，不会把失败当作评估成功。

联网搜索使用 Tavily，设置 `TAVILY_API_KEY`。搜索结果明确标注为网页搜索片段，当前不抓取整页。开启联网但未配置密钥时会阻止任务并给出说明。

`EMBEDDING_MODEL` 是可选的**嵌入模型**，与 `LLM_MODEL` 对话模型分别配置，必须使用供应商的 `/embeddings` 接口支持的完整模型 ID。暂时不使用语义嵌入时设置 `EMBEDDING_MODEL=`，使用本地词项检索；模型生成和 Tavily 搜索仍可独立启用。启动时会为已有资料补建索引，错误的嵌入配置可能导致启动失败。若出现 `Embedding API 返回 HTTP 400`，先清空此项并重启，再核对嵌入模型、输入长度与批量限制。

没有模型密钥时仍可上传资料、检索并生成**本地证据摘录报告**，用于验证应用链路。此模式不具有 LLM 的语义规划、冲突分析或综合写作能力，覆盖率是词项匹配估计，界面和报告均标注。不会模拟 API 成功。

## 使用流程

1. 创建项目，批量上传文本 PDF、DOCX、Markdown 或 TXT。
2. 在资料库查看解析状态、摘录与原文定位；也可主动导入双语演示材料。
3. 创建研究任务，选择中英文、综述/调研/汇报、联网开关及轮次预算。
4. 观察规划、检索、自评估、补检索与生成事件，检查证据、覆盖估计和信息缺口。
5. 阅读带 `[E1]` 等来源编号的报告，点击编号核对证据；人工编辑后保存新版本，导出 Markdown 或 Word。保存包含版本校验，旧标签页不会覆盖较新的修改。

资料库提供中英文关键词规则分类与主题标签，并明确标注分类方式；后续可独立替换为语义分类器。

## 结构

```text
backend/app/api/          HTTP 接口、权限校验与调度
backend/app/services/     解析、检索、模型/搜索适配、LangGraph 研究流程
backend/app/models.py     持久数据模型
backend/alembic/          数据库迁移
backend/tests/            权限、资料、供应商与任务生命周期测试
frontend/src/             React 交互工作台
samples/                  明确标注的中英文演示原文
scripts/                  安装和启动脚本
docs/                     设计、计划与持续开发路线
READ.md                   上下文恢复规则和当前进度
```

元数据默认 SQLite，索引使用持久化 Chroma。检索默认结合中英文 BM25 与本地哈希词项向量；词项向量**不是语义 embedding**。可在 `.env` 配置 `EMBEDDING_MODEL`、`EMBEDDING_BASE_URL` 和 `EMBEDDING_API_KEY` 接入多语言语义 embedding API；更换模型后重启，按供应商与模型创建独立索引并补建已有资料向量。重建需要 API 调用费用，勿频繁切换。Embedding 模型不能直接在管理界面热切换。Chroma 只承担索引，授权与项目归属以数据库为准。原文按 chunk 保留；当前没有保存原始二进制文件用于版式预览。

短期记忆保存任务状态、证据、缺口和事件；长期记忆为同项目资料及历史研究目录。历史任务用于导航，报告事实仍需检索当前原文支持。LangGraph 显式节点负责规划、检索、评估、路由和写作，数量、时间、无新增证据条件约束循环。

## 验证

```powershell
cd backend
../.venv/Scripts/python -m pytest -q
```

```powershell
cd frontend
npm.cmd test -- --run
npm.cmd run build
```

Windows 安装有 Microsoft Edge 时，可运行独立浏览器验收，自动启动 8001/5174 测试服务，使用新测试数据库并关闭真实云端调用：

```powershell
./scripts/verify-e2e.ps1
```

截图保存在 `docs/screenshots/`。其他平台可安装 Playwright Chromium，并设置 `E2E_BROWSER_CHANNEL=chromium` 后运行相应的测试服务。测试脚本不使用或修改正式工作台账号。

测试使用独立临时数据库，不使用真实云端密钥。外部 HTTP 契约测试验证请求、响应及脱敏错误；真实供应商的质量和连通性需配置有效密钥后验证。

## 数据库与部署边界

后端启动自动执行 Alembic 升级。新增持久字段必须新增迁移；不要直接修改已经发布的 revision。`DATABASE_URL` 可切换到 `postgresql+psycopg://...`，首次切换创建新数据库，已有数据需单独迁移。

当前以**单后端进程**运行后台任务，最多两个研究线程，排队上限八个。任务状态和阶段事件持久化；重启中断的任务标记为失败，可手动重试，重试创建新任务而不覆盖旧记录。尚不支持进程崩溃后的节点级续跑。

当前不是直接面向公网的生产部署：上线需配置 HTTPS/`COOKIE_SECURE=true`、反向代理、邀请注册或审核、分布式限流、独立队列、备份和审计。具体演进见 [docs/roadmap.md](docs/roadmap.md)。

扫描 PDF 需要先 OCR；不支持旧版 `.doc`。引用检查只检查编号是否来自证据集，不能保证每条论断的语义正确性。DOCX 导出保留基本标题、列表和文本，不承诺复杂 Markdown 排版完全还原。
