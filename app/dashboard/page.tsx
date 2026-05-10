"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  CalendarDays,
  CalendarPlus,
  Clock3,
  Download,
  Fingerprint,
  MoreHorizontal,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Trash2,
  UserRoundCheck,
  X
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import type { ApiResponse, CheckIn, CheckInType, Client, DashboardData } from "@/lib/types";

const MANUAL_TYPES: Array<{ value: Exclude<CheckInType, "qr_checkin">; label: string }> = [
  { value: "manual_session", label: "Completed session" },
  { value: "late_cancel", label: "Late cancel" },
  { value: "no_show", label: "No show" }
];

function entryTypeLabel(type: CheckInType) {
  return MANUAL_TYPES.find((item) => item.value === type)?.label ?? "QR check-in";
}

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

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function dateInputValue(value = new Date()) {
  return `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(value.getDate())}`;
}

function timeInputValue(value = new Date()) {
  return `${padDatePart(value.getHours())}:${padDatePart(value.getMinutes())}`;
}

function localDateTimeToIso(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  const date = new Date(year, month - 1, day, hours, minutes);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Choose a valid date and time.");
  }

  return date.toISOString();
}

function StatusRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-slate-300 [&_svg]:h-4 [&_svg]:w-4">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [selected, setSelected] = useState<Client | null>(null);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [editName, setEditName] = useState("");
  const [editTotalSessions, setEditTotalSessions] = useState("0");
  const [editRemainingSessions, setEditRemainingSessions] = useState("0");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualDate, setManualDate] = useState(() => dateInputValue());
  const [manualTime, setManualTime] = useState(() => timeInputValue());
  const [manualType, setManualType] = useState<Exclude<CheckInType, "qr_checkin">>("manual_session");
  const [manualError, setManualError] = useState("");

  const load = async (tokenOverride?: string) => {
    try {
      setError("");
      setNotice("");
      const next = await readApi<DashboardData>("/api/dashboard", undefined, tokenOverride);
      setData(next);
      setLastUpdated(new Date().toISOString());
      setSelected((current) => {
        const updated = current ? next.clients.find((client) => client.clientId === current.clientId) : null;
        const nextSelected = updated ?? next.clients[0] ?? null;
        setEditName(nextSelected?.name ?? "");
        setEditTotalSessions(String(nextSelected?.totalSessions ?? 0));
        setEditRemainingSessions(String(nextSelected?.remainingSessions ?? 0));
        return nextSelected;
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

  useEffect(() => {
    if (!manualModalOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setManualModalOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [manualModalOpen, busy]);

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

  const mutateClient = async (clientId: string, updates: Partial<Pick<Client, "name" | "status" | "totalSessions" | "remainingSessions">>) => {
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

  const openManualEntry = () => {
    if (!selected) return;
    const now = new Date();
    setManualDate(dateInputValue(now));
    setManualTime(timeInputValue(now));
    setManualType("manual_session");
    setError("");
    setNotice("");
    setManualError("");
    setManualModalOpen(true);
  };

  const manualEntry = async (timestamp: string, type: Exclude<CheckInType, "qr_checkin">) => {
    if (!selected) return;
    setBusy(true);
    try {
      setError("");
      setNotice("");
      await readApi("/api/manual-entry", {
        method: "POST",
        body: JSON.stringify({ clientId: selected.clientId, timestamp, type })
      });
      setNotice(`${entryTypeLabel(type)} added for ${selected.name} at ${formatTime(timestamp)}.`);
      setManualError("");
      setManualModalOpen(false);
      await load();
    } catch (error) {
      setManualError(error instanceof Error ? error.message : "Unable to add manual entry");
    } finally {
      setBusy(false);
    }
  };

  const submitManualEntry = () => {
    try {
      if (!manualDate || !manualTime) {
        setManualError("Choose both a date and time for the manual session.");
        return;
      }

      const timestamp = localDateTimeToIso(manualDate, manualTime);
      if (new Date(timestamp).getTime() > Date.now()) {
        setManualError("Manual session time cannot be in the future.");
        return;
      }

      setManualError("");
      manualEntry(timestamp, manualType);
    } catch (error) {
      setManualError(error instanceof Error ? error.message : "Choose a valid date and time.");
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
    <main className="dashboard-main min-h-screen overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="dashboard-shell mx-auto flex max-w-7xl flex-col">
        <header className="shrink-0 overflow-hidden rounded-lg bg-black shadow-glass ring-1 ring-black">
          <div className="h-2 bg-red-600" />
          <div className="border-b border-white/10 bg-black px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 text-white md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                <span className="rounded-full bg-white px-3 py-1 text-black ring-1 ring-white">Trainer Attendance</span>
                <span className="rounded-full bg-[#C00000] px-3 py-1 text-white ring-1 ring-[#A00000]">Live Sheets Sync</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-white ring-1 ring-white/20">QR Auto Check-in</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input aria-label="Admin token" placeholder="Admin token" value={token} onChange={(event) => setToken(event.target.value)} />
                <Button variant="ghost" onClick={saveToken}>Save token</Button>
                <Button variant="ghost" onClick={() => load()}><RefreshCw className="h-4 w-4" />Refresh</Button>
              </div>
            </div>
          </div>

          <div className="relative px-5 py-8 text-white sm:px-6 lg:px-8">
            <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.1)_1px,transparent_1px)] [background-size:28px_28px]" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-full bg-gradient-to-t from-red-950/30 to-transparent" />
            <div className="relative grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-300">Premium trainer operations</p>
                <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                  Session command center
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  Manage QR access, daily arrivals, manual adjustments, and each client&apos;s complete attendance record
                  from one polished control room.
                </p>
              </div>
              <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur">
                <StatusRow icon={<ShieldCheck />} label="Admin security" value={token ? "Token configured" : "Token optional"} />
                <StatusRow icon={<TrendingUp />} label="Today performance" value={`${data?.stats.totalToday ?? 0} sessions`} />
                <StatusRow icon={<Clock3 />} label="Last refreshed" value={lastUpdated ? formatTime(lastUpdated) : "Waiting"} />
              </div>
            </div>
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
          <div className="mt-5 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">{notice}</div>
        )}

        {!isUnlocked && !error && (
          <Card className="mt-6 p-5 text-sm text-slate-500">Loading dashboard...</Card>
        )}

        {isUnlocked && (
          <>
            <section className="mt-6 shrink-0 grid gap-4 md:grid-cols-3">
              <Stat icon={<Activity />} label="Check-ins today" value={data?.stats.totalToday ?? 0} tone="red" />
              <Stat icon={<UserRoundCheck />} label="Active clients" value={data?.stats.activeClients ?? 0} tone="black" />
              <Stat icon={<CalendarPlus />} label="Weekly attendance" value={`${data?.stats.weeklyAttendancePercent ?? 0}%`} tone="white" />
            </section>

            <section className="dashboard-workspace mt-6 grid items-stretch gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
              <Card className="dashboard-panel flex min-h-0 flex-col overflow-hidden border-t-4 border-t-red-600">
                <div className="shrink-0 border-b border-line/80 bg-white px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-ink">Clients</h2>
                      <p className="mt-1 text-sm text-slate-500">Roster, QR access, and profile controls.</p>
                    </div>
                    <span className="rounded-full bg-black px-2.5 py-1 text-sm font-semibold text-white">{filteredClients.length}</span>
                  </div>
                </div>
                <div className="shrink-0 p-4">
                  <div className="flex gap-2">
                    <Input placeholder="Add client name" value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && createClient()} />
                    <Button aria-label="Add client" disabled={busy || !newName.trim()} onClick={createClient}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-md bg-cloud px-3 py-2 ring-1 ring-line/70">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Search clients" value={query} onChange={(event) => setQuery(event.target.value)} />
                  </div>
                </div>
                <div className="scroll-panel roster-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-5 pr-2">
                  {filteredClients.map((client) => (
                    <button
                      key={client.clientId}
                      onClick={() => {
                        setSelected(client);
                        setEditName(client.name);
                        setEditTotalSessions(String(client.totalSessions));
                        setEditRemainingSessions(String(client.remainingSessions));
                      }}
                      className={`w-full rounded-md px-3 py-3 text-left transition ${selected?.clientId === client.clientId ? "bg-black text-white shadow-sm ring-1 ring-black" : "bg-white ring-1 ring-transparent hover:bg-red-50 hover:ring-red-100"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-md text-xs font-semibold ring-1 ${selected?.clientId === client.clientId ? "bg-red-600 text-white ring-red-500" : "bg-white text-red-600 ring-line"}`}>
                            {initials(client.name)}
                          </div>
                          <div className="min-w-0">
                            <p className={`truncate font-medium ${selected?.clientId === client.clientId ? "text-white" : "text-ink"}`}>{client.name}</p>
                            <p className={`mt-1 truncate text-xs ${selected?.clientId === client.clientId ? "text-white/55" : "text-slate-500"}`}>{client.clientId}</p>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${selected?.clientId === client.clientId ? "bg-white/10 text-white ring-1 ring-white/15" : client.status === "active" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                          {client.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>

              <div className="grid min-h-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <LiveFeed entries={data?.checkIns ?? []} selected={selected} busy={busy} onManualEntry={openManualEntry} />
                <ClientDetail
                  client={selected}
                  history={selectedHistory}
                  busy={busy}
                  editName={editName}
                  setEditName={setEditName}
                  editTotalSessions={editTotalSessions}
                  setEditTotalSessions={setEditTotalSessions}
                  editRemainingSessions={editRemainingSessions}
                  setEditRemainingSessions={setEditRemainingSessions}
                  onSaveName={() => selected && mutateClient(selected.clientId, { name: editName.trim() })}
                  onSaveSessions={() => {
                    if (!selected) return;
                    mutateClient(selected.clientId, {
                      totalSessions: Number(editTotalSessions) || 0,
                      remainingSessions: Number(editRemainingSessions) || 0
                    });
                  }}
                  onStatus={(clientId, status) => mutateClient(clientId, { status })}
                  onDelete={deleteClient}
                />
              </div>
            </section>

            <ManualEntryDialog
              client={selected}
              open={manualModalOpen}
              busy={busy}
              date={manualDate}
              time={manualTime}
              type={manualType}
              error={manualError}
              maxDate={dateInputValue()}
              onDateChange={setManualDate}
              onTimeChange={setManualTime}
              onTypeChange={setManualType}
              onClose={() => !busy && setManualModalOpen(false)}
              onSubmit={submitManualEntry}
            />
          </>
        )}
      </div>
    </main>
  );
}

function ManualEntryDialog({
  client,
  open,
  busy,
  date,
  time,
  type,
  error,
  maxDate,
  onDateChange,
  onTimeChange,
  onTypeChange,
  onClose,
  onSubmit
}: {
  client: Client | null;
  open: boolean;
  busy: boolean;
  date: string;
  time: string;
  type: Exclude<CheckInType, "qr_checkin">;
  error: string;
  maxDate: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onTypeChange: (value: Exclude<CheckInType, "qr_checkin">) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!open || !client) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4 py-6 backdrop-blur-sm" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-entry-title"
        className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-black/10"
      >
        <div className="flex items-start justify-between gap-4 bg-black px-5 py-4 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-200">Manual check-in</p>
            <h2 id="manual-entry-title" className="mt-1 text-lg font-semibold">
              Add session time
            </h2>
            <p className="mt-1 text-sm text-white/60">{client.name}</p>
          </div>
          <button
            type="button"
            aria-label="Close manual entry dialog"
            className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white/10 text-white transition hover:bg-white/15 disabled:opacity-50"
            disabled={busy}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-md border-l-4 border-l-[#C00000] bg-red-50 px-3 py-3 ring-1 ring-red-100">
            <p className="text-sm font-medium text-ink">Choose the real session date and time.</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              This timestamp will be saved in the attendance stream and session history.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Entry type</span>
              <select
                className="focus-ring h-11 w-full rounded-md border border-line bg-white/95 px-3 text-sm shadow-sm transition hover:border-slate-300"
                value={type}
                onChange={(event) => onTypeChange(event.target.value as Exclude<CheckInType, "qr_checkin">)}
              >
                {MANUAL_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Date</span>
              <Input type="date" value={date} max={maxDate} onChange={(event) => onDateChange(event.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Time</span>
              <Input type="time" value={time} onChange={(event) => onTimeChange(event.target.value)} />
            </label>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" disabled={busy || !date || !time} onClick={onSubmit}>
              <CalendarPlus className="h-4 w-4" />
              {busy ? "Adding..." : "Add entry"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tone: "red" | "black" | "white";
}) {
  const styles = {
    red: {
      card: "bg-[#C00000] text-white ring-[#A00000]",
      icon: "bg-white/15 text-white ring-white/20",
      label: "text-red-100",
      value: "text-white",
      track: "bg-white/20",
      fill: "bg-white"
    },
    black: {
      card: "bg-black text-white ring-black",
      icon: "bg-white/10 text-white ring-white/20",
      label: "text-zinc-300",
      value: "text-white",
      track: "bg-zinc-800",
      fill: "bg-[#C00000]"
    },
    white: {
      card: "bg-white text-ink ring-line",
      icon: "bg-red-50 text-red-600 ring-red-100",
      label: "text-slate-500",
      value: "text-ink",
      track: "bg-slate-100",
      fill: "bg-red-600"
    }
  }[tone];

  return (
    <Card className={`group overflow-hidden p-5 hover:shadow-lift ${styles.card}`}>
      <div className="flex items-center justify-between gap-3">
        <div className={`grid h-11 w-11 place-items-center rounded-md ring-1 transition group-hover:scale-[1.03] [&_svg]:h-5 [&_svg]:w-5 ${styles.icon}`}>{icon}</div>
        <div>
          <p className={`text-right text-sm ${styles.label}`}>{label}</p>
          <p className={`mt-1 text-right text-3xl font-semibold tracking-tight ${styles.value}`}>{value}</p>
        </div>
      </div>
      <div className={`mt-4 h-1.5 overflow-hidden rounded-full ${styles.track}`}>
        <div className={`h-full rounded-full ${styles.fill}`} style={{ width: "72%" }} />
      </div>
    </Card>
  );
}

function LiveFeed({
  entries,
  selected,
  busy,
  onManualEntry
}: {
  entries: CheckIn[];
  selected: Client | null;
  busy: boolean;
  onManualEntry: () => void;
}) {
  const latest = entries[0];
  const manualCount = entries.filter((entry) => entry.manualOverride).length;
  const qrCount = entries.length - manualCount;

  return (
    <Card className="dashboard-panel flex min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-red-950 bg-black px-4 py-4 text-white sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">Attendance stream</h2>
              <span className="rounded-full bg-[#C00000] px-2 py-1 text-xs font-semibold text-white ring-1 ring-[#A00000]">Live</span>
            </div>
            <p className="mt-1 text-sm text-zinc-300">
              {latest ? `Last entry: ${latest.name} at ${formatTime(latest.timestamp)}` : "No check-ins recorded yet."}
            </p>
          </div>
          <Button variant="ghost" disabled={!selected || busy} onClick={onManualEntry}>
            <CalendarPlus className="h-4 w-4" />Manual entry
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StreamMetric label="Total entries" value={entries.length} />
          <StreamMetric label="QR scans" value={qrCount} />
          <StreamMetric label="Manual added" value={manualCount} />
        </div>
      </div>

      <div className="scroll-panel feed-scroll min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-red-50 via-white to-white p-4 pb-6 sm:p-5 sm:pb-6">
        {entries.length === 0 && (
          <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-line bg-white/70 p-8 text-center">
            <div>
              <Fingerprint className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-ink">Waiting for the first scan</p>
              <p className="mt-1 text-sm text-slate-500">QR check-ins will appear here instantly after refresh.</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {entries.map((entry, index) => (
              <motion.div
                key={`${entry.clientId}-${entry.timestamp}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, delay: Math.min(index * 0.02, 0.12) }}
                className="group rounded-lg border-l-4 border-l-[#C00000] bg-white p-4 shadow-sm ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-md text-sm font-semibold ring-1 ${entry.manualOverride ? "bg-zinc-100 text-zinc-800 ring-zinc-200" : "bg-red-50 text-red-600 ring-red-100"}`}>
                      {initials(entry.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{entry.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{formatDate(entry.timestamp)}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{entryTypeLabel(entry.type)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink">{formatTime(entry.timestamp)}</p>
                    <p className="mt-1 text-xs text-slate-500">{entry.sessionsRemaining} left</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
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
  editTotalSessions,
  setEditTotalSessions,
  editRemainingSessions,
  setEditRemainingSessions,
  onSaveName,
  onSaveSessions,
  onStatus,
  onDelete
}: {
  client: Client | null;
  history: CheckIn[];
  busy: boolean;
  editName: string;
  setEditName: (value: string) => void;
  editTotalSessions: string;
  setEditTotalSessions: (value: string) => void;
  editRemainingSessions: string;
  setEditRemainingSessions: (value: string) => void;
  onSaveName: () => void;
  onSaveSessions: () => void;
  onStatus: (clientId: string, status: Client["status"]) => void;
  onDelete: (clientId: string) => void;
}) {
  if (!client) {
    return <Card className="grid min-h-80 place-items-center p-6 text-center text-sm text-slate-500 xl:min-h-0">Select or create a client.</Card>;
  }

  const lastSession = history[0];

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
    <Card className="dashboard-panel flex min-h-0 flex-col overflow-hidden border-t-4 border-t-[#C00000]">
      <div className="shrink-0 bg-black px-5 py-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-white/10 text-sm font-semibold ring-1 ring-white/15">
                {initials(client.name)}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{client.name}</h2>
                <p className="mt-1 text-xs text-white/60">{client.status === "active" ? "Active QR access" : "QR access disabled"}</p>
              </div>
            </div>
          </div>
          <MoreHorizontal className="h-5 w-5 shrink-0 text-white/45" />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniMetric label="Left" value={client.remainingSessions} accent />
          <MiniMetric label="Package" value={client.totalSessions} />
          <MiniMetric label="Used" value={Math.max(client.totalSessions - client.remainingSessions, 0)} />
        </div>
      </div>

      <div className="scroll-panel client-detail-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-4 pb-6 sm:p-5 sm:pb-6">
        <div className="shrink-0 rounded-lg border-l-4 border-l-[#C00000] bg-red-50 p-3 ring-1 ring-red-100">
          <p className="text-xs font-medium uppercase text-slate-500">Check-in URL</p>
          <p className="mt-1 break-all text-xs leading-5 text-slate-600">{client.qrUrl}</p>
        </div>

        <div className="mt-4 grid shrink-0 gap-2">
          <div className="flex gap-2">
            <Input aria-label="Client name" value={editName} onChange={(event) => setEditName(event.target.value)} />
            <Button variant="ghost" disabled={busy || !editName.trim() || editName.trim() === client.name} onClick={onSaveName}>Save</Button>
          </div>
          <div className="grid gap-2 rounded-md bg-cloud p-3 ring-1 ring-line/70">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Package</span>
                <Input min={0} max={999} type="number" value={editTotalSessions} onChange={(event) => setEditTotalSessions(event.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Remaining</span>
                <Input min={0} max={999} type="number" value={editRemainingSessions} onChange={(event) => setEditRemainingSessions(event.target.value)} />
              </label>
            </div>
            <Button
              variant="ghost"
              disabled={
                busy ||
                ((Number(editTotalSessions) || 0) === client.totalSessions &&
                  (Number(editRemainingSessions) || 0) === client.remainingSessions)
              }
              onClick={onSaveSessions}
            >
              Save sessions
            </Button>
          </div>
          <Button variant="ghost" onClick={downloadQr}><Download className="h-4 w-4" />Download QR</Button>
          <Button variant="ghost" onClick={() => onStatus(client.clientId, client.status === "active" ? "disabled" : "active")} disabled={busy}>
            <QrCode className="h-4 w-4" />{client.status === "active" ? "Disable QR" : "Enable QR"}
          </Button>
          <Button variant="danger" onClick={() => onDelete(client.clientId)} disabled={busy}><Trash2 className="h-4 w-4" />Delete client</Button>
        </div>

        <div className="mt-5 grid shrink-0 grid-cols-2 gap-3">
          <InfoTile icon={<Clock3 />} label="Last visit" value={lastSession ? formatDate(lastSession.timestamp) : "None"} />
          <InfoTile icon={<CalendarDays />} label="Sessions left" value={`${client.remainingSessions} of ${client.totalSessions}`} />
        </div>

        <div className="mt-6 flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Session history</h3>
            <span className="text-xs text-slate-500">{history.length} total</span>
          </div>
          <div className="scroll-panel history-scroll mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pb-2 pr-1">
            {history.length === 0 && <p className="rounded-md bg-cloud px-3 py-3 text-sm text-slate-500">No sessions recorded yet.</p>}
            {history.map((entry) => (
              <div key={`${entry.timestamp}-${entry.manualOverride}`} className="rounded-md border-l-4 border-l-[#C00000] bg-white px-3 py-3 shadow-sm ring-1 ring-line">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{entryTypeLabel(entry.type)}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(entry.timestamp)} at {formatTime(entry.timestamp)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${entry.manualOverride ? "bg-zinc-100 text-zinc-800" : "bg-red-50 text-red-600"}`}>
                    {entry.sessionsRemaining} left
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function StreamMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md bg-white/10 px-3 py-2 ring-1 ring-white/15">
      <p className="text-xs text-zinc-300">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value, accent = false }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-md px-3 py-2 ring-1 ${accent ? "bg-[#C00000] ring-[#A00000]" : "bg-white/10 ring-white/10"}`}>
      <p className="text-xs text-white/55">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="rounded-md bg-cloud p-3 ring-1 ring-line/70">
      <div className="flex items-center gap-2 text-slate-500 [&_svg]:h-4 [&_svg]:w-4">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
