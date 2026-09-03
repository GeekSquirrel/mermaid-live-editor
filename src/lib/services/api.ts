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
  const response = await fetch(`${baseUrl}${normalizedPath}`, {
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
  createProject: (data: CreateProjectDto): Promise<Project> =>
    request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  deleteProject: (id: string): Promise<{ deleted: boolean }> =>
    request<{ deleted: boolean }>(`/projects/${id}`, {
      method: 'DELETE'
    }),

  getProject: (id: string): Promise<Project> => request<Project>(`/projects/${id}`),

  getProjects: (): Promise<Project[]> => request<Project[]>('/projects'),

  updateProject: (id: string, data: UpdateProjectDto): Promise<Project> =>
    request<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
};
