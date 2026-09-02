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

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
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
  getProjects: (): Promise<Project[]> => request<Project[]>('/projects'),

  getProject: (id: string): Promise<Project> => request<Project>(`/projects/${id}`),

  createProject: (data: CreateProjectDto): Promise<Project> =>
    request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateProject: (id: string, data: UpdateProjectDto): Promise<Project> =>
    request<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  deleteProject: (id: string): Promise<{ deleted: boolean }> =>
    request<{ deleted: boolean }>(`/projects/${id}`, {
      method: 'DELETE'
    })
};
