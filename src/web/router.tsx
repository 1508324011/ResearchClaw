import React from 'react';
import { NavLink, Outlet, createBrowserRouter, type RouteObject } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LibraryPage } from './pages/library/page';
import { SearchPage } from './pages/search/page';
import { PaperOverviewPage } from './pages/papers/overview/page';
import { ReaderPage } from './pages/papers/reader/page';
import { NotesPage } from './pages/papers/notes/page';

function navClassName({ isActive }: { isActive: boolean }) {
  return [
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
    isActive
      ? 'bg-notion-accent-light text-notion-accent shadow-notion'
      : 'text-notion-text-secondary hover:bg-white hover:text-notion-text',
  ].join(' ');
}

function WebLayout() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-notion-sidebar text-notion-text">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-2xl border border-notion-border bg-white/95 p-5 shadow-notion backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-notion-text-tertiary">
                ResearchClaw Web
              </p>
              <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight text-notion-text">
                  {t('web.shell.title')}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-notion-text-secondary">
                  {t('web.shell.subtitle')}
                </p>
              </div>
            </div>

            <nav className="flex flex-wrap gap-2">
              <NavLink to="/" end className={navClassName}>
                {t('web.nav.library')}
              </NavLink>
              <NavLink to="/search" className={navClassName}>
                {t('web.nav.search')}
              </NavLink>
            </nav>
          </div>
        </header>

        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export const webRoutes: RouteObject[] = [
  {
    path: '/',
    element: <WebLayout />,
    children: [
      { index: true, element: <LibraryPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'papers/:paperId', element: <PaperOverviewPage /> },
      { path: 'papers/:paperId/reader', element: <ReaderPage /> },
      { path: 'papers/:paperId/notes', element: <NotesPage /> },
    ],
  },
];

export const router = createBrowserRouter(webRoutes);
