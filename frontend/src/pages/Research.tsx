import { useEffect, useState, type FormEvent } from "react";
import {
  Plus,
  Network,
  ArrowRight,
  Globe2,
  FileText,
  CheckCircle2,
  Circle,
  RotateCcw,
  Square,
  ChevronRight,
  ExternalLink,
  ArrowUpRight,
  Lightbulb,
  BookOpen,
  Search,
  Sparkles,
  ListTree,
} from "lucide-react";
import type { Task, TaskDetail, Capabilities, Evidence } from "../types";
import { api, post, errorText, formatDate } from "../api";
import {
  SectionTitle,
  Status,
  Modal,
  ErrorBanner,
  EmptyState,
  Spinner,
} from "../components/Shared";

const stages = [
  { id: "plan", label: "规划问题", icon: ListTree },
  { id: "retrieve", label: "收集证据", icon: Search },
  { id: "evaluate", label: "自我评估", icon: Sparkles },
  { id: "write", label: "形成报告", icon: FileText },
];
export function EvidenceCard({
  item,
  onOpen,
}: {
  item: Evidence;
  onOpen?: () => void;
}) {
  return (
    <article className="evidence-card" id={`evidence-${item.id}`}>
      <div className="evidence-heading">
        <span className="evidence-id">{item.id}</span>
        <span className="source-type">
          {item.source_type === "web" ? (
            <Globe2 size={12} />
          ) : (
            <BookOpen size={12} />
          )}{" "}
          {item.source_type === "web" ? "网络来源" : "项目资料"}
        </span>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`打开来源 ${item.title}`}
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>
      <strong>{item.title}</strong>
      <small>{item.location}</small>
      <p>
        {item.text.slice(0, 400)}
        {item.text.length > 400 ? "…" : ""}
      </p>
      {onOpen && (
        <button className="text-link" onClick={onOpen}>
          查看完整证据
          <ArrowUpRight size={13} />
        </button>
      )}
    </article>
  );
}

