"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Store,
  LayoutDashboard,
  PlusCircle,
  Wallet,
  LogOut,
  Loader2,
  User,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import { SignalLogo } from "./SignalLogo";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/contracts/new", label: "New Contract", icon: PlusCircle },
  { href: "/profile", label: "Profile", icon: User },
];

export function Navbar() {
  const pathname = usePathname();
  const { login, logout, authenticated, ready, displayName } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="border-b border-border/40 bg-background/90 backdrop-blur-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 group"
            aria-label="TrustSignal Home"
          >
            <SignalLogo size={28} className="rounded-md" />
            <span className="text-base font-bold tracking-tight group-hover:text-accent transition-colors">
              TrustSignal
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-accent/12 text-accent"
                      : "text-muted hover:text-foreground hover:bg-surface-secondary"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1.5">
            <ThemeToggle />

            {!ready ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-secondary text-muted text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">Loading</span>
              </div>
            ) : authenticated ? (
              <div className="flex items-center gap-1">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-secondary text-sm font-medium hover:bg-surface-tertiary transition-colors"
                >
                  <div className="h-5 w-5 rounded-full bg-accent/20 flex items-center justify-center">
                    <User className="h-3 w-3 text-accent" />
                  </div>
                  <span className="max-w-[100px] truncate hidden sm:inline">
                    {displayName ?? "Account"}
                  </span>
                </Link>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-md text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                  aria-label="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={login}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/85 transition-colors"
                aria-label="Sign in"
              >
                <Wallet className="h-3.5 w-3.5" />
                Sign in
              </button>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-1.5 rounded-md text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/40 bg-background">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-accent/12 text-accent"
                      : "text-muted hover:text-foreground hover:bg-surface-secondary"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
