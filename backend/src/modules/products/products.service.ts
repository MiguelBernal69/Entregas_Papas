import prisma from '../../prisma/client'

export const getAllProducts = async (onlyActive = false) => {
  return prisma.product.findMany({
    where: onlyActive ? { isActive: true } : {},
    orderBy: { name: 'asc' }
  })
}

export const getProductById = async (id: number) => {
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) throw new Error('Producto no encontrado')
  return product
}

export const createProduct = async (data: {
  name: string
  description?: string
  price: number
  unit: string
}) => {
  const exists = await prisma.product.findFirst({ where: { name: data.name } })
  if (exists) throw new Error('Ya existe un producto con ese nombre')

  return prisma.product.create({ data })
}

export const updateProduct = async (id: number, data: {
  name?: string
  description?: string
  price?: number
  unit?: string
}) => {
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) throw new Error('Producto no encontrado')

  return prisma.product.update({ where: { id }, data })
}

export const toggleProduct = async (id: number) => {
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) throw new Error('Producto no encontrado')

  return prisma.product.update({
    where: { id },
    data: { isActive: !product.isActive },
    select: { id: true, name: true, isActive: true }
  })
}