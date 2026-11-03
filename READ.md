·当上下文用量达到90%时压缩上下文和提炼重要部分写入READ.md文件里，每次重启上下文时都要阅读一遍READ.md文件。

## 最新排障（2026-11-03，优先于下方历史状态）

- 修复研究弹窗打字数秒后丢焦点：Modal 的useEffect依赖每次渲染变化的onClose，任务详情1.6秒/工作台4秒轮询导致反复focus容器。现在仅挂载时初始化焦点，layout effect更新关闭回调ref，保留autoFocus及StrictMode回放时初始焦点，卸载恢复触发按钮。
- 回归：frontend/src/test/modal-focus.test.tsx覆盖父刷新下主题/要求焦点与选区、最新Esc回调、Tab及焦点恢复；前端5项测试、build通过。真实Edge frontend/e2e/modal-focus.spec.ts 1 passed (25.7s)，拦截测试API但运行真实App轮询、持续打字和选区保持，无用户数据变更。此次修改尚未提交/推送。

- GitHub：用户授权推送至 https://github.com/xiaomuxin406/multi-file.git，origin已配置；用户已完成GCM登录，API确认账号xiaomuxin406有push权限。远端初始为空、默认分支main，准备首次提交至main；恢复时先核对git status/log/远端状态。当前仓库使用GitHub账号名及164153645+xiaomuxin406@users.noreply.github.com作为提交身份，未改全局配置。
- 首次提交包含78文件，完成敏感信息扫描，.env/data/日志忽略。已补回无密钥.env.example。推送前重新验证后端26项、前端3项及build通过。gh CLI未安装，使用Git/GCM；不要输出凭据。

- 用户已创建 `.env`，真实密钥仅保留本地，不输出或提交。原配置 EMBEDDING_MODEL=Qwen/Qwen3.8-27B，实测 /embeddings 返回400、Model does not exist，导致启动补索引失败。
- 已仅将 `.env` 的 EMBEDDING_MODEL 清空，保留其他用户配置；本地词项检索恢复，模型生成与搜索配置独立。providers.py 补嵌入失败恢复指引，README说明对话/嵌入模型区别；新增脱敏错误回归，26 tests passed、ruff F passed。
- 已后台启动8000，日志 backend.stdout.log/backend.stderr.log；启动日志server PID23012（重用前请核实），5173前端已存在。8000和5173/api/health返回200；capabilities显示llm_configured/search_configured=true、embedding_mode=local_lexical。不能将配置存在说成云端调用验证通过。
- 本次 Tavily 实际请求遇到 ConnectError，尚未证实联网搜索成功；上一轮旧密钥返回401。管理员保存的模型配置会覆盖.env中的LLM地址/模型，诊断模型调用时需同时核对DB settings。

## 用户确认的方向

作品集、可持续开发、中英文、多用户与管理员、联网搜索、可替换模型，界面有条理且交互丰富。用户已明确要求开始实现，无需再次询问方案批准。

## 当前进度（2026-11-02）

- 项目根目录 D:/codex项目/基于 Agentic-RAG 的多文件资料整理与报告生成系统。原来只有此 READ.md。已 git init 于 feat/research-workspace；代码保留本地，未 push/publish，未代配置 Git 身份。
- 设计与 API 契约：docs/superpowers/specs/2026-11-02-research-workspace-design.md。
- 计划：docs/superpowers/plans/2026-11-02-research-workspace.md。
- 后端 FastAPI/SQLAlchemy/Alembic/LangGraph/Chroma 已实现。云端 OpenAI-compatible + Tavily 使用 .env，默认无密钥本地摘录，不伪装 LLM。可选 EMBEDDING_MODEL 调用语义 API，默认中英文 BM25 + 哈希词项向量。
- 账号 cookie session 哈希存储，scrypt 密码，首次管理员初始化；角色与 owner_id 权限隔离；跨站写入检查；单进程研究线程池。
- PDF/DOCX/MD/TXT 文本解析、资料去重、Chroma 索引、研究循环、持久事件、报告编辑版本及 md/docx 导出已接通。
- 后端最新测试：2026-11-02 `.venv/Scripts/python -m pytest -q` → 25 passed (6.74s)。ruff F 检查和 pip check 通过。
- 虚拟环境 .venv 已安装后端依赖。pip 升级至 26.2.2，防止旧 pip 依赖回溯下载。
- 前端由主代理完成：React/TS/Vite，研序暖灰墨绿工作台，overview/library/research/reports/settings/admin，登录/初始化/注册、项目切换、批量上传/规则分类/原文、轮询时间线/证据/缺口、报告引用/编辑/Word与Markdown下载、管理员设置与角色。
- 前端测试 3 passed，TypeScript+Vite build 通过。npm 运行依赖 audit 官方服务返回 0 vulnerabilities。
- 独立审查 /root/final_review 已产出 docs/briefs/final-review.md；4 个问题已主代理补失败回归并修复；独立复核只确认上传一项，其余主代理已逐项核查并在报告表格注明。额外报告并发版本：API PUT expected_version 原子更新，旧标签返回409。不要重做已完成任务。
- scripts/setup.ps1、scripts/start.ps1、.env.example、README.md、docs/roadmap.md、双语 samples 与 CI 已添加。

## 已验收与恢复信息

- `./scripts/verify-e2e.ps1` 真实 Edge 浏览器链路最新 1 passed (11.9s)：首次管理员、双语上传、原文定位、研究、证据、引用点击、编辑v2、Word下载、管理设置、390px无溢出、普通用户隔离；浏览器异常为零。测试使用临时8001/5174与独立DB，已自动停止。
- docs/screenshots/{overview,library,research,report,mobile}.png 已查看。docs/verification.md 记录完整证据与限制。
- 实际默认工作台 http://127.0.0.1:5173；后端 http://127.0.0.1:8000，正式 DB data/workspace.db 仍未初始化，留给用户创建管理员。进程若已结束用 ./scripts/start.ps1 重启；依赖已安装。
- 单独启动：`.venv/Scripts/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000`；另终端 `cd frontend; npm.cmd run dev`。
- .env 尚未创建，使用 .env.example 配置密钥。无真实密钥，不能声称云端 LLM/Tavily/语义embedding已联网验证。已有 HTTP 契约测试及真实 LangGraph 缺口/冲突补检索测试。
- 配置：LLM_API_KEY/LLM_BASE_URL/LLM_MODEL、TAVILY_API_KEY；可选 EMBEDDING_MODEL/EMBEDDING_API_KEY/EMBEDDING_BASE_URL。默认本地词项向量+双语BM25不是语义检索。变更 embedding 重启自动补索引，环境字段权威。
- 限制：单进程双研究线程、扫描件需OCR、旧.doc不支持、Web只搜索摘要、引用编号校验不等于语义支持；DOCX导出尚未逐页渲染QA。当前为可运行首版，路线 docs/roadmap.md。
- 后续优先：用户配置真实API并验证质量/预算；更完整分类/语义评测/逐论断审核；独立队列/项目共享/生产部署。
