"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Activity, CalendarPlus, Download, MoreHorizontal, Plus, QrCode, RefreshCw, Search, Trash2, UserRoundCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import type { ApiResponse, CheckIn, Client, DashboardData } from "@/lib/types";

function authHeaders(tokenOverride?: string) {
  const token =
    tokenOverride ?? (typeof window !== "undefined" ? window.localStorage.getItem("adminToken") : "");

  return {
    "Content-Type": "application/json",
    ...(token ? { "x-admin-token": token } : {})
  };
}

function normalizeAdminToken(value: string) {
  return value
    .trim()
    .replace(/^ADMIN_API_TOKEN=/, "")
    .trim()
    .replace(/^["'`]|["'`]$/g, "");
}

async function readApi<T>(url: string, init?: RequestInit, tokenOverride?: string) {
  const response = await fetch(url, {
    ...init,
    headers: { ...authHeaders(tokenOverride), ...(init?.headers ?? {}) }
  });
  const json = (await response.json()) as ApiResponse<T>;
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [selected, setSelected] = useState<Client | null>(null);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [editName, setEditName] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const load = async (tokenOverride?: string) => {
    try {
      setError("");
      setNotice("");
      const next = await readApi<DashboardData>("/api/dashboard", undefined, tokenOverride);
      setData(next);
      setSelected((current) => {
        const updated = current ? next.clients.find((client) => client.clientId === current.clientId) : null;
        setEditName((updated ?? next.clients[0])?.name ?? "");
        return updated ?? next.clients[0] ?? null;
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load dashboard");
    }
  };

  useEffect(() => {
    const saved = window.localStorage.getItem("adminToken") ?? "";
    setToken(saved);
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredClients = useMemo(() => {
    return (data?.clients ?? []).filter((client) => client.name.toLowerCase().includes(query.toLowerCase()));
  }, [data?.clients, query]);

  const selectedHistory = useMemo(() => {
    if (!selected) return [];
    return (data?.checkIns ?? []).filter((entry) => entry.clientId === selected.clientId);
  }, [data?.checkIns, selected]);

  const createClient = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      setError("");
      setNotice("");
      await readApi("/api/create-client", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() })
      });
      setNotice(`${newName.trim()} was created.`);
      setNewName("");
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to create client");
    } finally {
      setBusy(false);
    }
  };

  const mutateClient = async (clientId: string, updates: Partial<Pick<Client, "name" | "status">>) => {
    setBusy(true);
    try {
      await readApi("/api/client", {
        method: "PATCH",
        body: JSON.stringify({ clientId, ...updates })
      });
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to update client");
    } finally {
      setBusy(false);
    }
  };

  const deleteClient = async (clientId: string) => {
    setBusy(true);
    try {
      await readApi(`/api/client?clientId=${encodeURIComponent(clientId)}`, { method: "DELETE" });
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to delete client");
    } finally {
      setBusy(false);
    }
  };

  const manualEntry = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await readApi("/api/manual-entry", {
        method: "POST",
        body: JSON.stringify({ clientId: selected.clientId })
      });
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to add manual entry");
    } finally {
      setBusy(false);
    }
  };

  const saveToken = async () => {
    const normalizedToken = normalizeAdminToken(token);
    setToken(normalizedToken);
    window.localStorage.setItem("adminToken", normalizedToken);
    setUnlocking(true);
    try {
      await load(normalizedToken);
    } finally {
      setUnlocking(false);
    }
  };

  const unauthorized = error.toLowerCase() === "unauthorized";
  const isUnlocked = Boolean(data) && !unauthorized;

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-line/80 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-brand">Trainer Attendance</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Session command center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Manage clients, QR codes, and attendance history from one focused workspace.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input aria-label="Admin token" placeholder="Admin token" value={token} onChange={(event) => setToken(event.target.value)} />
            <Button variant="ghost" onClick={saveToken}>Save token</Button>
            <Button variant="ghost" onClick={() => load()}><RefreshCw className="h-4 w-4" />Refresh</Button>
          </div>
        </header>

        {unauthorized && (
          <Card className="mt-6 p-5">
            <h2 className="text-lg font-semibold text-ink">Admin access required</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Paste the exact admin token from `.env.local`, then save it. Restart the dev server after changing
              `.env.local` so Next.js can read the new value.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input aria-label="Admin token" placeholder="Admin token" value={token} onChange={(event) => setToken(event.target.value)} />
              <Button disabled={unlocking || !token.trim()} onClick={saveToken}>
                {unlocking ? "Unlocking..." : "Unlock dashboard"}
              </Button>
            </div>
          </Card>
        )}

        {error && !unauthorized && (
          <div className="mt-5 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">{error}</div>
        )}

        {notice && (
          <div className="mt-5 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-100">{notice}</div>
        )}

        {!isUnlocked && !error && (
          <Card className="mt-6 p-5 text-sm text-slate-500">Loading dashboard...</Card>
        )}

        {isUnlocked && (
        <>
        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <Stat icon={<Activity />} label="Check-ins today" value={data?.stats.totalToday ?? 0} />
          <Stat icon={<UserRoundCheck />} label="Active clients" value={data?.stats.activeClients ?? 0} />
          <Stat icon={<CalendarPlus />} label="Weekly attendance" value={`${data?.stats.weeklyAttendancePercent ?? 0}%`} />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[390px_1fr]">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Clients</h2>
              <span className="text-sm text-slate-500">{filteredClients.length}</span>
            </div>
            <div className="mt-4 flex gap-2">
              <Input placeholder="Add client name" value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && createClient()} />
              <Button aria-label="Add client" disabled={busy || !newName.trim()} onClick={createClient}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-md bg-cloud px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Search clients" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div className="mt-4 space-y-2">
              {filteredClients.map((client) => (
                <button
                  key={client.clientId}
                  onClick={() => {
                    setSelected(client);
                    setEditName(client.name);
                  }}
                  className={`w-full rounded-md px-3 py-3 text-left transition ${selected?.clientId === client.clientId ? "bg-blue-50 ring-1 ring-blue-100" : "hover:bg-cloud"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{client.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{client.clientId}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${client.status === "active" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                      {client.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <Card className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Live check-ins</h2>
                  <p className="mt-1 text-sm text-slate-500">Refreshes every 15 seconds.</p>
                </div>
                <Button variant="ghost" disabled={!selected || busy} onClick={manualEntry}><CalendarPlus className="h-4 w-4" />Manual entry</Button>
              </div>
              <div className="mt-5 space-y-3">
                <AnimatePresence initial={false}>
                  {(data?.checkIns ?? []).slice(0, 10).map((entry) => (
                    <motion.div
                      key={`${entry.clientId}-${entry.timestamp}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-between rounded-md bg-cloud px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-ink">{entry.name}</p>
                        <p className="text-xs text-slate-500">{entry.date}{entry.manualOverride ? " · manual" : ""}</p>
                      </div>
                      <p className="text-sm font-medium text-slate-700">{new Date(entry.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </Card>

            <ClientDetail
              client={selected}
              history={selectedHistory}
              busy={busy}
              editName={editName}
              setEditName={setEditName}
              onSaveName={() => selected && mutateClient(selected.clientId, { name: editName.trim() })}
              onStatus={(clientId, status) => mutateClient(clientId, { status })}
              onDelete={deleteClient}
            />
          </div>
        </section>
        </>
        )}
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-brand [&_svg]:h-5 [&_svg]:w-5">{icon}</div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function ClientDetail({
  client,
  history,
  busy,
  editName,
  setEditName,
  onSaveName,
  onStatus,
  onDelete
}: {
  client: Client | null;
  history: CheckIn[];
  busy: boolean;
  editName: string;
  setEditName: (value: string) => void;
  onSaveName: () => void;
  onStatus: (clientId: string, status: Client["status"]) => void;
  onDelete: (clientId: string) => void;
}) {
  if (!client) {
    return <Card className="grid min-h-80 place-items-center p-6 text-center text-sm text-slate-500">Select or create a client.</Card>;
  }

  const downloadQr = async () => {
    const data = await readApi<{ qrCode: string }>("/api/qr", {
      method: "POST",
      body: JSON.stringify({ clientId: client.clientId })
    });
    const link = document.createElement("a");
    link.href = data.qrCode;
    link.download = `${client.name.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
    link.click();
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">{client.name}</h2>
          <p className="mt-1 text-xs text-slate-500">{client.qrUrl}</p>
        </div>
        <MoreHorizontal className="h-5 w-5 text-slate-400" />
      </div>
      <div className="mt-5 grid gap-2">
        <div className="flex gap-2">
          <Input aria-label="Client name" value={editName} onChange={(event) => setEditName(event.target.value)} />
          <Button variant="ghost" disabled={busy || !editName.trim() || editName.trim() === client.name} onClick={onSaveName}>Save</Button>
        </div>
        <Button variant="ghost" onClick={downloadQr}><Download className="h-4 w-4" />Download QR</Button>
        <Button variant="ghost" onClick={() => onStatus(client.clientId, client.status === "active" ? "disabled" : "active")} disabled={busy}>
          <QrCode className="h-4 w-4" />{client.status === "active" ? "Disable QR" : "Enable QR"}
        </Button>
        <Button variant="danger" onClick={() => onDelete(client.clientId)} disabled={busy}><Trash2 className="h-4 w-4" />Delete client</Button>
      </div>
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-ink">Attendance history</h3>
        <div className="mt-3 max-h-80 space-y-2 overflow-auto pr-1">
          {history.length === 0 && <p className="text-sm text-slate-500">No sessions recorded yet.</p>}
          {history.map((entry) => (
            <div key={`${entry.timestamp}-${entry.manualOverride}`} className="rounded-md bg-cloud px-3 py-2">
              <p className="text-sm font-medium text-ink">{new Date(entry.timestamp).toLocaleString()}</p>
              <p className="text-xs text-slate-500">{entry.manualOverride ? "Manual session" : "QR check-in"}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
