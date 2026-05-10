"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/chart",    label: "Chart",    icon: "⬡" },
  { href: "/dasha",    label: "Dasha",    icon: "◉" },
  { href: "/transits", label: "Transits", icon: "⊕" },
  { href: "/validate", label: "Validate", icon: "◎" },
  { href: "/coach",    label: "Coach",    icon: "✦" },
  { href: "/habits",   label: "Habits",   icon: "◈" },
];

export default function NavBar() {
  const path = usePathname();

  return (
    <nav className="border-b border-gray-100 bg-white sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 flex items-center h-14 gap-1 overflow-x-auto scrollbar-none">
        <Link href="/" className="flex items-center gap-1.5 mr-6">
          <span className="text-lg">✦</span>
          <span className="font-semibold text-gray-900 text-sm tracking-tight">Astro Coach</span>
        </Link>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
              path === item.href
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
