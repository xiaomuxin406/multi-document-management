import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Library,
  Network,
  FileText,
  Settings,
  Users,
  Plus,
  ChevronsUpDown,
  LogOut,
  ArrowUpRight,
  Menu,
  PanelLeftClose,
  Search,
  FolderOpen,
  CheckCircle2,
  CircleHelp,
} from "lucide-react";
import { api, post, errorText } from "./api";
import type {
  User,
  Project,
  Page,
  SourceDocument,
  Task,
  Capabilities,
} from "./types";
import { AuthScreen } from "./components/AuthScreen";
import { NewProjectDialog } from "./components/NewProjectDialog";
import { Brand, Spinner, ErrorBanner, EmptyState } from "./components/Shared";
import { Overview } from "./pages/Overview";
import { LibraryPage } from "./pages/Library";
import { ResearchPage } from "./pages/Research";
import { ReportsPage } from "./pages/Reports";
import { SettingsPage, AdminPage } from "./pages/Settings";

const navigation = [
  {
    id: "overview",
    label: "工作概览",
    english: "Overview",
    icon: LayoutDashboard,
  },
  { id: "library", label: "资料库", english: "Library", icon: Library },
  { id: "research", label: "研究任务", english: "Research", icon: Network },
  { id: "reports", label: "报告成果", english: "Reports", icon: FileText },
] as const;
const titles: Record<Page, string> = {
  overview: "工作概览",
  library: "资料库",
  research: "研究任务",
  reports: "报告成果",
  settings: "系统设置",
  admin: "用户管理",
};

