import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_URL,
});

// Add auth header from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Jira Settings
export const getJiraSettings = () => api.get('/settings/jira');
export const saveJiraSettings = (data) => api.post('/settings/jira', data);
export const testJiraConnection = () => api.post('/settings/jira/test');

// Projects
export const getCloudProjects = () => api.get('/projects/cloud');
export const getOnPremProjects = () => api.get('/projects/onprem');
export const getProjectMappings = () => api.get('/projects/mappings');
export const createProjectMapping = (data) => api.post('/projects/mappings', data);
export const deleteProjectMapping = (id) => api.delete(`/projects/mappings/${id}`);
export const toggleProjectMapping = (id) => api.patch(`/projects/mappings/${id}/toggle`);

// Issue Types
export const getCloudIssueTypes = () => api.get('/issuetypes/cloud');
export const getOnPremIssueTypes = () => api.get('/issuetypes/onprem');
export const getIssueTypeMappings = (projectMappingId) => 
  api.get('/issuetypes/mappings', { params: projectMappingId ? { project_mapping_id: projectMappingId } : {} });
export const createIssueTypeMapping = (data) => api.post('/issuetypes/mappings', data);
export const deleteIssueTypeMapping = (id) => api.delete(`/issuetypes/mappings/${id}`);

// Sync
export const triggerSync = () => api.post('/sync/trigger');
export const getSyncStatus = () => api.get('/sync/status');

// Logs
export const getTransferLogs = (params) => api.get('/logs', { params });
export const getLogStats = () => api.get('/logs/stats');

// Dashboard
export const getDashboardStats = () => api.get('/dashboard/stats');
export const getRecentLogs = () => api.get('/dashboard/recent-logs');

export default api;
