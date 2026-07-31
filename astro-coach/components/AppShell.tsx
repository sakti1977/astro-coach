"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Sparkles,
  Hexagon,
  BookOpen,
  CircleDot,
  Orbit,
  Clock,
  Target,
  MessageCircle,
  Sprout,
  Menu,
  X,
} from "lucide-react";
import SyncStatus from "@/components/SyncStatus";

const NAV_ITEMS = [
  { href: "/chart",      label: "Chart",      icon: Hexagon },
  { href: "/foundation", label: "Foundation", icon: BookOpen },
  { href: "/dasha",      label: "Dasha",      icon: CircleDot },
  { href: "/transits",   label: "Transits",   icon: Orbit },
  { href: "/muhurta",    label: "Muhurta",    icon: Clock },
  { href: "/validate",   label: "Validate",   icon: Target },
  { href: "/coach",      label: "Guidance",   icon: MessageCircle },
  { href: "/habits",     label: "Sadhana",    icon: Sprout },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <span className="font-semibold text-gray-900 text-sm tracking-tight">Astro Coach</span>
    </Link>
  );
}

function SidebarNav({ path, onNavigate }: { path: string | null; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            path === item.href
              ? "bg-indigo-50 text-indigo-700"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <item.icon className="w-4 h-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function UserFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { data: session } = useSession();

  if (!session) {
    return (
      <Link
        href="/auth/signin"
        onClick={onNavigate}
        className="flex items-center justify-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors px-3 py-2 rounded-lg hover:bg-indigo-50"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Link
        href="/trust"
        onClick={onNavigate}
        className="text-xs text-gray-500 hover:text-gray-700 transition-colors px-3"
        title="How we calculate your chart, and why we never upsell remedies"
      >
        How we work
      </Link>
      <div className="flex items-center justify-between px-3">
        <Link
          href="/profile"
          onClick={onNavigate}
          className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 transition-colors"
          title="Profile &amp; settings"
        >
          <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-700 text-xs font-semibold">
              {(session.user.email ?? session.user.phone ?? "?")[0].toUpperCase()}
            </span>
          </div>
          Profile
        </Link>
        <SyncStatus />
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/auth/signin" })}
        className="text-xs text-gray-500 hover:text-gray-700 transition-colors px-3 text-left"
      >
        Sign out
      </button>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastPath, setLastPath] = useState(path);

  // Close the drawer on navigation. Setting state during render (guarded by
  // the comparison) rather than in an effect avoids an extra render pass.
  if (path !== lastPath) {
    setLastPath(path);
    setDrawerOpen(false);
  }

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/30 to-white">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 border-r border-gray-100 bg-white">
        <div className="px-4 h-14 flex items-center border-b border-gray-100 flex-shrink-0">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav path={path} />
        </div>
        <div className="px-1 py-4 border-t border-gray-100 flex-shrink-0">
          <UserFooter />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-1.5 -ml-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Logo />
        <div className="w-8" />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl flex flex-col">
            <div className="px-4 h-14 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <Logo />
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <SidebarNav path={path} onNavigate={() => setDrawerOpen(false)} />
            </div>
            <div className="px-1 py-4 border-t border-gray-100 flex-shrink-0">
              <UserFooter onNavigate={() => setDrawerOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      <main className="lg:pl-60">{children}</main>
    </div>
  );
}
