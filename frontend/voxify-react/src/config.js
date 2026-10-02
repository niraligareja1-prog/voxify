// Voxify API endpoint configuration.
// Uses Vite env when provided; otherwise automatically uses the
// same host as the frontend with FastAPI on port 8000.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
