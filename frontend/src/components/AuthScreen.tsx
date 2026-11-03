import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  ShieldCheck,
  Network,
  Quote,
  BookOpen,
} from "lucide-react";
import { post, errorText } from "../api";
import type { User } from "../types";
import { Brand, ErrorBanner } from "./Shared";

export function AuthScreen({
  setupRequired,
  onAuthenticated,
}: {
  setupRequired: boolean;
  onAuthenticated: (user: User) => void;
}) {
  const [register, setRegister] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      onAuthenticated(
        await post<User>(
          setupRequired
            ? "/auth/setup"
            : register
              ? "/auth/register"
              : "/auth/login",
          { email, password, ...(setupRequired || register ? { name } : {}) },
        ),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-main">
          <span className="eyebrow">LESS SEARCHING. MORE UNDERSTANDING.</span>
          <h1>
            让资料有序，
            <br />
            让洞见有据<span>。</span>
          </h1>
          <p>
            把散落的文件，变成清晰的研究。
            <br />
            你的资料、证据与报告，在这里连接。
          </p>
          <div className="story-diagram">
            <div>
              <BookOpen size={21} />
              <span>多源资料</span>
            </div>
            <span className="connector" />
            <div className="featured">
              <Network size={23} />
              <span>自主研究</span>
            </div>
            <span className="connector" />
            <div>
              <Quote size={21} />
              <span>有据报告</span>
            </div>
          </div>
          <div className="story-features">
            <span>
              <Check size={14} /> 中英文资料
            </span>
            <span>
              <Check size={14} /> 自主补检索
            </span>
            <span>
              <Check size={14} /> 引用可追溯
            </span>
          </div>
        </div>
        <footer>
          研序 RESEARCH WORKSPACE <span>资料不止被存储，更被理解。</span>
        </footer>
      </section>
      <section className="auth-form-area">
        <div className="auth-card">
          <span className="pill">
            <ShieldCheck size={14} />
            {setupRequired ? "首次使用 · 初始化工作台" : "你的个人研究空间"}
          </span>
          <h2>
            {setupRequired
              ? "开启你的研究工作台"
              : register
                ? "创建研究账号"
                : "欢迎回到研序"}
          </h2>
          <p>
            {setupRequired
              ? "创建首个管理员账号，随后即可邀请其他用户注册。"
              : register
                ? "各用户的资料与研究成果独立保存。"
                : "登录后，继续从资料中发现有价值的连接。"}
          </p>
          <form onSubmit={submit}>
            {(setupRequired || register) && (
              <label>
                你的名字
                <input
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="怎么称呼你"
                  maxLength={80}
                />
              </label>
            )}
            <label>
              邮箱
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label>
              密码
              <input
                type="password"
                autoComplete={
                  setupRequired || register
                    ? "new-password"
                    : "current-password"
                }
                required
                minLength={10}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 10 个字符"
              />
            </label>
            <ErrorBanner message={error} />
            <button className="button primary auth-submit" disabled={busy}>
              {busy
                ? "正在连接…"
                : setupRequired
                  ? "创建管理员，开始研究"
                  : register
                    ? "创建账号"
                    : "登录工作台"}
              <ArrowRight size={17} />
            </button>
          </form>
          {!setupRequired && (
            <p className="auth-switch">
              {register ? "已有账号？" : "第一次来？"}
              <button
                onClick={() => {
                  setRegister(!register);
                  setError("");
                }}
              >
                {register ? "直接登录" : "创建账号"}
              </button>
            </p>
          )}
          <div className="auth-note">
            <ShieldCheck size={15} />
            <span>独立项目空间 · 数据按账号隔离</span>
          </div>
        </div>
      </section>
    </div>
  );
}
