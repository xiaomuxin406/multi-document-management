# Independent final review

**交付状态（主代理复核，2026-11-02）：下面为初次审查历史。四项问题及版本并发观察已修复并通过回归，不代表当前仍未修复。**

| 项目 | 修复 | 证据 |
|---|---|---|
| 上传阻塞事件循环 | 同步路由在工作线程执行解析与索引 | test_upload_does_not_block_other_requests |
| 冲突无法补检索 | 下一轮查询包含 gaps + conflicts，仍限制最多三条 | test_conflict_only_evaluation_triggers_real_followup_search |
| embedding 旧配置覆盖环境 | 读取以环境为权威，写入不持久化该字段 | test_environment_embedding_is_authoritative_after_config_change |
| 报告保存期间切换竞态 | busy 时按钮禁用，switchReport 同时检查 | report-race.test.tsx |
| 多窗口报告版本覆盖 | expected_version + 原子条件更新，过期返回409 | test_upload_research_citations_and_versioned_export |

最终验证：后端25通过、前端3通过、构建通过、真实浏览器端到端通过。独立审查者复核确认第一项；其余由主代理逐项检查代码与失败→通过回归，未声称独立二审全部通过。

Reviewed backend authorization/session, document ingest/indexing, task state/Agent routing, provider configuration, and frontend request/state handling. No source changes made. Existing test evidence provided by controller: backend 22 passed, frontend 2 passed/build, end-to-end 1 passed; not rerun unchanged suites.

## Findings

1. **[P1] Synchronous parsing/indexing blocks the API event loop** — `backend/app/api/documents.py:84` and `:100`. The upload endpoint is `async def` but calls `parse_document` and `retriever.index` directly. PDF extraction can be expensive; semantic indexing performs synchronous HTTP calls for every batch (up to 60 s per embedding request). Because these execute on the Uvicorn event loop, uploads can freeze login, health, task polling, cancellation, and every other user until processing completes. Move the processing transaction into a synchronous worker/thread/background service; do not share the SQLAlchemy Session concurrently across threads. Keep request/body validation separate from parsing work.

2. **[P2] Conflict-only assessments cannot trigger actual supplementary retrieval** — `backend/app/services/research.py:213`, `:299`. Evaluation can return all questions adequate (`gaps=[]`) but one or more conflicts, correctly setting `sufficient=False`. The route requests another retrieval round, but `retrieve` builds all subsequent queries exclusively from `gaps`. This produces zero queries, records zero evidence and immediately stops for stagnation. Include unresolved conflicts in the next retrieval plan (bounded queries), or derive explicit conflict-resolution questions. Add a test where the first assessment has full coverage plus conflicting claims and verify that another search actually executes.

3. **[P2] Persisted embedding field makes configuration unsavable after environment model change** — `backend/app/api/common.py:52`, `backend/app/api/admin.py:64`. Saving any admin settings persists `embedding_model` together with mutable provider options. Later, the documented `.env EMBEDDING_MODEL` change and restart correctly changes the running retriever, but `system_settings` overrides the environment value with the old saved value. The UI receives this stale value in a read-only input, submits it unchanged, and `update_settings` rejects every save with 409. Keep environment-only embedding model authoritative in reads and omit it from persisted editable settings, or reconcile the saved field explicitly on startup.

4. **[P2] An in-flight report save can replace another selected report in the editor** — `frontend/src/pages/Reports.tsx:77-90` and `switchReport`. Report selection remains enabled while a PUT is pending, and `save` unconditionally applies its response to `report/content`. If the user saves A, switches to B, and A's slower save response arrives after B's GET, the sidebar still selects B but the editor displays A; the next edit/save can target the wrong report. Disable switching while saving, or capture report/run identity and ignore responses that no longer match the current selection. Cover it with controlled delayed fetch promises.

## Nonblocking observations

- `backend/app/api/reports.py:27` uses read/increment/write version numbers without optimistic concurrency or a unique `(report_id, version)` constraint. Two browser tabs can save divergent revision 2 records and overwrite the current report. For sustained multi-user use, require an expected version and use an atomic conditional update returning 409 on stale edits.
- Existing owner checks consistently resolve project ownership before document/task/report operations, and retry creates a distinct run. No owner-bypass finding was identified in this review.
