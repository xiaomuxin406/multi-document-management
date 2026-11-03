import { useState, type FormEvent } from "react";
import { FolderPlus, ArrowRight } from "lucide-react";
import { post, errorText } from "../api";
import type { Project } from "../types";
import { Modal, ErrorBanner } from "./Shared";

export function NewProjectDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      onCreated(await post<Project>("/projects", { name, description }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="为一个新问题，留出空间"
      subtitle="项目将资料、研究任务和报告关联在一起。"
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="project-symbol">
          <FolderPlus size={28} />
        </div>
        <label>
          项目名称
          <input
            autoFocus
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：Agentic-RAG 技术调研"
          />
        </label>
        <label>
          项目描述 <span className="optional">选填</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="记录研究方向、目标或背景…"
            maxLength={2000}
          />
        </label>
        <ErrorBanner message={error} />
        <footer className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            取消
          </button>
          <button className="button primary" disabled={busy || !name.trim()}>
            {busy ? "创建中…" : "创建项目"}
            <ArrowRight size={16} />
          </button>
        </footer>
      </form>
    </Modal>
  );
}
