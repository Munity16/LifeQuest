"use client";

import { Map, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MobileAdventureNav({ campaignId }: { campaignId?: string }) {
  const pathname = usePathname();
  const questLogHref = campaignId ? `/campaign/${campaignId}` : "/onboarding";
  const items = [
    { href: questLogHref, label: "Quest log", icon: Map, active: campaignId ? pathname.startsWith(`/campaign/${campaignId}`) : false },
    { href: "/onboarding", label: "New quest", icon: Sparkles, active: pathname === "/onboarding" },
    { href: "/profile", label: "Hero", icon: UserRound, active: pathname === "/profile" },
  ];

  return (
    <nav className="mobile-adventure-nav" aria-label="Mobile adventure navigation">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link className={cn(item.active && "mobile-nav-active")} href={item.href} key={item.label} aria-current={item.active ? "page" : undefined}>
            <Icon size={18} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
