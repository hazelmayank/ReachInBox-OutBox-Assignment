import { ChevronDown, Clock3, LogOut, Mail, Plus, Send, Slack } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui";
import type { SlackStatus } from "../types";
import { slackConnectUrl } from "../lib/api";

export function AppShell({ children, counts, slack }: { children: React.ReactNode; counts?: { scheduled: number; sent: number }; slack?: SlackStatus | null }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const active = new URLSearchParams(location.search).get("tab") ?? "scheduled";
  const signOut = async () => { await logout(); navigate("/login"); };
  return <div className="min-h-screen bg-[#f5f7f6] p-3 sm:p-5">
    <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-[1500px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-[#fbfcfb] p-5 md:flex md:flex-col">
        <Link to="/dashboard" className="mb-5 flex items-center gap-2 text-xl font-bold tracking-tight text-ink"><span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-xs text-white">RI</span>ReachInbox</Link>
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
          {user?.avatarUrl ? <img className="h-9 w-9 rounded-full object-cover" src={user.avatarUrl} alt="" /> : <div className="grid h-9 w-9 place-items-center rounded-full bg-mint-100 text-sm font-semibold text-mint-600">{user?.name?.[0]}</div>}
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{user?.name}</p><p className="truncate text-xs text-slate-400">{user?.email}</p></div><ChevronDown className="h-4 w-4 text-slate-400" />
        </div>
        <Link to="/compose"><Button className="mb-7 w-full border border-mint-500 bg-white text-mint-600 hover:bg-mint-50"><Plus className="h-4 w-4" />Compose</Button></Link>
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">Core</p>
        <nav className="space-y-1">
          <Link to="/dashboard?tab=scheduled" className={`nav-item ${active === "scheduled" ? "nav-active" : ""}`}><Clock3 className="h-4 w-4" /><span>Scheduled</span><b>{counts?.scheduled ?? 0}</b></Link>
          <Link to="/dashboard?tab=sent" className={`nav-item ${active === "sent" ? "nav-active" : ""}`}><Send className="h-4 w-4" /><span>Sent</span><b>{counts?.sent ?? 0}</b></Link>
        </nav>
        <div className="mt-auto space-y-2">
          <a href={slackConnectUrl} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"><Slack className="h-4 w-4" />{slack?.connected ? `Slack · ${slack.channelName ?? "Connected"}` : "Connect Slack"}</a>
          <button onClick={() => void signOut()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600"><LogOut className="h-4 w-4" />Logout</button>
        </div>
      </aside>
      <section className="min-w-0 flex-1">{children}</section>
    </div>
    <div className="fixed bottom-4 left-4 right-4 z-40 flex justify-around rounded-2xl border border-slate-200 bg-white p-2 shadow-soft md:hidden">
      <Link className="mobile-nav" to="/dashboard?tab=scheduled"><Clock3 />Scheduled</Link><Link className="mobile-nav" to="/compose"><Mail />Compose</Link><Link className="mobile-nav" to="/dashboard?tab=sent"><Send />Sent</Link>
    </div>
  </div>;
}