export function ResearchPage({
  projectId,
  tasks,
  capabilities,
  onChange,
  viewReport,
}: {
  projectId: string;
  tasks: Task[];
  capabilities: Capabilities | null;
  onChange: () => void;
  viewReport: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [detail, setDetail] = useState<TaskDetail | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState<"process" | "evidence">("process"),
    [source, setSource] = useState<Evidence | null>(null);
  useEffect(() => {
    if (!selected && tasks.length) setSelected(tasks[0].id);
  }, [tasks, selected]);
  useEffect(() => {
    setSelected(null);
    setDetail(null);
  }, [projectId]);
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setDetail(null);
    setError("");
    const load = () =>
      api<TaskDetail>(`/tasks/${selected}`)
        .then((value) => {
          if (alive) setDetail(value);
        })
        .catch((e) => {
          if (alive) setError(errorText(e));
        });
    load();
    const timer = setInterval(load, 1600);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [selected]);
  async function action(type: "cancel" | "retry") {
    if (!detail) return;
    setBusy(true);
    setError("");
    try {
      const updated = await post<Task>(`/tasks/${detail.id}/${type}`);
      if (type === "retry") setSelected(updated.id);
      else
        setDetail((previous) =>
          previous ? { ...previous, ...updated } : null,
        );
      onChange();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const activeIndex =
    detail?.status === "completed"
      ? 4
      : stages.findIndex((s) => s.id === detail?.stage);
  return (
    <>
      <SectionTitle
        eyebrow="A QUESTION. A PLAN. A FINDING."
        title="把问题，交给有方法的研究。"
        description="从任务规划到证据评估，完整看见每一次判断与补充检索。"
        action={
          <button className="button primary" onClick={() => setCreating(true)}>
            <Plus size={17} />
            新建研究任务
          </button>
        }
      />
      {!capabilities?.llm_configured && (
        <div className="mode-banner">
          <Lightbulb size={19} />
          <div>
            <strong>当前为本地证据摘录模式</strong>
            <span>
              可体验资料检索与引用流程。语义规划、冲突分析和综合写作需配置模型
              API；覆盖率为词项匹配估计。
            </span>
          </div>
        </div>
      )}
      <ErrorBanner message={error} />
      {!tasks.length && !detail ? (
        <section className="panel">
          <EmptyState
            icon={<Network size={34} />}
            title="值得研究的问题，值得有据的答案"
            description="设定主题、报告类型和资料范围，开启第一项研究。"
            action={
              <button
                className="button primary"
                onClick={() => setCreating(true)}
              >
                开始第一项研究
                <ArrowRight size={16} />
              </button>
            }
          />
          <div className="research-empty-steps">
            {stages.map((s, i) => (
              <div key={s.id}>
                <s.icon size={21} />
                <span>0{i + 1}</span>
                <strong>{s.label}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="research-layout">
          <section className="panel task-list">
            <div className="panel-heading">
              <h2>
                研究记录 <span className="count-pill">{tasks.length}</span>
              </h2>
            </div>
            {tasks.map((task) => (
              <button
                key={task.id}
                className={`task-list-item ${selected === task.id ? "selected" : ""}`}
                onClick={() => setSelected(task.id)}
              >
                <div>
                  <Network size={16} />
                  <Status value={task.status} />
                </div>
                <strong>{task.title}</strong>
                <span>
                  {formatDate(task.created_at)} ·{" "}
                  {task.report_type === "review"
                    ? "文献综述"
                    : task.report_type === "brief"
                      ? "项目汇报"
                      : "调研报告"}
                </span>
                <small>
                  {task.web_enabled ? "项目资料 + 联网" : "项目资料"}
                  <ChevronRight size={13} />
                </small>
              </button>
            ))}
          </section>
          <section className="panel task-detail">
            {!detail ? (
              <Spinner text="正在读取研究过程…" />
            ) : (
              <>
                <div className="task-detail-header">
                  <div>
                    <span className="eyebrow">
                      RESEARCH IN PROGRESS / ARCHIVE
                    </span>
                    <h2>{detail.title}</h2>
                    <div className="task-meta">
                      <Status value={detail.status} />
                      <span>
                        {detail.mode === "llm" ? "LLM 语义研究" : "本地摘录"}
                      </span>
                      <span>
                        {detail.language === "zh" ? "中文" : "English"}
                      </span>
                      <span>
                        第 {detail.round} / {detail.max_rounds} 轮
                      </span>
                    </div>
                  </div>
                  {detail.report_id ? (
                    <button
                      className="button primary compact"
                      onClick={() => viewReport(detail.report_id!)}
                    >
                      查看报告
                      <ArrowUpRight size={15} />
                    </button>
                  ) : ["failed", "cancelled"].includes(detail.status) ? (
                    <button
                      className="button secondary compact"
                      disabled={busy}
                      onClick={() => action("retry")}
                    >
                      <RotateCcw size={15} />
                      重新研究
                    </button>
                  ) : (
                    <button
                      className="button secondary compact"
                      disabled={busy}
                      onClick={() => action("cancel")}
                    >
                      <Square size={13} />
                      取消任务
                    </button>
                  )}
                </div>
                {detail.error && <ErrorBanner message={detail.error} />}
                <div className="stage-track">
                  {stages.map((stage, i) => (
                    <div
                      key={stage.id}
                      className={
                        i < activeIndex
                          ? "done"
                          : i === activeIndex
                            ? "current"
                            : ""
                      }
                    >
                      <span>
                        {i < activeIndex ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          <stage.icon size={18} />
                        )}
                      </span>
                      <strong>{stage.label}</strong>
                      {i < 3 && <div className="stage-connector" />}
                    </div>
                  ))}
                </div>
                <div className="coverage-panel">
                  <div>
                    <span>研究问题覆盖</span>
                    <strong>
                      {Math.round(detail.coverage * 100)}
                      <small>%</small>
                    </strong>
                  </div>
                  <div className="coverage-bar">
                    <span style={{ width: `${detail.coverage * 100}%` }} />
                  </div>
                  <p>
                    {detail.mode === "llm"
                      ? "模型判断 + 证据编号校验；仍需人工复核"
                      : "词项匹配估计，不代表语义充分或事实正确"}
                  </p>
                </div>
                <div className="detail-tabs">
                  <button
                    className={tab === "process" ? "active" : ""}
                    onClick={() => setTab("process")}
                  >
                    研究过程<span>{detail.events.length}</span>
                  </button>
                  <button
                    className={tab === "evidence" ? "active" : ""}
                    onClick={() => setTab("evidence")}
                  >
                    收集的证据<span>{detail.evidence.length}</span>
                  </button>
                </div>
                {tab === "process" ? (
                  <div className="process-content">
                    {detail.outline.length > 0 && (
                      <div className="outline-box">
                        <h3>
                          <ListTree size={16} />
                          研究维度
                        </h3>
                        {detail.outline.map((question, i) => (
                          <p key={i}>
                            <span>0{i + 1}</span>
                            {question}
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="event-timeline">
                      {detail.events.map((event, i) => (
                        <div
                          className={`timeline-event ${event.kind}`}
                          key={event.id}
                        >
                          <span className="timeline-dot">
                            {event.kind === "completed" ? (
                              <CheckCircle2 size={14} />
                            ) : (
                              <Circle size={9} />
                            )}
                          </span>
                          <div>
                            <strong>{event.message}</strong>
                            <small>
                              {new Date(event.created_at).toLocaleTimeString(
                                "zh-CN",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                },
                              )}
                            </small>
                            {Array.isArray(event.data.queries) && (
                              <p>
                                {event.data.queries.map(String).join(" · ")}
                              </p>
                            )}
                            {Array.isArray(event.data.conflicts) &&
                              event.data.conflicts.length > 0 && (
                                <p className="conflict-text">
                                  冲突：
                                  {event.data.conflicts.map(String).join("；")}
                                </p>
                              )}
                          </div>
                          {i === detail.events.length - 1 &&
                            detail.status === "running" && (
                              <span className="live-dot" />
                            )}
                        </div>
                      ))}
                    </div>
                    {detail.gaps.length > 0 && (
                      <div className="gaps-box">
                        <h3>
                          <Lightbulb size={16} />
                          仍需补充的资料
                        </h3>
                        {detail.gaps.map((gap, i) => (
                          <p key={i}>{gap}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="evidence-grid">
                    {detail.evidence.length ? (
                      detail.evidence.map((item) => (
                        <EvidenceCard
                          key={item.id}
                          item={item}
                          onOpen={() => setSource(item)}
                        />
                      ))
                    ) : (
                      <EmptyState
                        icon={<Search size={25} />}
                        title="尚未收集到证据"
                        description="证据会随检索结果在此出现。"
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
      {creating && (
        <TaskDialog
          projectId={projectId}
          capabilities={capabilities}
          onClose={() => setCreating(false)}
          onCreated={(task) => {
            setSelected(task.id);
            setCreating(false);
            onChange();
          }}
        />
      )}
      {source && (
        <Modal
          wide
          title={`${source.id} · ${source.title}`}
          subtitle={source.location}
          onClose={() => setSource(null)}
        >
          <div className="source-full">
            {source.text}
            {source.url && (
              <a href={source.url} target="_blank" rel="noreferrer">
                打开网络原始来源
                <ExternalLink size={15} />
              </a>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function TaskDialog({
  projectId,
  capabilities,
  onClose,
  onCreated,
}: {
  projectId: string;
  capabilities: Capabilities | null;
  onClose: () => void;
  onCreated: (task: Task) => void;
}) {
  const [title, setTitle] = useState(""),
    [instructions, setInstructions] = useState(""),
    [language, setLanguage] = useState("zh"),
    [type, setType] = useState("research"),
    [web, setWeb] = useState(false),
    [rounds, setRounds] = useState(3),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      onCreated(
        await post<Task>(`/projects/${projectId}/tasks`, {
          title,
          instructions,
          language,
          report_type: type,
          web_enabled: web,
          max_rounds: rounds,
        }),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="开启一项新研究"
      subtitle="说清楚你的问题，让资料围绕目标连接。"
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label>
          研究主题
          <input
            autoFocus
            required
            minLength={2}
            maxLength={200}
            placeholder="例如：Agentic-RAG 的应用、优势与局限"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          研究要求 <span className="optional">选填</span>
          <textarea
            rows={3}
            maxLength={5000}
            placeholder="关注哪些问题？报告面向谁？希望比较哪些方面？"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            报告类型
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="research">调研报告</option>
              <option value="review">文献综述</option>
              <option value="brief">项目汇报</option>
            </select>
          </label>
          <label>
            报告语言
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
        <div className="web-toggle">
          <div>
            <Globe2 size={20} />
            <span>
              <strong>联网补充资料</strong>
              <small>
                {capabilities?.search_configured
                  ? "使用 Tavily 搜索；结果保留来源链接"
                  : "尚未配置 Tavily 密钥，当前使用项目资料"}
              </small>
            </span>
          </div>
          <button
            type="button"
            className={`switch ${web ? "on" : ""}`}
            role="switch"
            aria-checked={web}
            aria-label="联网补充资料"
            disabled={!capabilities?.search_configured}
            onClick={() => setWeb(!web)}
          >
            <span />
          </button>
        </div>
        <label className="range-label">
          最大检索轮次 <strong>{rounds} 轮</strong>
          <input
            type="range"
            min={1}
            max={6}
            value={rounds}
            onChange={(e) => setRounds(+e.target.value)}
          />
          <small>信息充足或没有新增证据时，Agent 会提前结束检索。</small>
        </label>
        <ErrorBanner message={error} />
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            取消
          </button>
          <button
            className="button primary"
            disabled={busy || title.trim().length < 2}
          >
            {busy ? "正在创建…" : "开始研究"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
