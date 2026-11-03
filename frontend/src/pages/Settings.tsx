import { useEffect, useState, type FormEvent } from "react";
import {
  Settings,
  ShieldCheck,
  Globe2,
  Cpu,
  KeyRound,
  CheckCircle2,
  Save,
  Users,
  Server,
  Info,
  Search,
  ArrowUpRight,
} from "lucide-react";
import { api, errorText, formatDate } from "../api";
import type { User, Capabilities, SystemSettings } from "../types";
import {
  SectionTitle,
  ErrorBanner,
  Spinner,
  Status,
} from "../components/Shared";

export function SettingsPage({
  user,
  capabilities,
  onChange,
}: {
  user: User;
  capabilities: Capabilities | null;
  onChange: () => void;
}) {
  const [settings, setSettings] = useState<SystemSettings | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    if (user.role === "admin")
      api<SystemSettings>("/admin/settings")
        .then(setSettings)
        .catch((e) => setError(errorText(e)));
  }, [user.role]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const { llm_configured, search_configured, ...body } = settings;
      setSettings(
        await api<SystemSettings>("/admin/settings", {
          method: "PUT",
          body: JSON.stringify(body),
        }),
      );
      setSaved(true);
      onChange();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow="YOUR WORKSPACE, YOUR WAY"
        title="让工具，适配你的研究。"
        description="查看运行能力与接入状态。模型和搜索服务独立配置，随项目持续演进。"
      />
      <ErrorBanner message={error} />
      <div className="capability-grid">
        {[
          {
            icon: Cpu,
            title: "语言模型",
            ready: capabilities?.llm_configured,
            yes: "语义研究已启用",
            no: "本地摘录模式",
          },
          {
            icon: Globe2,
            title: "联网检索",
            ready: capabilities?.search_configured,
            yes: "Tavily 已配置",
            no: "尚未配置搜索密钥",
          },
          {
            icon: Search,
            title: "资料检索",
            ready: true,
            yes:
              capabilities?.embedding_mode === "semantic_api"
                ? "语义向量 + 双语 BM25"
                : "词项向量 + 双语 BM25",
            no: "",
          },
        ].map((c) => (
          <div className="panel capability-card" key={c.title}>
            <span className="capability-icon">
              <c.icon size={23} />
            </span>
            <h3>{c.title}</h3>
            <span className={`cap-state ${c.ready ? "configured" : ""}`}>
              <span />
              {c.ready ? c.yes : c.no}
            </span>
          </div>
        ))}
      </div>
      <div className="settings-layout">
        {user.role === "admin" ? (
          <section className="panel settings-form">
            <div className="panel-heading">
              <div>
                <h2>
                  <Cpu size={19} />
                  模型与搜索配置
                </h2>
                <span>兼容 OpenAI 协议，可替换云端或本地模型服务</span>
              </div>
              <span className="pill neutral">管理员</span>
            </div>
            {!settings ? (
              <Spinner />
            ) : (
              <form onSubmit={save}>
                <label>
                  模型 API 地址
                  <input
                    type="url"
                    required
                    value={settings.llm_base_url}
                    onChange={(e) =>
                      setSettings({ ...settings, llm_base_url: e.target.value })
                    }
                    placeholder="https://api.openai.com/v1"
                  />
                  <small>请填写可信的兼容接口；密钥会发送至此地址。</small>
                </label>
                <label>
                  模型名称
                  <input
                    required
                    value={settings.llm_model}
                    onChange={(e) =>
                      setSettings({ ...settings, llm_model: e.target.value })
                    }
                  />
                </label>
                <label>
                  Embedding 模型
                  <input
                    readOnly
                    value={
                      settings.embedding_model || "本地词项向量（无需模型下载）"
                    }
                  />
                  <small>
                    更换 embedding 请修改 .env 并重启服务，系统将建立独立索引。
                  </small>
                </label>
                <div className="form-grid">
                  <label>
                    搜索服务
                    <select
                      value={settings.search_provider}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          search_provider: e.target.value,
                        })
                      }
                    >
                      <option value="tavily">Tavily Search</option>
                    </select>
                  </label>
                  <label>
                    每次搜索结果数
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={settings.search_max_results}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          search_max_results: +e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  单文件上传上限（MB）
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={settings.max_upload_mb}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        max_upload_mb: +e.target.value,
                      })
                    }
                  />
                </label>
                <div className="settings-save">
                  {saved && (
                    <span className="saved-message">
                      <CheckCircle2 size={15} />
                      设置已保存，对新任务生效
                    </span>
                  )}
                  <button className="button primary" disabled={busy}>
                    <Save size={16} />
                    {busy ? "保存中…" : "保存配置"}
                  </button>
                </div>
              </form>
            )}
          </section>
        ) : (
          <section className="panel member-settings">
            <ShieldCheck size={32} />
            <h2>运行配置由管理员维护</h2>
            <p>
              你可以在创建任务时选择报告语言、研究类型与检索预算。
              <br />
              需要启用模型或联网搜索时，请联系工作台管理员。
            </p>
            <div className="account-details">
              <span>当前账号</span>
              <strong>{user.email}</strong>
              <span>账户角色</span>
              <strong>研究成员</strong>
            </div>
          </section>
        )}
        <aside className="settings-aside">
          <section className="panel secret-guide">
            <span className="guide-icon">
              <KeyRound size={23} />
            </span>
            <h3>密钥，留在服务端。</h3>
            <p>
              API 密钥通过项目根目录的 <code>.env</code>{" "}
              文件配置，不在浏览器中保存或显示。更新密钥后需重启后端。
            </p>
            <div className="env-example">
              <span># 语义规划与报告写作</span>
              <code>LLM_API_KEY=…</code>
              <span># 实际联网搜索</span>
              <code>TAVILY_API_KEY=…</code>
            </div>
            <div className="guide-note">
              <Info size={16} />
              <p>
                缺少密钥时不会模拟成功。联网任务需要搜索密钥；本地摘录可在没有模型时运行。
              </p>
            </div>
          </section>
          <section className="panel architecture-note">
            <Server size={20} />
            <h3>为持续开发留好接口</h3>
            <p>
              资料解析、检索、模型与搜索服务彼此独立。开发默认 SQLite +
              Chroma，可配置 PostgreSQL。
            </p>
            <span>单进程任务执行 · 事件持久保存</span>
          </section>
        </aside>
      </div>
    </>
  );
}

