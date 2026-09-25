'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import {
  CalendarCheck2,
  UsersRound,
  Package,
  ArrowLeftRight,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Store,
  LayoutDashboard,
  LayoutGrid,
} from 'lucide-react';
import { isAdmin, roleLabels, type Context } from '@/lib/model';
import { dateLabel, todayIndia } from '@/lib/business';
import { logout } from '@/lib/actions';
export function Shell({
  context,
  children,
  preview = false,
  view = 'dashboard',
}: {
  context: Context;
  children: ReactNode;
  preview?: boolean;
  view?: string;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const admin = isAdmin(context.account.user_role);
  const defaultHome = admin
    ? 'dashboard'
    : context.account.user_role === 'outlet_supervisor'
      ? 'transfers'
      : 'inventory';
  const links = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, hidden: !admin },
    { path: '/attendance', label: 'Attendance', icon: CalendarCheck2 },
    { path: '/employees', label: 'Employees', icon: UsersRound, hidden: !admin },
    {
      path: '/inventory',
      label: 'Inventory',
      icon: Package,
      hidden: context.account.user_role === 'outlet_supervisor',
    },
    { path: '/transfers', label: 'Transfers', icon: ArrowLeftRight },
    { path: '/admin/users', label: 'User access', icon: ShieldCheck, hidden: !admin },
  ];
  const active = preview ? `/${view}` : path;
  return (
    <div className="app-shell">
      {open && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Link
          className="brand"
          href={preview ? `/preview?view=${defaultHome}` : `/${defaultHome}`}
        >
          <span className="brand-mark">JM</span>
          <span>
            Jayaram Mittai<small>OPERATIONS</small>
          </span>
        </Link>
        <button
          className="mobile-close icon-button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {links
            .filter((l) => !l.hidden)
            .map((l) => (
              <Link
                key={l.path}
                onClick={() => setOpen(false)}
                href={preview ? `/preview?view=${l.path.slice(1)}` : l.path}
                className={`nav-link ${active === l.path ? 'active' : ''}`}
                aria-current={active === l.path ? 'page' : undefined}
              >
                <l.icon size={19} strokeWidth={1.7} />
                {l.label}
                {active === l.path && <span className="active-dot" />}
              </Link>
            ))}
        </nav>
        <div className="sidebar-foot">
          <div className="location-tile">
            <Store size={18} />
            <div>
              {admin
                ? 'All locations'
                : context.locations.find((l) => l.location_id === context.account.location_id)
                    ?.location_name}
              <small>{admin ? 'Central store + outlets' : 'Your assigned location'}</small>
            </div>
          </div>
          <div className="sidebar-meta">
            <span className={`connection-dot ${preview ? 'preview' : ''}`} />
            {preview ? 'Design preview' : 'Secure workspace'}
            <span>JM OPS</span>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <LayoutGrid size={16} />
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{links.find((l) => l.path === active)?.label ?? 'Overview'}</strong>
          </div>
          <div className="topbar-right">
            <span className="top-date">{dateLabel(todayIndia())}</span>
            <span className="avatar">
              {context.account.display_name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </span>
            <span className="account-label">
              {context.account.display_name}
              <small>{roleLabels[context.account.user_role]}</small>
            </span>
            {!preview && (
              <form action={logout}>
                <button className="icon-button" title="Sign out" aria-label="Sign out">
                  <LogOut size={17} />
                </button>
              </form>
            )}
          </div>
        </header>
        {preview && (
          <div className="preview-banner">
            Design preview · Sample records · Changes are not saved{' '}
            <Link href="/setup">
              Connect your workspace <ChevronRight size={14} />
            </Link>
          </div>
        )}
        <main className="workspace">{children}</main>
        <footer className="app-footer">
          Jayaram Mittai <span>Internal operations · Asia/Kolkata</span>
        </footer>
      </div>
    </div>
  );
}
