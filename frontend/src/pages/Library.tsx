import { useState, useRef, type DragEvent } from "react";
import {
  UploadCloud,
  Search,
  FileText,
  Trash2,
  ArrowUpRight,
  FilePlus2,
  Files,
  CheckCircle2,
  X,
  BookOpen,
  Download,
  AlertCircle,
} from "lucide-react";
import { api, errorText, formatDate, formatSize } from "../api";
import type { SourceDocument, DocumentDetail } from "../types";
import {
  SectionTitle,
  EmptyState,
  Status,
  Spinner,
  Modal,
  ErrorBanner,
} from "../components/Shared";

const SAMPLE_ZH =
  "# Agentic-RAG 研究笔记（演示资料）\n\n这是人工编写的演示资料，不是已发表论文。\n\n## 背景与原理\nAgentic-RAG 结合任务规划、检索、自评估和补检索。\n\n## 应用与证据\n用于多文件调研、文献阅读和项目汇报。关键论断需要引用原文。\n\n## 局限与风险\n自评分数不是事实正确率。重复内容不构成独立证据。搜索片段不能替代全文。需要限制检索轮数、时间和调用成本。\n\n## 评测\n评估问题覆盖、引用支持和运行成本。本文没有量化测量结果。";
const SAMPLE_EN =
  "# Evidence-driven research (sample)\n\nAn authored demonstration, not an empirical study.\n\n## Background and mechanisms\nAn agentic workflow plans questions, retrieves evidence, evaluates gaps and decides whether another search is needed.\n\n## Applications and evidence\nLiterature reviews and project briefings require traceable sources. Preserve document identity, location and excerpt.\n\n## Limitations and risks\nCounting chunks does not establish sufficiency. Multiple chunks from one source are not independent corroboration. Search snippets can omit context. Long-term memory can become stale.\n\n## Evaluation\nCompare supported claims, question coverage, time and cost. No measured performance results are provided.";

