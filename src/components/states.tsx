import Link from "next/link";
import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";

export function LoadingQuestCard() {
  return <div className="quest-card loading-card"><span /><span /><span /></div>;
}

export function EmptyState({ title, message, actionHref, actionLabel }: { title: string; message: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="state-card">
      <Inbox size={27} />
      <h2>{title}</h2><p>{message}</p>
      {actionHref && actionLabel && <Link href={actionHref} className="button button-primary">{actionLabel}</Link>}
    </div>
  );
}

export function ErrorState({ title = "The path is obscured", message }: { title?: string; message: string }) {
  return <div className="state-card state-error"><AlertTriangle size={27} /><h2>{title}</h2><p>{message}</p></div>;
}

export function InlineLoader({ label = "Working..." }: { label?: string }) {
  return <span className="inline-loader"><LoaderCircle className="spin" size={17} /> {label}</span>;
}
