import { Navigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { authUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";

function GoogleMark() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.3h6a5.2 5.2 0 0 1-2.2 3.3v2.8h3.6c2.1-2 3.2-4.8 3.2-8.2Z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.6l-3.6-2.8c-1 .7-2.3 1-3.8 1a6.5 6.5 0 0 1-6.1-4.5H2.2V17A11.2 11.2 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.9 14.1a6.7 6.7 0 0 1 0-4.2V7H2.2a11.2 11.2 0 0 0 0 10l3.7-2.9Z"/><path fill="#EA4335" d="M12 5.4c1.7 0 3.2.6 4.4 1.7l3.1-3.1A10.6 10.6 0 0 0 12 1 11.2 11.2 0 0 0 2.2 7l3.7 2.9A6.5 6.5 0 0 1 12 5.4Z"/></svg>;
}

export function LoginPage() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" replace />;
  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#fbfcfb] px-5">
    <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-mint-100/60 blur-3xl" />
    <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-emerald-100/50 blur-3xl" />
    <section className="relative w-full max-w-[390px] rounded-2xl border border-slate-200 bg-white p-8 shadow-soft">
      <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-white"><Mail className="h-5 w-5" /></div>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-ink">Welcome back</h1>
      <p className="mt-2 text-center text-sm text-slate-500">Sign in to schedule and monitor your outreach.</p>
      <a href={authUrl} className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-mint-50 px-4 py-3 text-sm font-medium text-ink transition hover:border-mint-500 hover:bg-mint-100"><GoogleMark />Continue with Google</a>
      <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200" />Secure OAuth login<span className="h-px flex-1 bg-slate-200" /></div>
      <p className="text-center text-xs leading-5 text-slate-400">By continuing, you agree to use ReachInbox responsibly for permission-based outreach.</p>
    </section>
  </main>;
}
