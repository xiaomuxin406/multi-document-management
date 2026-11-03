import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import {
  X,
  LoaderCircle,
  ArrowUpRight,
  Layers,
  AlertCircle,
  Check,
} from "lucide-react";

export function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? "small" : ""}`}>
      <span className="brand-mark">
        <Layers size={24} />
      </span>
      <span>
        <strong>
          研序<span className="brand-dot">.</span>
        </strong>
        <small>RESEARCH WORKSPACE</small>
      </span>
    </div>
  );
}
export function Spinner({ text = "正在加载…" }: { text?: string }) {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={19} />
      <span>{text}</span>
    </div>
  );
}
export function ErrorBanner({ message }: { message: string }) {
  return message ? (
    <div className="error-banner" role="alert">
      <AlertCircle size={17} />
      {message}
    </div>
  ) : null;
}
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  const initialFocus = useRef<HTMLElement | null>(null);
  const closeHandler = useRef(onClose);
  useLayoutEffect(() => {
    closeHandler.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = previousFocus.current;
    const element = ref.current;
    // Preserve a child's autoFocus; polling must never reset editing focus.
    if (element?.contains(document.activeElement)) {
      initialFocus.current = document.activeElement as HTMLElement;
    } else {
      // StrictMode replays setup after cleanup restores the opener's focus.
      (initialFocus.current || element)?.focus();
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHandler.current();
      if (e.key === "Tab" && element) {
        const items = Array.from(
          element.querySelectorAll<HTMLElement>(
            "button,input,select,textarea,a[href]",
          ),
        ).filter((e) => !(e as HTMLInputElement).disabled);
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={21} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
const labels: Record<string, string> = {
  ready: "已入库",
  failed: "失败",
  queued: "等待中",
  running: "研究中",
  completed: "已完成",
  cancelled: "已取消",
};
export function Status({ value }: { value: string }) {
  return (
    <span className={`status ${value}`}>
      {value === "running" ? (
        <span className="live-dot" />
      ) : value === "completed" || value === "ready" ? (
        <Check size={12} />
      ) : null}
      {labels[value] || value}
    </span>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}
