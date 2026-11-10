import bcrypt from 'bcryptjs'
import prisma from '../../prisma/client'

/**
 * Valida que la contraseña provista corresponda al administrador
 */
export const verifyAdminPassword = async (userId: number, password?: string) => {
  if (!password || !password.trim()) {
    throw new Error('Se requiere la contraseña de administrador para autorizar esta operación')
  }
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.role !== 'admin') {
    throw new Error('Solo un usuario administrador puede autorizar esta acción')
  }
  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    throw new Error('Contraseña de administrador incorrecta')
  }
  return true
}

interface CreateProductionInput {
  productId: number
  quantity: number
  notes?: string
  date?: string
  userId?: number
  adminPassword?: string
}

/**
 * Registra una nueva entrada de producción / mercadería al almacén.
 * Siempre exige contraseña de admin para autorizar la operación.
 */
export const createProductionEntry = async (data: CreateProductionInput) => {
  const { productId, quantity, notes, date, userId, adminPassword } = data

  if (!productId || quantity === 0 || isNaN(quantity)) {
    throw new Error('El producto y una cantidad distinta de 0 son obligatorios')
  }

  // Siempre exige confirmación con contraseña de admin
  if (!userId) throw new Error('Usuario no identificado')
  await verifyAdminPassword(userId, adminPassword)

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) throw new Error('Producto no encontrado')

  const entryDate = date ? new Date(`${date}T12:00:00.000-04:00`) : new Date()

  return prisma.productionEntry.create({
    data: {
      productId,
      quantity,
      notes,
      date: entryDate,
      createdBy: userId
    },
    include: {
      product: { select: { id: true, name: true, unit: true, category: true } },
      creator: { select: { id: true, name: true } }
    }
  })
}

interface UpdateProductionInput {
  quantity: number
  notes?: string
  date?: string
  adminPassword?: string
}

/**
 * Modifica una entrada de producción existente (ej: si se equivocó y era 95 en vez de 100).
 * Requiere confirmación con la contraseña de administrador.
 */
export const updateProductionEntry = async (
  id: number,
  data: UpdateProductionInput,
  userId: number
) => {
  const { quantity, notes, date, adminPassword } = data

  if (quantity === 0 || isNaN(quantity)) {
    throw new Error('La cantidad no puede ser 0')
  }

  const existing = await prisma.productionEntry.findUnique({ where: { id } })
  if (!existing) throw new Error('Entrada de producción no encontrada')

  // Requiere contraseña de admin para autorizar modificación
  await verifyAdminPassword(userId, adminPassword)

  const entryDate = date ? new Date(`${date}T12:00:00.000-04:00`) : existing.date

  return prisma.productionEntry.update({
    where: { id },
    data: {
      quantity,
      notes,
      date: entryDate
    },
    include: {
      product: { select: { id: true, name: true, unit: true, category: true } },
      creator: { select: { id: true, name: true } }
    }
  })
}

/**
 * Elimina una entrada de producción. Requiere contraseña de administrador.
 */
export const deleteProductionEntry = async (id: number, userId?: number, adminPassword?: string) => {
  const entry = await prisma.productionEntry.findUnique({ where: { id } })
  if (!entry) throw new Error('Entrada de producción no encontrada')

  if (userId) {
    await verifyAdminPassword(userId, adminPassword)
  }

  return prisma.productionEntry.delete({ where: { id } })
}

/**
 * Obtiene el historial de entradas de producción con filtros
 */
export const getProductionEntries = async (filters: {
  productId?: number
  startDate?: string
  endDate?: string
  limit?: number
}) => {
  const where: any = {}

  if (filters.productId) {
    where.productId = Number(filters.productId)
  }

  if (filters.startDate || filters.endDate) {
    const dateClause: any = {}
    if (filters.startDate) {
      dateClause.gte = new Date(`${filters.startDate}T00:00:00.000-04:00`)
    }
    if (filters.endDate) {
      dateClause.lte = new Date(`${filters.endDate}T23:59:59.999-04:00`)
    }
    where.date = dateClause
  }

  return prisma.productionEntry.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, unit: true, category: true } },
      creator: { select: { id: true, name: true } }
    },
    orderBy: { date: 'desc' },
    take: filters.limit || 100
  })
}

/**
 * Calcula el balance integral de almacén / Kardex en vivo:
 * Para cada producto:
 * - Producción / Entradas ingresadas
 * - Ventas entregadas
 * - Bonificaciones entregadas
 * - Devoluciones de distribuidores al almacén
 * - Mercadería actualmente en ruta (camionetas)
 * - Stock físico disponible en almacén
 */
