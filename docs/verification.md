# 验证记录 · 2026-11-02

## 自动化结果

- 后端 `python -m pytest -q`：25 passed。涵盖账号初始化、权限隔离、上传/去重/定位、DOCX 表格、报告引用与版本冲突、索引删除、取消/重试、重启恢复、供应商契约、二轮缺口检索、冲突驱动补检索、配置切换和上传并发。
- 前端 `npm test -- --run`：3 passed。表单错误展示、项目创建与延迟报告保存的切换保护。
- 前端 `npm run build`：TypeScript 与 Vite 生产构建通过。
- 浏览器 `./scripts/verify-e2e.ps1`：1 passed (14.0s)。使用本机 Microsoft Edge，真实 FastAPI/SQLite/Chroma，无 mock 业务响应。
- `ruff check backend --select F` 通过；`pip check` 无依赖冲突。
- `npm audit --omit=dev --registry=https://registry.npmjs.org`：0 vulnerabilities。默认镜像不支持 audit，因此显式使用官方审计服务；未修改机器全局 npm 配置。

## 浏览器链路

首次管理员初始化 → 创建项目 → 上传中英文演示资料 → 查看原文定位 → 启动本地研究 → 查看任务事件/证据 → 查看报告 → 编辑保存 v2 → 下载 DOCX → 管理配置/用户 → 390px 窄屏布局 → 退出并注册普通成员 → 验证项目为空且无管理入口。收集浏览器异常，结果为零。

截图位于 docs/screenshots/：overview、library、research、report、mobile。原文规则分类与任务记录全部来源于测试期间的真实操作；正式数据库保留未初始化状态。

## 实际验证边界

未提供真实模型 API、embedding API 或 Tavily 密钥，因此尚未验证真实服务连通性、生成质量、费用或跨语言语义召回效果。测试通过 httpx.MockTransport 验证外部协议、错误脱敏与安全 URL 过滤；Agent 循环测试使用确定性外部响应，真实运行 LangGraph 路由和数据库写入。

PDF 当前支持文本提取，扫描件需要 OCR。DOCX 导出通过真实下载与 ZIP 文件头校验，尚未逐页验证复杂 Markdown 转 Word 的版式。引用编号检查不等于事实支持检查。当前单后端进程，不支持分布式部署或节点级自动续跑。

## 审查修复

独立审查报告 docs/briefs/final-review.md。四个发现均先添加失败回归再修复：上传移出事件循环、冲突进入补检索查询、embedding 环境配置为权威、报告保存期间禁止切换。另增加 expected_version + 原子条件更新，旧标签页保存返回 409，避免静默覆盖。
