import type { HistoryEntry, State } from '$lib/types';

export interface Project {
  id: string;
  title: string;
  code: string;
  created_at: number;
  updated_at: number;
}

export interface CreateProjectDto {
  title: string;
  code: string;
}

export interface UpdateProjectDto {
  title?: string;
  code?: string;
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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
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

  deleteHistoryEntry: (id: string): Promise<{ deleted: boolean }> =>
    request<{ deleted: boolean }>(`/history/${id}`, {
      method: 'DELETE'
    }),

  deleteProject: (id: string): Promise<{ deleted: boolean }> =>
    request<{ deleted: boolean }>(`/projects/${id}`, {
      method: 'DELETE'
    }),

  getHistoryEntries: (type = 'manual', projectId?: string | null): Promise<HistoryEntry[]> => {
    let path = `/history?type=${encodeURIComponent(type)}`;
    if (projectId !== undefined) {
      path += `&projectId=${encodeURIComponent(projectId || 'default')}`;
    }
    return request<HistoryEntry[]>(path);
  },

  getProject: (id: string): Promise<Project> => request<Project>(`/projects/${id}`),

  getProjects: (): Promise<Project[]> => request<Project[]>('/projects'),

  updateHistoryEntry: (id: string, data: UpdateHistoryDto): Promise<HistoryEntry> =>
    request<HistoryEntry>(`/history/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  updateProject: (id: string, data: UpdateProjectDto): Promise<Project> =>
    request<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
};
