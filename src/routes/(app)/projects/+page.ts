import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// Legacy path: the old /projects page now redirects to /dashboard
export const load: PageLoad = () => {
  redirect(308, '/dashboard');
};
