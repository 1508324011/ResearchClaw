import { createHashRouter } from 'react-router-dom';
import { createRendererRouteTree } from './router-tree';

// Use hash router for Electron (file:// protocol)
export const router = createHashRouter(
  createRendererRouteTree({ indexRedirectPath: '/dashboard' }),
);
