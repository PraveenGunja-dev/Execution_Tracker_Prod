/**
 * API base URL — points to the FastAPI backend.
 * In production, this uses the Vite base path to ensure API calls go to the correct subpath.
 */
export const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.BASE_URL.replace(/\/$/, '');
