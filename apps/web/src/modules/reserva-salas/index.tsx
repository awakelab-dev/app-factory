import type { ModuleRegistration } from '../types';
import { reservaSalasManifest } from './module.manifest';
import { ReservaSalasPage } from './ReservaSalasPage';

export const reservaSalasModule: ModuleRegistration = {
  manifest: reservaSalasManifest,
  routes: [{ path: '/reserva-salas', element: <ReservaSalasPage /> }]
};
