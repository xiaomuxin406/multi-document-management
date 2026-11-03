import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Files,
  Network,
  FileCheck2,
  ScanLine,
  UploadCloud,
  Sparkles,
  Globe2,
  ChevronRight,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import type {
  Project,
  User,
  SourceDocument,
  Task,
  Capabilities,
  Page,
} from "../types";
import {
  SectionTitle,
  Status,
  TextLink,
  EmptyState,
} from "../components/Shared";
import { formatDate } from "../api";

export function Overview({
  project,
  user,
  documents,
  tasks,
  capabilities,
  navigate,
  viewReport,
}: {
  project: Project;
  user: User;
  documents: SourceDocument[];
  tasks: Task[];
  capabilities: Capabilities | null;
  navigate: (page: Page) => void;
  viewReport: (id: string) => void;
}) {
  const completed = tasks.filter((t) => t.status === "completed"),
    active = tasks.filter((t) => ["running", "queued"].includes(t.status));
  const stats = [
    {
      label: "已入库资料",
      value: documents.filter((d) => d.status === "ready").length,
      unit: "份",
      icon: Files,
      note: "你的研究知识底座",
      color: "green",
    },
    {
      label: "研究任务",
      value: tasks.length,
      unit: "项",
      icon: Network,
      note: active.length
        ? `${active.length} 项正在进行`
        : "从问题出发，持续探索",
      color: "blue",
    },
    {
      label: "报告成果",
      value: completed.length,
      unit: "篇",
      icon: FileCheck2,
      note: "沉淀每一次思考",
      color: "ochre",
    },
    {
      label: "可追溯文本块",
      value: documents.reduce((n, d) => n + d.chunk_count, 0),
      unit: "段",
      icon: ScanLine,
      note: "来源清晰，回溯有据",
      color: "purple",
    },
  ];
  return (
    <>
      <SectionTitle
        eyebrow="YOUR RESEARCH, CONNECTED"
        title="每一次研究，都向前一步。"
        description={`${user.name}，欢迎回来。这里是「${project.name}」的研究全景。`}
        action={
          <button
            className="button primary"
            onClick={() => navigate("research")}
          >
            <Plus size={17} />
            开始新研究
          </button>
        }
      />
      <section className="overview-hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span className="live-dot" />
            AGENTIC RESEARCH WORKSPACE
          </span>
          <h2>
            从一叠资料，
            <br />
            到一份有洞见的报告。
          </h2>
          <p>
            让 Agent 规划阅读、连接证据、判断信息缺口。
            <br />
            把时间留给更值得思考的问题。
          </p>
          <div className="hero-actions">
            <button
              className="button white"
              onClick={() => navigate("library")}
            >
              <UploadCloud size={17} />
              添加研究资料
              <ArrowRight size={16} />
            </button>
            <button className="hero-link" onClick={() => navigate("research")}>
              探索研究流程 <ArrowUpRight size={17} />
            </button>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit-ring ring-one" />
          <div className="orbit-ring ring-two" />
          <div className="orbit-core">
            <Network size={38} />
            <span>RESEARCH AGENT</span>
          </div>
          <div className="orbit-card card-a">
            <BookOpen size={19} />
            <div>
              <strong>多源阅读</strong>
              <small>Documents & knowledge</small>
            </div>
            <span className="orbit-check">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="orbit-card card-b">
            <Sparkles size={19} />
            <div>
              <strong>自主评估</strong>
              <small>Find the missing piece</small>
            </div>
          </div>
          <div className="orbit-card card-c">
            <FileCheck2 size={19} />
            <div>
              <strong>证据成文</strong>
              <small>Insights with sources</small>
            </div>
          </div>
          <span className="orbit-spark spark-one" />
          <span className="orbit-spark spark-two" />
        </div>
        <span className="hero-number">01 — EXPLORE</span>
      </section>
      <div className="stats-grid">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-top">
              <span>{s.label}</span>
              <span className={`stat-icon ${s.color}`}>
                <s.icon size={18} />
              </span>
            </div>
            <div className="stat-value">
              {s.value.toString().padStart(2, "0")}
              <small>{s.unit}</small>
            </div>
            <p>{s.note}</p>
          </div>
        ))}
      </div>
      <div className="overview-columns">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>最近的研究</h2>
              <span>让每一个问题，都有下一步</span>
            </div>
            <TextLink onClick={() => navigate("research")}>查看全部</TextLink>
          </div>
          {tasks.length ? (
            <div className="recent-tasks">
              {tasks.slice(0, 4).map((t) => (
                <button
                  className="recent-task"
                  key={t.id}
                  onClick={() =>
                    t.report_id ? viewReport(t.report_id) : navigate("research")
                  }
                >
                  <div className="task-icon">
                    <Network size={20} />
                  </div>
                  <div className="recent-task-text">
                    <strong>{t.title}</strong>
                    <span>
                      {formatDate(t.created_at)}
                      <i /> {t.web_enabled ? "联网研究" : "项目资料研究"}
                      <i />
                      {t.language === "zh" ? "中文报告" : "English report"}
                    </span>
                  </div>
                  <Status value={t.status} />
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Network size={28} />}
              title="下一个发现，从一个问题开始"
              description="选择研究主题，Agent 将围绕问题收集证据并整理报告。"
              action={
                <button
                  className="button secondary compact"
                  onClick={() => navigate("research")}
                >
                  创建研究任务
                  <ArrowRight size={15} />
                </button>
              }
            />
          )}
        </section>
        <section className="panel research-method">
          <div className="panel-heading">
            <div>
              <h2>研究如何发生</h2>
              <span>有判断的检索，有依据的表达</span>
            </div>
            <span className="pill neutral">闭环流程</span>
          </div>
          <ol className="method-steps">
            <li>
              <span>01</span>
              <div>
                <strong>明确问题，拆解计划</strong>
                <p>围绕目标建立研究维度和证据需求</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>连接资料，补充证据</strong>
                <p>跨文档检索，可按需联接网络来源</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>判断充分，再写报告</strong>
                <p>评估覆盖与缺口，保留证据和引用</p>
              </div>
            </li>
          </ol>
          <button className="method-link" onClick={() => navigate("settings")}>
            <Globe2 size={16} />
            {capabilities?.llm_configured
              ? "模型已配置 · 可使用语义研究"
              : "当前为本地摘录模式 · 配置模型以启用语义研究"}
            <ArrowUpRight size={15} />
          </button>
        </section>
      </div>
      <div className="bottom-note">
        <Sparkles size={16} />
        <span>好的研究，从整理开始。你的资料越完整，结论越有依据。</span>
      </div>
    </>
  );
}
