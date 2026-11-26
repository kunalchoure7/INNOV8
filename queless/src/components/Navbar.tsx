import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui';
import { cn } from '../lib/utils';

export type AppRoute = '/' | '/book' | '/my-tokens' | '/display' | '/admin';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate }) => {
  const { firebaseUser, signInWithGoogle, signOutUser } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: { label: string; path: AppRoute }[] = [
    { label: 'How It Works', path: '/' },
    { label: 'My Tokens', path: '/my-tokens' },
    { label: 'Live Display', path: '/display' },
    { label: 'Admin Console', path: '/admin' },
  ];

  const handleNav = (path: string) => {
    setMobileOpen(false);
    if (path === '/' && currentPath === '/') {
      const el = document.getElementById('how-it-works');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    onNavigate(path);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/65 backdrop-blur-2xl border-b border-white/85 shadow-[0_8px_32px_rgba(53,109,243,0.08)]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="font-display text-lg font-bold tracking-tight text-[#101828] hover:text-[#356DF3] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#356DF3]/40 rounded-md"
        >
          QueueLess
        </button>

        {/* Zone 2: Concise single-line nav links with animated blue-purple underline */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700">
          {navItems.map((item) => {
            const isActive =
              item.path === '/'
                ? currentPath === '/'
                : currentPath.startsWith(item.path);
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNav(item.path)}
                className={cn(
                  'ql-nav-link whitespace-nowrap shrink-0 transition-colors duration-200 cursor-pointer py-1.5',
                  isActive
                    ? 'ql-nav-link-active text-[#101828] font-semibold'
                    : 'hover:text-[#356DF3]'
                )}
              >
                {item.label}
              </button>
            );
          })}
          {firebaseUser ? (
            <button
              type="button"
              onClick={() => signOutUser()}
              className="ql-nav-link whitespace-nowrap shrink-0 text-slate-600 hover:text-[#7859ED] transition-colors duration-200 cursor-pointer py-1.5"
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => signInWithGoogle()}
              className="ql-nav-link whitespace-nowrap shrink-0 text-slate-700 hover:text-[#356DF3] transition-colors duration-200 cursor-pointer py-1.5"
            >
              Sign In
            </button>
          )}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => onNavigate('/book')}
            className="hidden sm:inline-flex"
          >
            Get Your Token
          </Button>

          <button
            type="button"
            aria-label="Toggle Menu"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-xl text-slate-700 hover:text-[#356DF3] hover:bg-white/75 border border-transparent hover:border-white/90 transition-all cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-white/80 bg-white/88 backdrop-blur-2xl px-4 py-4 space-y-2 shadow-[0_16px_36px_rgba(53,109,243,0.1)]">
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => handleNav(item.path)}
              className="block w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:text-[#356DF3] hover:bg-[#D9F3FF]/60 transition-colors"
            >
              {item.label}
            </button>
          ))}
          <div className="pt-2 border-t border-sky-100 flex items-center gap-2">
            {firebaseUser ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setMobileOpen(false);
                  signOutUser();
                }}
              >
                Sign Out
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setMobileOpen(false);
                  signInWithGoogle();
                }}
              >
                Sign In
              </Button>
            )}
            <Button
              variant="primary"
              className="w-full"
              onClick={() => handleNav('/book')}
            >
              Get Your Token
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};
