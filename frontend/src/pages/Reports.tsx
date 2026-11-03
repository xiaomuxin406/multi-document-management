import { useEffect, useState, Children, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  Download,
  Pencil,
  Eye,
  Save,
  BookOpen,
  ArrowRight,
  Search,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { api, errorText, formatDate } from "../api";
import type { Task, Report, Evidence } from "../types";
import {
  SectionTitle,
  EmptyState,
  Spinner,
  ErrorBanner,
  Modal,
} from "../components/Shared";
import { EvidenceCard } from "./Research";

export function ReportsPage({
  projectId,
  tasks,
  requestedReportId,
  onResearch,
}: {
  projectId: string;
  tasks: Task[];
  requestedReportId: string | null;
  onResearch: () => void;
}) {
  const available = tasks.filter((t) => t.report_id),
    [selected, setSelected] = useState<string | null>(requestedReportId),
    [report, setReport] = useState<Report | null>(null),
    [editing, setEditing] = useState(false),
    [content, setContent] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [source, setSource] = useState<Evidence | null>(null),
    [query, setQuery] = useState("");
  useEffect(() => {
    setSelected(requestedReportId || null);
    setReport(null);
    setEditing(false);
  }, [projectId, requestedReportId]);
  useEffect(() => {
    if (!selected && available.length) setSelected(available[0].report_id);
  }, [available, selected]);
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setReport(null);
    setError("");
    setEditing(false);
    api<Report>(`/reports/${selected}`)
      .then((r) => {
        if (alive) {
          setReport(r);
          setContent(r.content);
          setSaved(false);
        }
      })
      .catch((e) => {
        if (alive) setError(errorText(e));
      });
    return () => {
      alive = false;
    };
  }, [selected]);
  async function save() {
    if (!report) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api<Report>(`/reports/${report.id}`, {
        method: "PUT",
        body: JSON.stringify({ content, expected_version: report.version }),
      });
      setReport(updated);
      setContent(updated.content);
      setEditing(false);
      setSaved(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function switchReport(id: string) {
    if (busy) return;
    if (
      editing &&
      content !== report?.content &&
      !window.confirm("放弃未保存的修改并切换报告？")
    )
      return;
    setSelected(id);
  }
  function evidenceContent(text: string) {
    return text.split(/(\[E\d+\])/g).map((part, index) => {
      const id = part.match(/^\[(E\d+)\]$/)?.[1];
      const item = report?.evidence.find((e) => e.id === id);
      return item ? (
        <button
          key={index}
          className="citation"
          onClick={() => setSource(item)}
          title={`查看证据 ${id}`}
        >
          {part}
        </button>
      ) : (
        part
      );
    });
  }
  function citedChildren(children: ReactNode): ReactNode {
    return Children.map(children, (child) =>
      typeof child === "string" ? evidenceContent(child) : child,
    );
  }
  return (
    <>
      <SectionTitle
        eyebrow="KNOWLEDGE, MADE SHAREABLE"
        title="让每一次研究，留下成果。"
        description="带着来源阅读，带着判断编辑。把研究沉淀为可以分享的报告。"
        action={
          report ? (
            <div className="header-buttons">
              <a
                className="button secondary"
                href={`/api/reports/${report.id}/export?format=md`}
              >
                <Download size={16} />
                Markdown
              </a>
              <a
                className="button primary"
                href={`/api/reports/${report.id}/export?format=docx`}
              >
                <Download size={16} />
                导出 Word
              </a>
            </div>
          ) : undefined
        }
      />
      <ErrorBanner message={error} />
      {!available.length ? (
        <section className="panel">
          <EmptyState
            icon={<FileText size={32} />}
            title="让你的第一个研究成果，在这里诞生"
            description="完成研究任务后，报告会自动归档。你可以核对来源、编辑内容并导出。"
            action={
              <button className="button primary" onClick={onResearch}>
                开始研究
                <ArrowRight size={16} />
              </button>
            }
          />
        </section>
      ) : (
        <div className="reports-layout">
          <aside className="panel report-list">
            <div className="panel-heading">
              <h2>
                报告档案 <span className="count-pill">{available.length}</span>
              </h2>
            </div>
            <div className="search-field">
              <Search size={15} />
              <input
                aria-label="搜索报告"
                placeholder="搜索报告…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {available
              .filter((t) =>
                t.title.toLowerCase().includes(query.toLowerCase()),
              )
              .map((t) => (
                <button
                  className={`report-list-item ${selected === t.report_id ? "selected" : ""}`}
                  key={t.id}
                  disabled={busy}
                  onClick={() => switchReport(t.report_id!)}
                >
                  <span className="report-file-icon">
                    <FileText size={22} />
                  </span>
                  <strong>{t.title}</strong>
                  <small>
                    {formatDate(t.created_at)} ·{" "}
                    {t.language === "zh" ? "中文" : "English"} ·{" "}
                    {t.mode === "llm" ? "研究报告" : "证据摘录"}
                  </small>
                  <span className="report-status">
                    <CheckCircle2 size={12} /> 已归档
                  </span>
                </button>
              ))}
          </aside>
          <div className="panel report-reader">
            {!report ? (
              <Spinner text="正在打开报告…" />
            ) : (
              <>
                <div className="reader-toolbar">
                  <span>
                    <FileText size={16} />
                    报告正文 <small>v{report.version}</small>
                    {saved && (
                      <em>
                        <CheckCircle2 size={13} />
                        已保存
                      </em>
                    )}
                  </span>
                  <div>
                    {editing ? (
                      <>
                        <button
                          className="button secondary compact"
                          onClick={() => {
                            if (
                              content === report.content ||
                              window.confirm("放弃未保存修改？")
                            ) {
                              setEditing(false);
                              setContent(report.content);
                            }
                          }}
                        >
                          取消
                        </button>
                        <button
                          className="button primary compact"
                          disabled={busy || !content.trim()}
                          onClick={save}
                        >
                          <Save size={14} />
                          {busy ? "保存中…" : "保存版本"}
                        </button>
                      </>
                    ) : (
                      <button
                        className="button secondary compact"
                        onClick={() => {
                          setEditing(true);
                          setSaved(false);
                        }}
                      >
                        <Pencil size={14} />
                        编辑报告
                      </button>
                    )}
                  </div>
                </div>
                {editing ? (
                  <div className="editor-area">
                    <div className="editor-hint">
                      Markdown 编辑 · 保存将创建新版本，来源证据保留。
                    </div>
                    <textarea
                      aria-label="报告内容"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      spellCheck={false}
                    />
                  </div>
                ) : (
                  <article className="markdown-body">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => (
                          <h1>{citedChildren(children)}</h1>
                        ),
                        h2: ({ children }) => (
                          <h2>{citedChildren(children)}</h2>
                        ),
                        h3: ({ children }) => (
                          <h3>{citedChildren(children)}</h3>
                        ),
                        li: ({ children }) => (
                          <li>{citedChildren(children)}</li>
                        ),
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noreferrer">
                            {children}
                          </a>
                        ),
                        p: ({ children }) => (
                          <p>
                            {Array.isArray(children)
                              ? children.map((child, i) =>
                                  typeof child === "string" ? (
                                    <span key={i}>
                                      {evidenceContent(child)}
                                    </span>
                                  ) : (
                                    child
                                  ),
                                )
                              : typeof children === "string"
                                ? evidenceContent(children)
                                : children}
                          </p>
                        ),
                      }}
                    >
                      {report.content}
                    </ReactMarkdown>
                  </article>
                )}
                <div className="report-sources">
                  <div className="panel-heading">
                    <div>
                      <h3>
                        <BookOpen size={17} />
                        来源证据
                      </h3>
                      <span>保留报告生成时的证据快照</span>
                    </div>
                    <span className="count-pill">{report.evidence.length}</span>
                  </div>
                  <div className="evidence-grid">
                    {report.evidence.map((item) => (
                      <EvidenceCard
                        key={item.id}
                        item={item}
                        onOpen={() => setSource(item)}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
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
                查看原始来源
                <ExternalLink size={15} />
              </a>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
