"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import { Sparkles, Hexagon, BookOpen, CircleDot, Orbit, Clock, Target, MessageCircle, Sprout } from "lucide-react";
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

export default function NavBar() {
  const path = usePathname();
  const { data: session } = useSession();

  return (
    <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mr-6 flex-shrink-0">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm tracking-tight">Astro Coach</span>
        </Link>

        {/* Nav items */}
        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none flex-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${
                path === item.href
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
            </Link>
          ))}
        </div>

        {/* User menu */}
        {session && (
          <div className="flex items-center gap-2.5 ml-3 flex-shrink-0">
            <Link
              href="/trust"
              className="hidden sm:inline text-xs text-gray-400 hover:text-gray-700 transition-colors"
              title="How we calculate your chart, and why we never upsell remedies"
            >
              How we work
            </Link>
            <SyncStatus />
            <Link
              href="/profile"
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors"
              title="Profile &amp; settings"
            >
              <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-indigo-700 text-xs font-semibold">
                  {(session.user.email ?? session.user.phone ?? "?")[0].toUpperCase()}
                </span>
              </div>
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors pl-1"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
