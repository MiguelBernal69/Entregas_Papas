import api from './axios'

export const getRegions = async () => (await api.get('/regions')).data
export const getRegion = async (id: number) => (await api.get(`/regions/${id}`)).data
export const createRegion = async (data: any) => (await api.post('/regions', data)).data
export const updateRegion = async (id: number, data: any) => (await api.put(`/regions/${id}`, data)).data
export const deleteRegion = async (id: number) => (await api.delete(`/regions/${id}`)).data
export const getOrdersInRegion = async (id: number) => (await api.get(`/regions/${id}/orders`)).data
export const recalculateRegions = async () => (await api.post('/regions/recalculate')).data