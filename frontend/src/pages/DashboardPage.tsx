import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Filter, Plus, RefreshCw, Search, Slack } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { EmailTable } from "../components/EmailTable";
import { Button, Input, Spinner, Toast } from "../components/ui";
import { api, slackConnectUrl } from "../lib/api";
import type { EmailItem, EmailListResponse, SlackStatus } from "../types";

export function DashboardPage() {
  const [params] = useSearchParams();
  const tab = params.get("tab") === "sent" ? "sent" : "scheduled";
  const [view, setView] = useState<"sent" | "failed">("sent");
  const status = tab === "scheduled" ? "scheduled" : view;
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [counts, setCounts] = useState({ scheduled: 0, sent: 0, failed: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [slack, setSlack] = useState<SlackStatus | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ status, limit: "100", ...(search ? { search } : {}) });
      const [list, scheduled, sent, failed, slackResult] = await Promise.all([
        api<EmailListResponse>(`/api/v1/emails?${query}`),
        api<EmailListResponse>("/api/v1/emails?status=scheduled&limit=1"),
        api<EmailListResponse>("/api/v1/emails?status=sent&limit=1"),
        api<EmailListResponse>("/api/v1/emails?status=failed&limit=1"),
        api<{ data: SlackStatus }>("/api/v1/integrations/slack/status")
      ]);
      setEmails(list.data);
      setCounts({ scheduled: scheduled.pagination.total, sent: sent.pagination.total, failed: failed.pagination.total });
      setSlack(slackResult.data);
    } catch (error) { setToast({ message: error instanceof Error ? error.message : "Could not load dashboard", kind: "error" }); }
    finally { setLoading(false); }
  }, [status, search]);
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer); }, [load]);

  const retry = async (id: string) => {
    try { await api(`/api/v1/emails/${id}/retry`, { method: "POST" }); setToast({ message: "Email queued for retry", kind: "success" }); await load(); }
    catch (error) { setToast({ message: error instanceof Error ? error.message : "Retry failed", kind: "error" }); }
  };

  return <AppShell counts={counts} slack={slack}>
    {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 lg:px-8">
      <div><h1 className="text-lg font-semibold text-ink">{tab === "scheduled" ? "Scheduled emails" : "Sent emails"}</h1><p className="text-xs text-slate-400">Monitor every recipient and delivery.</p></div>
      <div className="flex items-center gap-2">
        {!slack?.connected && <a href={slackConnectUrl}><Button className="border border-slate-200 bg-white text-slate-600"><Slack className="h-4 w-4" />Connect Slack</Button></a>}
        <Link to="/compose"><Button className="bg-mint-500 text-white hover:bg-mint-600"><Plus className="h-4 w-4" />Compose new email</Button></Link>
      </div>
    </header>
    <main className="px-5 py-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="bg-slate-50 pl-9" placeholder="Search recipient or subject" value={search} onChange={event => setSearch(event.target.value)} /></div>
        <Button onClick={() => void load()} className="border border-slate-200 bg-white text-slate-600"><RefreshCw className="h-4 w-4" />Refresh</Button>
        <Button className="border border-slate-200 bg-white text-slate-600"><Filter className="h-4 w-4" />Filter</Button>
      </div>
      {tab === "sent" && <div className="mb-5 inline-flex rounded-lg bg-slate-100 p-1"><button onClick={() => setView("sent")} className={`segment ${view === "sent" ? "segment-active" : ""}`}>Sent {counts.sent}</button><button onClick={() => setView("failed")} className={`segment ${view === "failed" ? "segment-active" : ""}`}>Failed {counts.failed}</button></div>}
      <section className="rounded-xl border border-slate-200 bg-white">{loading ? <Spinner label="Loading emails…" /> : <EmailTable emails={emails} mode={status} onRetry={status === "failed" ? (id) => void retry(id) : undefined} />}</section>
    </main>
  </AppShell>;
}
