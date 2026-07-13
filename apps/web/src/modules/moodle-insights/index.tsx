import type { ModuleRegistration } from '../types';
import { MoodleDashboardPage } from './MoodleDashboardPage';
import { moodleInsightsManifest } from './module.manifest';

export const moodleInsightsModule: ModuleRegistration = {
  manifest: moodleInsightsManifest,
  routes: [{ path: '/moodle-insights', element: <MoodleDashboardPage /> }]
};
