import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bold, CalendarClock, Check, Clock3, Italic, List, Paperclip, Send, Underline, Upload, Users, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button, Input, Spinner, Toast } from "../components/ui";
import { api } from "../lib/api";
import type { Sender } from "../types";

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const localDateTime = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export function ComposePage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [senderId, setSenderId] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [manualRecipient, setManualRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [startTime, setStartTime] = useState(localDateTime(new Date(Date.now() + 5 * 60_000)));
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [fileName, setFileName] = useState("");
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);

  useEffect(() => { api<{ data: Sender[] }>("/api/v1/senders").then(result => { const active = result.data.filter(sender => sender.isActive); setSenders(active); setSenderId(active.find(sender => sender.isDefault)?.id ?? active[0]?.id ?? ""); }).catch(error => setToast({ message: error.message, kind: "error" })).finally(() => setLoading(false)); }, []);
  const uniqueRecipients = useMemo(() => [...new Set(recipients.map(email => email.toLowerCase()))], [recipients]);
  const addManual = () => { const matches = manualRecipient.match(emailPattern) ?? []; if (!matches.length) return setToast({ message: "Enter a valid email address", kind: "error" }); setRecipients(current => [...current, ...matches]); setManualRecipient(""); };
  const parseFile = async (file?: File) => { if (!file) return; if (file.size > 5_000_000) return setToast({ message: "File must be smaller than 5 MB", kind: "error" }); const matches = (await file.text()).match(emailPattern) ?? []; setRecipients(current => [...current, ...matches]); setFileName(file.name); setToast({ message: `${new Set(matches.map(v => v.toLowerCase())).size} email addresses detected`, kind: "success" }); };
  const schedule = async () => {
    if (!senderId || !uniqueRecipients.length || !subject.trim() || !body.trim()) return setToast({ message: "Sender, recipient, subject and body are required", kind: "error" });
    setSubmitting(true);
    try {
      await api("/api/v1/emails/campaigns", { method: "POST", body: JSON.stringify({ senderId, recipients: uniqueRecipients, subject: subject.trim(), bodyHtml: body.replace(/\n/g, "<br>"), startTime: new Date(startTime).toISOString(), delayMs: delaySeconds * 1000, hourlyLimit }) });
      navigate("/dashboard?tab=scheduled", { state: { message: `${uniqueRecipients.length} emails scheduled` } });
    } catch (error) { setToast({ message: error instanceof Error ? error.message : "Could not schedule campaign", kind: "error" }); }
    finally { setSubmitting(false); }
  };
  if (loading) return <AppShell><Spinner label="Loading composer…" /></AppShell>;
  return <AppShell>
    {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 lg:px-8"><div className="flex items-center gap-3"><Link to="/dashboard"><button className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></button></Link><div><h1 className="font-semibold text-ink">Compose New Email</h1><p className="text-xs text-slate-400">Create a personalized scheduled campaign.</p></div></div><Button disabled={submitting} onClick={() => void schedule()} className="bg-mint-500 text-white hover:bg-mint-600"><Send className="h-4 w-4" />{submitting ? "Scheduling…" : "Schedule"}</Button></header>
    <main className="mx-auto max-w-5xl px-5 py-7 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="space-y-5">
          <div className="form-row"><label>From</label><select value={senderId} onChange={e => setSenderId(e.target.value)} className="form-control">{senders.map(sender => <option key={sender.id} value={sender.id}>{sender.name} · {sender.email}{sender.isDefault ? " (Default)" : ""}</option>)}</select></div>
          <div className="form-row items-start"><label className="pt-2">To</label><div className="flex-1"><div className="flex gap-2"><Input value={manualRecipient} onChange={e => setManualRecipient(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addManual(); } }} placeholder="recipient@example.com" /><Button onClick={addManual} className="border border-slate-200 bg-white text-slate-600">Add</Button><Button onClick={() => fileRef.current?.click()} className="border border-slate-200 bg-white text-mint-600"><Upload className="h-4 w-4" />Upload list</Button></div><input ref={fileRef} hidden type="file" accept=".csv,.txt,text/csv,text/plain" onChange={e => void parseFile(e.target.files?.[0])} />{uniqueRecipients.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{uniqueRecipients.slice(0, 5).map(email => <span key={email} className="recipient-chip">{email}<button onClick={() => setRecipients(current => current.filter(item => item.toLowerCase() !== email))}><X className="h-3 w-3" /></button></span>)}{uniqueRecipients.length > 5 && <span className="recipient-chip">+{uniqueRecipients.length - 5} more</span>}</div>}{fileName && <p className="mt-2 text-xs text-slate-400">{fileName} · {uniqueRecipients.length} unique addresses</p>}</div></div>
          <div className="form-row"><label>Subject</label><Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Write a clear subject line" /></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60"><div className="flex items-center gap-1 border-b border-slate-200 bg-white px-3 py-2 text-slate-400">{[Bold, Italic, Underline, List, Paperclip].map((Icon, index) => <button key={index} className="rounded p-2 hover:bg-slate-100 hover:text-ink"><Icon className="h-4 w-4" /></button>)}</div><textarea value={body} onChange={e => setBody(e.target.value)} className="min-h-[330px] w-full resize-none bg-transparent p-5 text-sm leading-7 outline-none" placeholder="Type your email…" /></div>
        </section>
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-semibold text-ink"><CalendarClock className="h-4 w-4 text-mint-600" />Send later</h2><div className="mt-5 space-y-4"><label className="field-label">Start date & time<Input type="datetime-local" min={localDateTime(new Date())} value={startTime} onChange={e => setStartTime(e.target.value)} /></label><label className="field-label">Delay between emails (seconds)<Input type="number" min={2} max={3600} value={delaySeconds} onChange={e => setDelaySeconds(Number(e.target.value))} /></label><label className="field-label">Hourly limit<Input type="number" min={1} max={100000} value={hourlyLimit} onChange={e => setHourlyLimit(Number(e.target.value))} /></label></div><div className="mt-6 space-y-3 rounded-lg bg-mint-50 p-4 text-xs text-slate-600"><p className="flex gap-2"><Users className="h-4 w-4 shrink-0 text-mint-600" /><span><b>{uniqueRecipients.length}</b> unique recipients</span></p><p className="flex gap-2"><Clock3 className="h-4 w-4 shrink-0 text-mint-600" /><span>Minimum system delay and hourly cap are always enforced.</span></p><p className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-mint-600" /><span>Jobs survive API and worker restarts.</span></p></div></aside>
      </div>
    </main>
  </AppShell>;
}
