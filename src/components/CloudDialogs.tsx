import { Cloud, Download, FolderOpen, KeyRound, Mail, RefreshCw, Save, Trash2, Upload, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { CloudProjectSummary, CloudUser } from "../data/cloudProjects";

interface CloudAuthDialogProps {
  user: CloudUser | null;
  onClose: () => void;
  onMagicLink: (email: string) => Promise<void>;
  onPasswordSignIn: (email: string, password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}

interface CloudProjectsDialogProps {
  projects: CloudProjectSummary[];
  loading: boolean;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
  onImportBackupToCloud: () => void;
  onOpen: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

interface CloudConflictDialogProps {
  onClose: () => void;
  onExportBackup: () => void;
  onReloadRemote: () => Promise<void>;
  onSaveCopy: () => Promise<void>;
}

export function CloudAuthDialog({
  user,
  onClose,
  onMagicLink,
  onPasswordSignIn,
  onSignOut
}: CloudAuthDialogProps) {
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useDialogEscape(onClose);

  async function handlePasswordSignIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      await onPasswordSignIn(email, password);
      onClose();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleMagicLink() {
    setBusy(true);
    setMessage("");

    try {
      await onMagicLink(email);
      setMessage("Magic link sent. Check your email to finish signing in.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    setMessage("");

    try {
      await onSignOut();
      onClose();
    } catch (error) {
      setMessage((error as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="cloud-dialog" role="dialog" aria-modal="true" aria-labelledby="cloud-auth-title">
        <DialogHeader eyebrow="Supabase" title={user ? "Cloud Account" : "Sign In"} onClose={onClose} />
        <div className="cloud-dialog__body">
          {user ? (
            <div className="cloud-stack">
              <div className="cloud-account">
                <Cloud aria-hidden="true" />
                <div>
                  <strong>{user.email ?? "Signed in"}</strong>
                  <span>{user.id}</span>
                </div>
              </div>
              <button type="button" className="text-tool-button danger" disabled={busy} onClick={() => void handleSignOut()}>
                <X aria-hidden="true" />
                Sign Out
              </button>
            </div>
          ) : (
            <form className="cloud-stack" onSubmit={(event) => void handlePasswordSignIn(event)}>
              <label className="field-stack">
                Email
                <input
                  aria-label="Cloud email"
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className="field-stack">
                Password
                <input
                  aria-label="Cloud password"
                  autoComplete="current-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <div className="cloud-actions">
                <button type="submit" className="primary-action" disabled={busy || !email.trim() || !password.trim()}>
                  <KeyRound aria-hidden="true" />
                  Sign In
                </button>
                <button
                  type="button"
                  className="text-tool-button"
                  disabled={busy || !email.trim()}
                  onClick={() => void handleMagicLink()}
                >
                  <Mail aria-hidden="true" />
                  Send Magic Link
                </button>
              </div>
            </form>
          )}
          {message ? <p className="cloud-message">{message}</p> : null}
        </div>
      </section>
    </div>
  );
}

export function CloudProjectsDialog({
  projects,
  loading,
  onClose,
  onDelete,
  onImportBackupToCloud,
  onOpen,
  onRefresh
}: CloudProjectsDialogProps) {
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useDialogEscape(onClose);

  async function runProjectAction(id: string, action: (id: string) => Promise<void>) {
    setBusyProjectId(id);
    setMessage("");

    try {
      await action(id);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusyProjectId(null);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="cloud-dialog cloud-dialog--wide" role="dialog" aria-modal="true" aria-labelledby="cloud-projects-title">
        <DialogHeader eyebrow="Supabase" title="Cloud Projects" onClose={onClose} />
        <div className="cloud-dialog__body">
          <div className="cloud-actions">
            <button type="button" className="text-tool-button" disabled={loading} onClick={() => void onRefresh()}>
              <RefreshCw aria-hidden="true" />
              Refresh
            </button>
            <button type="button" className="text-tool-button" onClick={onImportBackupToCloud}>
              <Upload aria-hidden="true" />
              Import Backup to Cloud
            </button>
          </div>
          {projects.length ? (
            <div className="cloud-project-list">
              {projects.map((project) => (
                <article key={project.id} className="cloud-project-row">
                  <div>
                    <strong>{project.title}</strong>
                    <span>
                      {project.projectMode === "game_story" ? "Game Story" : "Story"} · v{project.version} ·{" "}
                      {new Date(project.updatedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="cloud-project-row__actions">
                    <button
                      type="button"
                      className="text-tool-button"
                      disabled={busyProjectId === project.id}
                      onClick={() => void runProjectAction(project.id, onOpen)}
                    >
                      <FolderOpen aria-hidden="true" />
                      Open
                    </button>
                    <button
                      type="button"
                      className="text-tool-button danger"
                      disabled={busyProjectId === project.id}
                      onClick={() => void runProjectAction(project.id, onDelete)}
                    >
                      <Trash2 aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="cloud-empty">{loading ? "Loading cloud projects..." : "No cloud projects yet."}</p>
          )}
          {message ? <p className="cloud-message">{message}</p> : null}
        </div>
      </section>
    </div>
  );
}

export function CloudConflictDialog({ onClose, onExportBackup, onReloadRemote, onSaveCopy }: CloudConflictDialogProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useDialogEscape(onClose);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");

    try {
      await action();
      onClose();
    } catch (error) {
      setMessage((error as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="cloud-dialog" role="dialog" aria-modal="true" aria-labelledby="cloud-conflict-title">
        <DialogHeader eyebrow="Cloud Save" title="Version Conflict" onClose={onClose} />
        <div className="cloud-dialog__body">
          <p className="cloud-message">
            This cloud project changed somewhere else. Choose how to protect your current work.
          </p>
          <div className="cloud-actions">
            <button type="button" className="primary-action" disabled={busy} onClick={() => void run(onReloadRemote)}>
              <RefreshCw aria-hidden="true" />
              Reload Remote
            </button>
            <button type="button" className="text-tool-button" disabled={busy} onClick={() => void run(onSaveCopy)}>
              <Save aria-hidden="true" />
              Save Copy
            </button>
            <button
              type="button"
              className="text-tool-button"
              disabled={busy}
              onClick={() => {
                onExportBackup();
                onClose();
              }}
            >
              <Download aria-hidden="true" />
              Export Backup
            </button>
          </div>
          {message ? <p className="cloud-message">{message}</p> : null}
        </div>
      </section>
    </div>
  );
}

function DialogHeader({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) {
  return (
    <header className="guide-dialog__header">
      <div>
        <p>{eyebrow}</p>
        <h2 id={title === "Cloud Projects" ? "cloud-projects-title" : title === "Version Conflict" ? "cloud-conflict-title" : "cloud-auth-title"}>
          {title}
        </h2>
      </div>
      <button type="button" className="icon-button" aria-label={`Close ${title}`} onClick={onClose}>
        <X aria-hidden="true" />
      </button>
    </header>
  );
}

function useDialogEscape(onClose: () => void) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
}
