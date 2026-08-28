import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({ className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props}>{children}</button>;
}
export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-mint-500 focus:ring-2 focus:ring-mint-100 ${className}`} {...props} />;
}
export function Spinner({ label = "Loading" }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin" />{label}</div>;
}
export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <div className="flex min-h-72 flex-col items-center justify-center text-center"><div className="mb-4 rounded-2xl bg-mint-50 p-4 text-mint-600">{icon}</div><h3 className="font-semibold text-ink">{title}</h3><p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p></div>;
}
export function Toast({ message, kind = "success", onClose }: { message: string; kind?: "success" | "error"; onClose: () => void }) {
  return <div className={`fixed right-5 top-5 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm shadow-soft ${kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}><button className="text-left" onClick={onClose}>{message}</button></div>;
}
