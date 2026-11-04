"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Ctx } from "./actions";
import type { AppState } from "./types";
import type { User } from "./auth-types";
interface Toast {
  id: number;
  msg: string;
  ch?: string;
}
interface Store {
  S: AppState;
  user: User | null;
  rev: number;
  act: <T>(fn: (c: Ctx) => T) => T;
  toast: (msg: string, ch?: string) => void;
  reset: () => void;
  resets: number;
  drawer: ReactNode;
  openDrawer: (n: ReactNode) => void;
  closeDrawer: () => void;
  refresh: () => Promise<void>;
}
interface Snapshot {
  S: AppState;
  user: User | null;
  rev: number;
  saving: boolean;
  error: string;
}
function createEngine() {
  let snapshot: Snapshot | null = null,
    revision = -1,
    pending = 0,
    queue = Promise.resolve(),
    blocked = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());
  async function refresh() {
    const r = await fetch("/api/state", { cache: "no-store" });
    if (!r.ok) {
      const problem = await r.json().catch(() => ({}));
      throw Error(problem.error || "Connexion au serveur indisponible.");
    }
    const data = await r.json();
    if (!pending) {
      const S =
        revision === data.revision &&
        snapshot &&
        snapshot.user?.id === data.user?.id &&
        snapshot.user?.role === data.user?.role
          ? snapshot.S
          : data.S;
      revision = data.revision;
      snapshot = {
        S,
        user: data.user,
        rev: (snapshot?.rev || 0) + 1,
        saving: false,
        error: snapshot?.error || "",
      };
      emit();
    }
  }
  function act<T>(fn: (c: Ctx) => T, toast: Store["toast"]): T {
    if (!snapshot || !snapshot.user || snapshot.user.role === "CLIENT")
      throw Error("Action réservée à l’équipe.");
    if (blocked) throw Error("Rechargez les données avant de continuer.");
    const out = fn({ S: snapshot.S, toast });
    const data = structuredClone(snapshot.S);
    pending++;
    snapshot = { ...snapshot, rev: snapshot.rev + 1, saving: true };
    emit();
    queue = queue.then(async () => {
      try {
        if (blocked) return;
        const r = await fetch("/api/state", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ S: data, revision }),
        });
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        revision = d.revision;
      } catch (e) {
        blocked = true;
        if (snapshot) {
          snapshot = {
            ...snapshot,
            error:
              e instanceof Error ? e.message : "Enregistrement impossible.",
          };
          emit();
        }
      } finally {
        pending--;
        if (!pending) {
          revision = -1;
          await refresh().catch(() => {});
          if (snapshot) {
            snapshot = { ...snapshot, saving: false };
            emit();
          }
        }
      }
    });
    return out;
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    refresh,
    act,
    async reload() {
      blocked = false;
      revision = -1;
      if (snapshot) snapshot = { ...snapshot, error: "" };
      await refresh();
    },
  };
}
const Context = createContext<Store | null>(null);
const serverSnapshot = () => null;
export function StoreProvider({ children }: { children: ReactNode }) {
  const [engine] = useState(createEngine),
    data = useSyncExternalStore(
      engine.subscribe,
      engine.getSnapshot,
      serverSnapshot,
    );
  const [error, setError] = useState(""),
    [toasts, setToasts] = useState<Toast[]>([]),
    [drawer, setDrawer] = useState<ReactNode>(null);
  const toast = useCallback((msg: string, ch?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, msg, ch }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  useEffect(() => {
    engine.refresh().catch((e) => setError(e.message));
    const t = setInterval(() => engine.refresh().catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [engine]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(null);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  const value: Store | null = data
    ? {
        S: data.S,
        user: data.user,
        rev: data.rev,
        act: (fn) => engine.act(fn, toast),
        toast,
        reset: () =>
          toast(
            "La réinitialisation est désactivée pour protéger les données.",
          ),
        resets: 0,
        drawer,
        openDrawer: setDrawer,
        closeDrawer: () => setDrawer(null),
        refresh: engine.refresh,
      }
    : null;
  return (
    <Context.Provider value={value}>
      {(error || data?.error) && (
        <div className="save-error" role="alert">
          {error || data?.error}
          <button
            onClick={() => {
              setError("");
              engine.reload().catch((e) => setError(e.message));
            }}
          >
            Recharger les données
          </button>
        </div>
      )}
      {data?.saving && (
        <div className="save-status" role="status">
          Enregistrement…
        </div>
      )}
      {value ? (
        children
      ) : (
        <div className="wrap boot" role="status">
          <span className="spin" />
          Connexion à LIVREX…
        </div>
      )}
      {drawer && (
        <>
          <div className="drawer-bg" onClick={() => setDrawer(null)} />
          <aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Détails"
          >
            <button className="btn" onClick={() => setDrawer(null)}>
              Fermer
            </button>
            {drawer}
          </aside>
        </>
      )}
      <div id="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            {t.ch && <b>{t.ch}</b>}
            {t.msg}
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}
export function useStore() {
  const s = useContext(Context);
  if (!s) throw Error("Store indisponible");
  return s;
}