export function AdminPage({ currentUser }: { currentUser: User }) {
  const [users, setUsers] = useState<User[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api<User[]>("/admin/users")
      .then((u) => {
        if (alive) setUsers(u);
      })
      .catch((e) => {
        if (alive) setError(errorText(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  async function update(user: User, body: Partial<User>) {
    setBusy(user.id);
    setError("");
    try {
      const updated = await api<User>(`/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setUsers((previous) =>
        previous.map((u) => (u.id === updated.id ? updated : u)),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow="A WORKSPACE FOR EVERY RESEARCHER"
        title="管理成员，守好边界。"
        description="维护账号角色与使用状态。成员的项目与资料保持独立，管理员不隐式读取原文。"
      />
      <ErrorBanner message={error} />
      <div className="admin-stats">
        <div>
          <Users size={23} />
          <strong>{users.length}</strong>
          <span>全部用户</span>
        </div>
        <div>
          <ShieldCheck size={23} />
          <strong>{users.filter((u) => u.role === "admin").length}</strong>
          <span>管理员</span>
        </div>
        <div>
          <CheckCircle2 size={23} />
          <strong>{users.filter((u) => u.is_active).length}</strong>
          <span>有效账号</span>
        </div>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>工作台成员</h2>
          <span className="pill neutral">最后一位管理员受到保护</span>
        </div>
        {loading ? (
          <Spinner />
        ) : (
          <div className="users-table">
            <div className="users-head">
              <span>成员</span>
              <span>角色</span>
              <span>加入时间</span>
              <span>状态</span>
              <span>操作</span>
            </div>
            {users.map((u) => (
              <div className="users-row" key={u.id}>
                <div className="member-cell">
                  <span className="avatar">{u.name.slice(0, 1)}</span>
                  <span>
                    <strong>
                      {u.name}
                      {u.id === currentUser.id && <small>你</small>}
                    </strong>
                    <small>{u.email}</small>
                  </span>
                </div>
                <select
                  aria-label={`${u.name}的角色`}
                  value={u.role}
                  disabled={busy === u.id}
                  onChange={(e) =>
                    update(u, { role: e.target.value as "admin" | "member" })
                  }
                >
                  <option value="member">研究成员</option>
                  <option value="admin">管理员</option>
                </select>
                <span>{formatDate(u.created_at)}</span>
                <span
                  className={`status ${u.is_active ? "ready" : "cancelled"}`}
                >
                  {u.is_active ? "正常" : "已停用"}
                </span>
                <button
                  className={`button compact ${u.is_active ? "secondary" : "primary"}`}
                  disabled={busy === u.id}
                  onClick={() => {
                    if (
                      window.confirm(
                        `${u.is_active ? "停用" : "启用"}账号 ${u.name}？`,
                      )
                    )
                      update(u, { is_active: !u.is_active });
                  }}
                >
                  {busy === u.id ? "处理中…" : u.is_active ? "停用" : "启用"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
