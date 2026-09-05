import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// Legacy path: the projects page was renamed to /dashboard
export const load: PageLoad = () => {
  redirect(308, '/dashboard');
};
