import api from './axios'

export const getOrders = async (params?: any) => (await api.get('/orders', { params })).data
export const getOrder = async (id: number) => (await api.get(`/orders/${id}`)).data
export const getOrdersMap = async () => (await api.get('/orders/map')).data
export const createOrder = async (data: any) => (await api.post('/orders', data)).data
export const updateOrder = async (id: number, data: any) => (await api.put(`/orders/${id}`, data)).data
export const assignOrders = async (data: any) => (await api.post('/orders/assign', data)).data
export const changeOrderStatus = async (id: number, status: string) =>
  (await api.patch(`/orders/${id}/status`, { status })).data
