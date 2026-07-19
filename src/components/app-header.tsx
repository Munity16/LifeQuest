import Link from "next/link";
import { BookOpenText, LogOut, ScrollText, Swords, UserRound } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

export function AppHeader({
  email,
  campaignId,
  isDemo = false,
  publicNav = false,
}: {
  email?: string;
  campaignId?: string;
  isDemo?: boolean;
  publicNav?: boolean;
}) {
  return (
    <header className="app-header">
      <div className="page-shell header-inner">
        <BrandMark />
        {publicNav ? (
          <nav className="header-nav" aria-label="Primary navigation">
            <a href="#how-it-works"><ScrollText size={15} aria-hidden="true" /> Game loop</a>
            <Link href="/login">Sign in</Link>
            <Link href="/signup" className="nav-cta"><Swords size={15} aria-hidden="true" /> Begin adventure</Link>
          </nav>
        ) : (
          <nav className="header-nav header-nav-auth" aria-label="Account navigation">
            {campaignId && <Link href={`/campaign/${campaignId}`}><BookOpenText size={15} aria-hidden="true" /> Quest log</Link>}
            <Link href="/profile" className="header-user" title={email || "Profile"}>
              <UserRound size={16} aria-hidden="true" />
              <span>{isDemo ? "Demo hero" : "Hero sheet"}</span>
            </Link>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="icon-button" aria-label="Sign out" title="Sign out">
                <LogOut size={17} aria-hidden="true" />
              </button>
            </form>
          </nav>
        )}
      </div>
    </header>
  );
}
