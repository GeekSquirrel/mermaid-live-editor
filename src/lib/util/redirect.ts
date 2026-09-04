import { resolve } from '$app/paths';

/**
 * Build the redirect URL for legacy root-path links.
 * Extracts the route and fragment from the old hash-based URL format,
 * and ensures search params (e.g. UTM) come before the hash fragment.
 */
export const buildRedirectUrl = (location: Location): string => {
  const parts = location.hash.split('/');
  // Visitors without a subpath land on the project list instead of creating a new project.
  let path = 'projects';
  let fragment = '';
  if (parts.length > 2) {
    path = parts[1];
    fragment = `#${parts[2]}`;
  }
  return `${resolve(`/${path}`, {})}${location.search}${fragment}`;
};
