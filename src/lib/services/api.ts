import type { HistoryEntry, State } from '$lib/types';

export interface Project {
  id: string;
  title: string;
  code: string;
  workspace_id?: string | null;
  created_at: number;
  updated_at: number;
}

export interface CreateProjectDto {
  title: string;
  code: string;
  workspace_id?: string | null;
}

export interface UpdateProjectDto {
  title?: string;
  code?: string;
  workspace_id?: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface CreateWorkspaceDto {
  name: string;
}

export interface UpdateWorkspaceDto {
  name: string;
}

export interface CreateHistoryDto {
  id?: string;
  name: string;
  projectId?: string | null;
  project_id?: string | null;
  state: State | Record<string, unknown>;
  time?: number;
  type?: string;
}

export interface UpdateHistoryDto {
  name?: string;
  state?: State | Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export type PreviewTheme = 'light' | 'dark';

export interface SavePreviewDto {
  theme: PreviewTheme;
  /** sha256 hex of the diagram code the preview was rendered from */
  codeHash: string;
  svg: string;
}

declare global {
  interface Window {
    APP_CONFIG?: {
      apiBaseUrl?: string;
    };
  }
}

export function getApiBaseUrl(): string {
  let url = '';
  if (typeof window !== 'undefined' && window.APP_CONFIG?.apiBaseUrl !== undefined) {
    url = window.APP_CONFIG.apiBaseUrl.trim();
  }
  if (!url) {
    url = (import.meta.env.VITE_API_BASE_URL || '').trim();
  }
  if (!url) {
    url = '/api';
  }
  return url.replace(/\/+$/, '');
}

export function buildApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  let fullUrl = `${baseUrl}${normalizedPath}`;

  if (fullUrl.startsWith('/')) {
    if (
      typeof window !== 'undefined' &&
      window.location?.origin &&
      window.location.origin.startsWith('http')
    ) {
      fullUrl = `${window.location.origin}${fullUrl}`;
    } else if (
      typeof process !== 'undefined' &&
      (process.env.NODE_ENV === 'test' || process.env.VITEST)
    ) {
      fullUrl = `http://localhost:8080${fullUrl}`;
    }
  }

  return fullUrl;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const fullUrl = buildApiUrl(path);

  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });

  const json: ApiResponse<T> = await response.json().catch(() => {
    throw new Error(`HTTP Error ${response.status}: Failed to parse server response`);
  });

  if (!response.ok || !json.success || json.error) {
    const errorMsg = json.error?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    (err as unknown as { status: number }).status = response.status;
    throw err;
  }

  return json.data as T;
}

type PreviewKind = 'projects' | 'history';

/** Fetch the stored server-side preview SVG; null when missing or stale (404). */
async function fetchPreview(
  kind: PreviewKind,
  id: string,
  theme: PreviewTheme
): Promise<string | null> {
  const url = buildApiUrl(`/${kind}/${encodeURIComponent(id)}/preview.svg?theme=${theme}`);
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  return response.text();
}

/** Uploads are deduplicated per resource+theme so a full grid of cards does not flood the backend. */
const inFlightUploads = new Set<string>();

async function uploadPreview(kind: PreviewKind, id: string, dto: SavePreviewDto): Promise<boolean> {
  const key = `${kind}:${id}:${dto.theme}`;
  if (inFlightUploads.has(key)) {
    return false;
  }
  inFlightUploads.add(key);
  try {
    await request<{ saved: boolean }>(`/${kind}/${encodeURIComponent(id)}/preview`, {
      method: 'PUT',
      body: JSON.stringify(dto)
    });
    return true;
  } catch {
    return false;
  } finally {
    inFlightUploads.delete(key);
  }
}

export const api = {
  clearHistoryEntries: (
    type = 'manual',
    projectId?: string | null
  ): Promise<{ cleared: boolean }> => {
    let path = `/history?type=${encodeURIComponent(type)}`;
    if (projectId !== undefined) {
      path += `&projectId=${encodeURIComponent(projectId || 'default')}`;
    }
    return request<{ cleared: boolean }>(path, {
      method: 'DELETE'
    });
  },

  createHistoryEntry: (data: CreateHistoryDto): Promise<HistoryEntry> =>
    request<HistoryEntry>('/history', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  createProject: (data: CreateProjectDto): Promise<Project> =>
    request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  createWorkspace: (data: CreateWorkspaceDto): Promise<Workspace> =>
    request<Workspace>('/workspaces', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  deleteHistoryEntry: (id: string): Promise<{ deleted: boolean }> =>
    request<{ deleted: boolean }>(`/history/${id}`, {
      method: 'DELETE'
    }),

  deleteProject: (id: string): Promise<{ deleted: boolean }> =>
    request<{ deleted: boolean }>(`/projects/${id}`, {
      method: 'DELETE'
    }),

  deleteWorkspace: (id: string): Promise<{ deleted: boolean }> =>
    request<{ deleted: boolean }>(`/workspaces/${id}`, {
      method: 'DELETE'
    }),

  getBookmarkPreview: (id: string, theme: PreviewTheme): Promise<string | null> =>
    fetchPreview('history', id, theme),

  getHistoryEntries: (type = 'manual', projectId?: string | null): Promise<HistoryEntry[]> => {
    let path = `/history?type=${encodeURIComponent(type)}`;
    if (projectId !== undefined) {
      path += `&projectId=${encodeURIComponent(projectId || 'default')}`;
    }
    return request<HistoryEntry[]>(path);
  },

  getProject: (id: string): Promise<Project> => request<Project>(`/projects/${id}`),

  getProjectPreview: (id: string, theme: PreviewTheme): Promise<string | null> =>
    fetchPreview('projects', id, theme),

  getProjects: (): Promise<Project[]> => request<Project[]>('/projects'),

  getWorkspaces: (): Promise<Workspace[]> => request<Workspace[]>('/workspaces'),

  updateHistoryEntry: (id: string, data: UpdateHistoryDto): Promise<HistoryEntry> =>
    request<HistoryEntry>(`/history/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  updateProject: (id: string, data: UpdateProjectDto): Promise<Project> =>
    request<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  updateWorkspace: (id: string, data: UpdateWorkspaceDto): Promise<Workspace> =>
    request<Workspace>(`/workspaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  uploadBookmarkPreview: (id: string, dto: SavePreviewDto): Promise<boolean> =>
    uploadPreview('history', id, dto),

  uploadProjectPreview: (id: string, dto: SavePreviewDto): Promise<boolean> =>
    uploadPreview('projects', id, dto)
};
