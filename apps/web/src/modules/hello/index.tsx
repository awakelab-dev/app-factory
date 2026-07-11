import type { ModuleRegistration } from '../types';
import { HelloPage } from './HelloPage';
import { helloManifest } from './module.manifest';

export const helloModule: ModuleRegistration = {
  manifest: helloManifest,
  routes: [{ path: '/hello', element: <HelloPage /> }]
};
