import api from './axios'

export const getProducts = async () => (await api.get('/products')).data
export const createProduct = async (data: any) => (await api.post('/products', data)).data
export const updateProduct = async (id: number, data: any) => (await api.put(`/products/${id}`, data)).data
export const toggleProduct = async (id: number) => (await api.patch(`/products/${id}/toggle`)).data
export const deleteProduct = async (id: number) => (await api.delete(`/products/${id}`)).data