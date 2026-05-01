export const API_BASE_URL = 'http://127.0.0.1:8000';

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof data === 'string' ? data : data?.detail || data?.message || 'Request failed';
    throw new Error(message);
  }

  return data;
}

export function authHeaders(token, extraHeaders = {}) {
  return {
    ...extraHeaders,
    Authorization: `Bearer ${token}`,
  };
}