export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [setup, setSetup] = useState(false),
    [boot, setBoot] = useState(true),
    [error, setError] = useState(""),
    [projects, setProjects] = useState<Project[]>([]),
    [projectId, setProjectId] = useState(""),
    [page, setPage] = useState<Page>("overview"),
    [newProject, setNewProject] = useState(false),
    [documents, setDocuments] = useState<SourceDocument[]>([]),
    [tasks, setTasks] = useState<Task[]>([]),
    [caps, setCaps] = useState<Capabilities | null>(null),
    [refresh, setRefresh] = useState(0),
    [sidebar, setSidebar] = useState(false),
    [reportId, setReportId] = useState<string | null>(null),
    [dataLoading, setDataLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all([
      api<{ setup_required: boolean }>("/auth/status"),
      api<User>("/auth/me").catch(() => null),
    ])
      .then(([s, u]) => {
        if (alive) {
          setSetup(s.setup_required);
          setUser(u);
        }
      })
      .catch((e) => {
        if (alive) setError(errorText(e));
      })
      .finally(() => {
        if (alive) setBoot(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    Promise.all([
      api<Project[]>("/projects"),
      api<Capabilities>("/capabilities"),
    ])
      .then(([p, c]) => {
        if (alive) {
          setProjects(p);
          setCaps(c);
          setProjectId((previous) =>
            p.some((item) => item.id === previous) ? previous : p[0]?.id || "",
          );
        }
      })
      .catch((e) => {
        if (alive) setError(errorText(e));
      });
    return () => {
      alive = false;
    };
  }, [user, refresh]);
  useEffect(() => {
    setDocuments([]);
    setTasks([]);
    setReportId(null);
    if (!user || !projectId) return;
    let alive = true;
    setDataLoading(true);
    setError("");
    Promise.all([
      api<SourceDocument[]>(`/projects/${projectId}/documents`),
      api<Task[]>(`/projects/${projectId}/tasks`),
    ])
      .then(([d, t]) => {
        if (alive) {
          setDocuments(d);
          setTasks(t);
        }
      })
      .catch((e) => {
        if (alive) setError(errorText(e));
      })
      .finally(() => {
        if (alive) setDataLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId, user]);
  useEffect(() => {
    if (!user || !projectId) return;
    let alive = true;
    const load = () =>
      Promise.all([
        api<SourceDocument[]>(`/projects/${projectId}/documents`),
        api<Task[]>(`/projects/${projectId}/tasks`),
      ])
        .then(([d, t]) => {
          if (alive) {
            setDocuments(d);
            setTasks(t);
          }
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [projectId, user, refresh]);
  const reload = () => setRefresh((n) => n + 1);
  const navigate = (next: Page) => {
    setPage(next);
    setSidebar(false);
  };
  const active = projects.find((p) => p.id === projectId);
  async function logout() {
    try {
      await post("/auth/logout");
      setUser(null);
      setProjects([]);
      setProjectId("");
      setDocuments([]);
      setTasks([]);
      setPage("overview");
      setSidebar(false);
      setReportId(null);
    } catch (e) {
      setError(errorText(e));
    }
  }
  function viewReport(id: string) {
    setReportId(id);
    navigate("reports");
  }
  if (boot)
    return (
      <div className="boot-screen">
        <Brand />
        <Spinner text="正在打开你的研究空间…" />
      </div>
    );
  if (!user)
    return error ? (
      <div className="boot-screen">
        <Brand />
        <ErrorBanner message={error} />
        <button className="button secondary" onClick={() => location.reload()}>
          重新连接
        </button>
      </div>
    ) : (
      <AuthScreen
        setupRequired={setup}
        onAuthenticated={(u) => {
          setUser(u);
          setSetup(false);
        }}
      />
    );
  return (
    <div className="app-shell">
      {sidebar && (
        <div className="sidebar-scrim" onClick={() => setSidebar(false)} />
      )}
      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Brand small />
          <button
            className="icon-button mobile-only"
            aria-label="收起导航"
            onClick={() => setSidebar(false)}
          >
            <PanelLeftClose size={19} />
          </button>
        </div>
        <div className="workspace-label">
          你的工作空间 <span>PERSONAL</span>
        </div>
        <div className="project-switcher">
          <FolderOpen size={18} />
          <select
            aria-label="当前项目"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setReportId(null);
            }}
          >
            {!projects.length && <option value="">尚未创建项目</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <ChevronsUpDown size={14} />
        </div>
        <button className="new-project" onClick={() => setNewProject(true)}>
          <Plus size={15} />
          新建项目
        </button>
        <div className="nav-label">研究工作台</div>
        <nav aria-label="主导航">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.id === "library" && documents.length > 0 ? (
                <small>{documents.length}</small>
              ) : item.id === "research" &&
                tasks.some((t) => t.status === "running") ? (
                <span className="live-dot" />
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="note-orbit">
            <Network size={18} />
          </div>
          <strong>研究，由你定义</strong>
          <p>
            规划、检索、自评估。
            <br />
            每一步，都有迹可循。
          </p>
          <button onClick={() => navigate("research")}>
            了解研究流程 <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button
            className={`nav-item ${page === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
          >
            <Settings size={18} />
            <span>系统设置</span>
          </button>
          {user.role === "admin" && (
            <button
              className={`nav-item ${page === "admin" ? "active" : ""}`}
              onClick={() => navigate("admin")}
            >
              <Users size={18} />
              <span>用户管理</span>
              <small>管理</small>
            </button>
          )}
          <div className="user-panel">
            <span className="avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>
                {user.role === "admin" ? "工作台管理员" : "研究成员"}
              </small>
            </div>
            <button
              className="icon-button"
              aria-label="退出登录"
              title="退出登录"
              onClick={logout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main-workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              aria-label="展开导航"
              onClick={() => setSidebar(true)}
            >
              <Menu size={20} />
            </button>
            <span>工作空间</span>
            <span className="slash">/</span>
            <strong>{titles[page]}</strong>
          </div>
          <div className="topbar-actions">
            <span className="connection">
              <span />
              工作台已连接
            </span>
            <span className="topbar-divider" />
            <button
              className="icon-button"
              title="运行能力与配置"
              aria-label="运行能力与配置"
              onClick={() => navigate("settings")}
            >
              <CircleHelp size={19} />
            </button>
            <span className="avatar small">{user.name.slice(0, 1)}</span>
          </div>
        </header>
        <div className="workspace-content">
          <ErrorBanner message={error} />
          {!active && !["settings", "admin"].includes(page) ? (
            <div className="welcome-empty">
              <span className="eyebrow">YOUR NEXT IDEA STARTS HERE</span>
              <h1>
                你好，{user.name}。<br />
                从一个值得研究的问题开始。
              </h1>
              <p>创建项目，把资料、研究过程和报告放在同一个空间。</p>
              <button
                className="button primary"
                onClick={() => setNewProject(true)}
              >
                <Plus size={18} />
                创建第一个项目
              </button>
              <div className="welcome-flow">
                <div>
                  <Library size={24} />
                  <strong>汇集资料</strong>
                  <p>PDF、Word、Markdown</p>
                </div>
                <div>
                  <Network size={24} />
                  <strong>自主研究</strong>
                  <p>检索、判断、补充证据</p>
                </div>
                <div>
                  <CheckCircle2 size={24} />
                  <strong>形成报告</strong>
                  <p>每个关键结论有据可循</p>
                </div>
              </div>
            </div>
          ) : dataLoading && !["settings", "admin"].includes(page) ? (
            <Spinner />
          ) : page === "overview" ? (
            <Overview
              project={active!}
              user={user}
              documents={documents}
              tasks={tasks}
              capabilities={caps}
              navigate={navigate}
              viewReport={viewReport}
            />
          ) : page === "library" ? (
            <LibraryPage
              projectId={projectId}
              documents={documents}
              onChange={reload}
            />
          ) : page === "research" ? (
            <ResearchPage
              projectId={projectId}
              tasks={tasks}
              capabilities={caps}
              onChange={reload}
              viewReport={viewReport}
            />
          ) : page === "reports" ? (
            <ReportsPage
              projectId={projectId}
              tasks={tasks}
              requestedReportId={reportId}
              onResearch={() => navigate("research")}
            />
          ) : page === "settings" ? (
            <SettingsPage user={user} capabilities={caps} onChange={reload} />
          ) : (
            <AdminPage currentUser={user} />
          )}
        </div>
        <footer className="workspace-footer">
          <span>研序 · 从资料到洞见</span>
          <span>
            有据可循，有序生长 <span className="footer-dot" />
          </span>
        </footer>
      </main>
      {newProject && (
        <NewProjectDialog
          onClose={() => setNewProject(false)}
          onCreated={(p) => {
            setProjects((previous) => [p, ...previous]);
            setProjectId(p.id);
            setNewProject(false);
            setPage("overview");
          }}
        />
      )}
    </div>
  );
}
