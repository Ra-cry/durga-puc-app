'use client';
 
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/old-data', label: 'Old PUC Data' },
    { href: '/expired', label: 'Expired PUC' },
  ];

  return (
    <header className="page-header-gradient sticky top-0 z-40">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between py-3">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
              style={{
                background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                boxShadow: '0 4px 12px rgba(14,165,233,0.3)',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white">
                <path
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight tracking-tight">
                DURGA POLLUTION TESTING CENTER
              </h1>
              <p className="text-xs" style={{ color: '#64748b' }}>
                Eluru — PUC Management System
              </p>
            </div>
          </div>

          {/* Sign out */}
          <button
            id="signout-btn"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="btn-secondary"
            style={{ padding: '0.5rem 0.875rem', fontSize: '0.8rem' }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path
                fillRule="evenodd"
                d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
                clipRule="evenodd"
              />
              <path
                fillRule="evenodd"
                d="M6 10a.75.75 0 00.75.75h9.546l-1.048 1.08a.75.75 0 101.08 1.04l2.25-2.327a.75.75 0 000-1.038l-2.25-2.326a.75.75 0 10-1.08 1.04l1.048 1.08H6.75A.75.75 0 006 10z"
                clipRule="evenodd"
              />
            </svg>
            Sign Out
          </button>
        </div>

        {/* Nav */}
        <nav className="flex gap-1 pb-0">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                id={`nav-${link.href.replace('/', '').replace('-', '_')}`}
                className="px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200"
                style={{
                  color: isActive ? '#38bdf8' : '#64748b',
                  background: isActive ? 'rgba(14,165,233,0.1)' : 'transparent',
                  borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
