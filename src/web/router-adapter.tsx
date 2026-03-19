import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { createRendererRouteTree } from '../renderer/router-tree';
import { JobsPage } from './pages/jobs/page';

export function createWebRoutes(): RouteObject[] {
  return createRendererRouteTree({
    indexRedirectPath: '/papers',
    extraChildren: [{ path: 'jobs', element: <JobsPage /> }],
  });
}

export function createWebRouter() {
  return createBrowserRouter(createWebRoutes());
}