export const getWarehouseStockBalance = async (filters: {
  startDate?: string
  endDate?: string
  category?: string
}) => {
  const productWhere: any = {}
  if (filters.category && filters.category !== 'all') {
    productWhere.category = filters.category
  }

  const products = await prisma.product.findMany({
    where: {
      ...productWhere,
      trackInventory: true
    },
    orderBy: { name: 'asc' }
  })

  // Filtro de fecha para producción si se especifica
  const prodWhere: any = {}
  if (filters.startDate || filters.endDate) {
    const dateClause: any = {}
    if (filters.startDate) dateClause.gte = new Date(`${filters.startDate}T00:00:00.000-04:00`)
    if (filters.endDate) dateClause.lte = new Date(`${filters.endDate}T23:59:59.999-04:00`)
    prodWhere.date = dateClause
  }

  // Traer todas las entradas de producción
  const productionEntries = await prisma.productionEntry.findMany({
    where: prodWhere
  })

  // Filtro de fecha para pedidos
  const orderWhere: any = {}
  if (filters.startDate || filters.endDate) {
    const dateClause: any = {}
    if (filters.startDate) dateClause.gte = new Date(`${filters.startDate}T00:00:00.000-04:00`)
    if (filters.endDate) dateClause.lte = new Date(`${filters.endDate}T23:59:59.999-04:00`)
    orderWhere.createdAt = dateClause
  }

  // Traer los items de pedidos
  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: orderWhere,
      ...(productWhere.category ? { product: productWhere } : {})
    },
    include: {
      order: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          deliveredAt: true
        }
      }
    }
  })

  // Estructura de consolidación por producto
  const map = new Map<number, {
    product: {
      id: number
      name: string
      unit: string
      price: number
      category: string
      isActive: boolean
    }
    totalProducido: number
    totalVendidoRegular: number
    totalEntregadaBonif: number
    totalDevuelto: number
    totalEnRuta: number
    stockAlmacen: number
    entradasCount: number
  }>()

  for (const p of products) {
    map.set(p.id, {
      product: {
        id: p.id,
        name: p.name,
        unit: p.unit,
        price: p.price,
        category: p.category,
        isActive: p.isActive
      },
      totalProducido: 0,
      totalVendidoRegular: 0,
      totalEntregadaBonif: 0,
      totalDevuelto: 0,
      totalEnRuta: 0,
      stockAlmacen: 0,
      entradasCount: 0
    })
  }

  // Sumar entradas de producción
  for (const entry of productionEntries) {
    const item = map.get(entry.productId)
    if (item) {
      item.totalProducido += entry.quantity
      item.entradasCount++
    }
  }

  // Analizar movimientos de pedidos
  for (const it of orderItems) {
    const item = map.get(it.productId)
    if (!item) continue

    const status = it.order.status
    const isDelivered = status === 'entregado' || status === 'entrega_parcial'
    const isPending = status === 'pendiente' || status === 'aceptado' || status === 'asignado'

    const orderedQty = it.quantity
    const deliveredQty = isDelivered ? (it.deliveredQuantity ?? it.quantity) : 0
    const returnedQty = isDelivered ? Math.max(0, orderedQty - deliveredQty) : 0

    if (it.isBonification) {
      if (isDelivered) {
        item.totalEntregadaBonif += deliveredQty
        item.totalDevuelto += returnedQty
      } else if (isPending) {
        item.totalEnRuta += orderedQty
      }
    } else {
      if (isDelivered) {
        item.totalVendidoRegular += deliveredQty
        item.totalDevuelto += returnedQty
      } else if (isPending) {
        item.totalEnRuta += orderedQty
      }
    }
  }

  // Calcular stock físico en almacén para cada producto
  // Stock en Bodega = (Total Producido + Total Devuelto) - (Total Vendido + Total Bonificaciones + Total En Ruta)
  const results = Array.from(map.values()).map(item => {
    const stockActual = (item.totalProducido + item.totalDevuelto) - (item.totalVendidoRegular + item.totalEntregadaBonif + item.totalEnRuta)
    return {
      ...item,
      stockAlmacen: stockActual
    }
  })

  // Totales generales
  const summary = {
    totalProductos: products.length,
    totalProducido: results.reduce((acc, r) => acc + r.totalProducido, 0),
    totalVendidoRegular: results.reduce((acc, r) => acc + r.totalVendidoRegular, 0),
    totalEntregadaBonif: results.reduce((acc, r) => acc + r.totalEntregadaBonif, 0),
    totalDevuelto: results.reduce((acc, r) => acc + r.totalDevuelto, 0),
    totalEnRuta: results.reduce((acc, r) => acc + r.totalEnRuta, 0),
    totalStockAlmacen: results.reduce((acc, r) => acc + r.stockAlmacen, 0)
  }

  return {
    summary,
    products: results
  }
}