export function LibraryPage({
  projectId,
  documents,
  onChange,
}: {
  projectId: string;
  documents: SourceDocument[];
  onChange: () => void;
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [uploading, setUploading] = useState(false),
    [dragging, setDragging] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState<DocumentDetail | null>(null),
    [loading, setLoading] = useState(false),
    [deleting, setDeleting] = useState<string | null>(null),
    [busyDelete, setBusyDelete] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function upload(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const result = await api<SourceDocument[]>(
        `/projects/${projectId}/documents`,
        { method: "POST", body: form },
      );
      const failed = result.filter((d) => d.status === "failed");
      setNotice(
        `已处理 ${result.length} 份资料，${result.length - failed.length} 份可用于检索${failed.length ? `，${failed.length} 份解析失败，请查看详情` : ""}。重复资料会自动复用。`,
      );
      onChange();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }
  async function inspect(id: string) {
    setLoading(true);
    setError("");
    try {
      setSelected(await api<DocumentDetail>(`/documents/${id}`));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusyDelete(true);
    try {
      await api(`/documents/${deleting}`, { method: "DELETE" });
      setDeleting(null);
      setSelected(null);
      onChange();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusyDelete(false);
    }
  }
  function drop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!uploading) upload(Array.from(e.dataTransfer.files));
  }
  const filtered = documents.filter(
    (d) =>
      d.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" || d.name.toLowerCase().endsWith(filter)),
  );
  const chunks = documents.reduce((n, d) => n + d.chunk_count, 0);
  return (
    <>
      <SectionTitle
        eyebrow="BUILD YOUR KNOWLEDGE BASE"
        title="资料归位，思路就位。"
        description="汇集不同格式的资料，让每一段原文成为研究的可靠依据。"
        action={
          <button
            className="button primary"
            disabled={uploading}
            onClick={() => input.current?.click()}
          >
            <UploadCloud size={17} />
            {uploading ? "正在解析…" : "上传资料"}
          </button>
        }
      />
      <input
        ref={input}
        className="visually-hidden"
        type="file"
        multiple
        accept=".pdf,.docx,.md,.markdown,.txt"
        aria-label="选择研究资料"
        onChange={(e) => upload(Array.from(e.target.files || []))}
      />
      <ErrorBanner message={error} />
      {notice && (
        <div className="success-banner" role="status">
          <CheckCircle2 size={17} />
          {notice}
          <button
            className="icon-button"
            onClick={() => setNotice("")}
            aria-label="关闭提示"
          >
            <X size={15} />
          </button>
        </div>
      )}
      <div
        className={`upload-zone ${dragging ? "dragging" : ""} ${uploading ? "busy" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
      >
        <span className="upload-icon">
          <UploadCloud size={28} />
        </span>
        <div>
          <h3>
            {uploading
              ? "正在解析并建立检索索引…"
              : "把资料拖到这里，让研究开始连接"}
          </h3>
          <p>支持 PDF、Word (.docx)、Markdown 和 TXT · 每批最多 20 份</p>
          <small>文本型 PDF 可直接解析；扫描件请先完成 OCR。</small>
        </div>
        <button
          className="button secondary"
          disabled={uploading}
          onClick={() => input.current?.click()}
        >
          <FilePlus2 size={16} />
          选择文件
        </button>
      </div>
      <div className="library-summary">
        <span>
          <Files size={16} />
          <strong>{documents.length}</strong> 份资料
        </span>
        <span>
          <BookOpen size={16} />
          <strong>{chunks}</strong> 个文本块
        </span>
        <span className="sample-action">
          先体验一下？
          <button
            disabled={uploading}
            onClick={() =>
              upload([
                new File([SAMPLE_ZH], "Agentic-RAG研究笔记（演示）.md", {
                  type: "text/markdown",
                }),
                new File([SAMPLE_EN], "Evidence-workflow-sample.md", {
                  type: "text/markdown",
                }),
              ])
            }
          >
            导入双语示例
            <ArrowUpRight size={14} />
          </button>
        </span>
      </div>
      <section className="panel library-panel">
        <div className="list-toolbar">
          <div className="segmented">
            {[
              ["all", "全部资料"],
              [".pdf", "PDF"],
              [".docx", "Word"],
              [".md", "Markdown"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={filter === id ? "selected" : ""}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="搜索资料"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索资料名称…"
            />
          </div>
        </div>
        {loading && <Spinner text="正在读取原文…" />}
        {filtered.length ? (
          <div className="document-table">
            <div className="document-table-head">
              <span>资料名称</span>
              <span>索引状态</span>
              <span>文本块</span>
              <span>添加时间</span>
              <span />
            </div>
            {filtered.map((d) => (
              <div className="document-row" key={d.id}>
                <button className="document-name" onClick={() => inspect(d.id)}>
                  <span
                    className={`file-icon ${d.name.toLowerCase().endsWith(".pdf") ? "pdf" : d.name.toLowerCase().endsWith(".docx") ? "word" : "markdown"}`}
                  >
                    <FileText size={21} />
                    <small>{d.name.split(".").pop()?.toUpperCase()}</small>
                  </span>
                  <span>
                    <strong>{d.name}</strong>
                    <small>
                      {d.category || "一般资料"} ·{" "}
                      {d.language === "en"
                        ? "EN"
                        : d.language === "mixed"
                          ? "中英"
                          : "中文"}{" "}
                      · {formatSize(d.size)} ·{" "}
                      {d.error ||
                        d.summary.slice(0, 50) ||
                        "查看原文与来源定位"}
                    </small>
                  </span>
                </button>
                <Status value={d.status} />
                <span className="chunk-count">
                  {d.chunk_count}
                  <small> 段</small>
                </span>
                <span className="document-date">
                  {formatDate(d.created_at)}
                </span>
                <button
                  className="icon-button danger"
                  aria-label={`删除 ${d.name}`}
                  onClick={() => setDeleting(d.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Files size={30} />}
            title={
              query ? "没有找到匹配资料" : "你的知识底座，从第一份资料开始"
            }
            description={
              query
                ? "试试其他名称或切换文件类型。"
                : "上传资料，或导入双语示例，体验从原文到报告的完整流程。"
            }
            action={
              !query ? (
                <button
                  className="button secondary compact"
                  onClick={() => input.current?.click()}
                >
                  添加第一份资料
                  <ArrowUpRight size={15} />
                </button>
              ) : undefined
            }
          />
        )}
      </section>
      <div className="bottom-note">
        <BookOpen size={16} />
        <span>资料摘要用于导航；报告中的关键结论，会追溯到具体原文。</span>
      </div>
      {selected && (
        <Modal
          wide
          title={selected.name}
          subtitle={`${selected.chunk_count} 个文本块 · ${formatSize(selected.size)} · 原文定位`}
          onClose={() => setSelected(null)}
        >
          <div
            className="document-tags"
            title="基于中英文关键词规则分类，可后续替换为语义分类"
          >
            <span className="pill neutral">
              {selected.category || "一般资料"}
            </span>
            {(selected.tags || []).map((tag) => (
              <span className="pill" key={tag}>
                {tag}
              </span>
            ))}
            <small>规则分类</small>
          </div>
          <div className="document-preview">
            {selected.status === "failed" ? (
              <ErrorBanner message={selected.error} />
            ) : (
              selected.chunks.map((chunk, index) => (
                <article key={chunk.id}>
                  <div className="chunk-location">
                    <span>{(index + 1).toString().padStart(2, "0")}</span>
                    {chunk.location}
                  </div>
                  <p>{chunk.text}</p>
                </article>
              ))
            )}
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="删除这份资料？"
          subtitle="原文片段和检索索引将移除；已生成报告保留当时的证据快照。"
          onClose={() => setDeleting(null)}
        >
          <ErrorBanner message={error} />
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setDeleting(null)}
            >
              保留资料
            </button>
            <button
              className="button danger-button"
              onClick={remove}
              disabled={busyDelete}
            >
              {busyDelete ? "正在删除…" : "确认删除"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
