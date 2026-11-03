# 研序 Research Workspace · Design

用户已授权开始实现。定位为可持续开发的中英文、多用户作品集项目，支持管理员、PDF/DOCX/Markdown 批量上传、联网搜索、可替换模型以及证据驱动报告。

## Architecture

React + TypeScript + Vite 前端；FastAPI + SQLAlchemy 后端；SQLite 开发默认，DATABASE_URL 支持 PostgreSQL。LangGraph 驱动 plan → retrieve → evaluate → retrieve/write 闭环。Chroma 为持久化向量存储，结合中英文关键词检索。模型与搜索供应商通过接口隔离：OpenAI-compatible HTTP API + Tavily HTTP search。没有密钥时可运行本地证据整理模式，必须明确标记为 extractive，不假装 LLM 或联网成功。

## Security and persistence

初次安装由 /api/auth/setup 创建唯一初始管理员；之后用户自行注册为 member，管理员不可通过注册参数提升。密码使用 scrypt，随机会话令牌仅保存哈希，HttpOnly SameSite cookie。每个项目、文档、任务、报告按 owner_id 隔离，管理员管理用户和配置但不绕过项目访问。首次安装无默认密码。管理员不能禁用最后一位有效管理员。API key 只写环境变量，不保存数据库或回传；管理界面配置非敏感模型、搜索参数并显示密钥是否存在。

## API contract

所有 API 前缀 /api；错误使用 {detail:string}。cookie 登录，无前端令牌。
- GET /auth/status → {setup_required:boolean}
- POST /auth/setup or /auth/register {name,email,password} → User; POST /auth/login {email,password} → User; GET /auth/me → User; POST /auth/logout → {ok:true}
- User {id,name,email,role:'admin'|'member',is_active,created_at}
- GET/POST /projects；POST {name,description}; Project {id,name,description,created_at,document_count,task_count}
- GET /projects/{id}/documents → Document[]; POST /projects/{id}/documents multipart files[]；DELETE /documents/{id}; GET /documents/{id} → Document + {chunks:Chunk[]}
- Document {id,project_id,name,media_type,size,status:'ready'|'failed',error,summary,chunk_count,created_at}; Chunk {id,text,location}
- GET /projects/{id}/tasks → Task[]; POST /projects/{id}/tasks {title,instructions,language:'zh'|'en',report_type:'research'|'review'|'brief',web_enabled:boolean,max_rounds:number} → Task (202)
- Task {id,project_id,title,instructions,language,report_type,web_enabled,max_rounds,status:'queued'|'running'|'completed'|'failed'|'cancelled',stage,round,coverage,mode:'extractive'|'llm',error,created_at,updated_at,report_id:string|null}
- GET /tasks/{id} → Task + {events:Event[],evidence:Evidence[],gaps:string[],outline:string[]}; POST /tasks/{id}/cancel; POST /tasks/{id}/retry
- Event {id,kind,message,created_at,data:object}; Evidence {id,title,text,location,url:string|null,source_type:'document'|'web',document_id:string|null,score:number}
- GET /reports/{id} → Report; PUT /reports/{id} {content:string,expected_version:number}; GET /reports/{id}/export?format=md|docx downloads
- Report {id,task_id,title,content,version,created_at,updated_at,evidence:Evidence[]}；PUT 需携带 expected_version，过期编辑返回 409。
- GET /admin/users; PATCH /admin/users/{id} {role?,is_active?}
- GET /admin/settings → {llm_base_url,llm_model,embedding_model,search_provider,search_max_results,max_upload_mb,llm_configured,search_configured}; PUT same editable keys excluding *_configured. API keys environment only.
- GET /health → {status,version}; GET /capabilities → {llm_configured,search_configured,mode,embedding_mode}

## Agent rules

规划子问题；按缺口检索；证据去重；使用模型判断覆盖和冲突，同时程序约束最大轮次/无新增停止。短期记忆为持久化任务状态、事件和证据；长期记忆为项目文档、摘要和已完成报告。跨任务只读取同项目已完成摘要并回到原文检索。Web evidence 标记为搜索片段，链接指向来源；不假装读取整个网页。外部文本视作不可信证据，不可覆盖系统任务或触发工具操作。检索与写作有超时和数量上限。禁止虚构引用，不足则给出缺口。

## UI

品牌「研序 / Research Workspace」。浅色研究工作台，暖灰背景、白色卡片、墨绿强调色，清晰侧边栏与项目导航。包含 overview、library、research、reports、settings、admin。真实空态；通过明确的按钮导入双语样例，无伪造任务。批量拖放、搜索与筛选、抽屉原文、创建任务表单、轮询进度、事件时间线、证据卡、覆盖率、取消重试、Markdown 预览/编辑与下载。键盘可操作，表单标签与 focus 状态，响应式。

## Boundaries

首版支持文本 PDF、DOCX、MD/TXT；扫描 PDF 显示需 OCR。不提供旧版 .doc、OCR、全网页抓取或分布式执行的假支持。后台任务运行单进程，重启将中断任务标为可重试；向生产多进程演进时引入独立队列。提供数据库迁移、测试、启动脚本、.env.example、README、持续开发路线。外部 API 无密钥时只验证本地闭环和供应商契约，明确记录验证限制。
