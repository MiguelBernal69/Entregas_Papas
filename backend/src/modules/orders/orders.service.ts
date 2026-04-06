import prisma from '../../prisma/client'
import { OrderAction, OrderStatus } from '../../generated/prisma'

// ─── helpers ───────────────────────────────────────────────

const buildSnapshot = async (orderId: number) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      client: { include: { region: true } },
      preventista: { select: { id: true, name: true } },
      distributor: { select: { id: true, name: true } },
      items: { include: { product: { select: { name: true } } } }
    }
  })

  if (!order) throw new Error('Pedido no encontrado')

  const total = order.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)

  return {
    order: {
      id: order.id,
      status: order.status,
      notes: order.notes,
      createdAt: order.createdAt
    },
    client: {
      id: order.client.id,
      name: order.client.name,
      ownerName: order.client.ownerName,
      phone: order.client.phone,
      address: order.client.address,
      latitude: order.client.latitude,
      longitude: order.client.longitude,
      photoUrl: order.client.photoUrl,
      region: order.client.region?.name ?? null
    },
    preventista: order.preventista,
    distribuidor: order.distributor ?? null,
    items: order.items.map(i => ({
      productName: i.product.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice
    })),
    total
  }
}

const saveHistory = async (
  orderId: number,
  changedBy: number,
  action: OrderAction,
  previousStatus: OrderStatus | null,
  newStatus: OrderStatus
) => {
  const snapshot = await buildSnapshot(orderId)

  await prisma.orderHistory.create({
    data: {
      orderId,
      changedBy,
      action,
      previousStatus: previousStatus ?? undefined,
      newStatus,
      snapshotData: snapshot
    }
  })
}

// ─── servicios ─────────────────────────────────────────────

export const getAllOrders = async (filters: {
  status?: OrderStatus
  regionId?: number
  preventistaId?: number
}) => {
  return prisma.order.findMany({
    where: {
      ...(filters.status && { status: filters.status }),
      ...(filters.regionId && { regionId: filters.regionId }),
      ...(filters.preventistaId && { preventistaId: filters.preventistaId })
    },
    include: {
      client: { select: { id: true, name: true, ownerName: true, phone: true, address: true, latitude: true, longitude: true, photoUrl: true } },
      preventista: { select: { id: true, name: true } },
      distributor: { select: { id: true, name: true } },
      region: { select: { id: true, name: true, color: true } },
      items: { include: { product: { select: { id: true, name: true } } } }
    },
    orderBy: { createdAt: 'desc' }
  })
}

export const getOrderById = async (id: number) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      client: true,
      preventista: { select: { id: true, name: true } },
      distributor: { select: { id: true, name: true } },
      region: { select: { id: true, name: true } },
      items: { include: { product: true } },
      history: { orderBy: { createdAt: 'asc' } }
    }
  })
  if (!order) throw new Error('Pedido no encontrado')
  return order
}

export const createOrder = async (
  data: {
    clientId: number
    notes?: string
    items: { productId: number; quantity: number }[]
  },
  preventistaId: number
) => {
  if (!data.items || data.items.length === 0) {
    throw new Error('El pedido debe tener al menos un producto')
  }

  const productIds = data.items.map(i => i.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true }
  })

  if (products.length !== productIds.length) {
    throw new Error('Uno o más productos no existen o están inactivos')
  }

  const client = await prisma.client.findUnique({ where: { id: data.clientId } })
  if (!client) throw new Error('Cliente no encontrado')

  // Crear pedido + items en una sola transacción
  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        clientId: data.clientId,
        preventistaId,
        regionId: client.regionId,
        notes: data.notes,
        status: 'aceptado',
        items: {
          create: data.items.map(item => {
            const product = products.find(p => p.id === item.productId)!
            return {
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: product.price
            }
          })
        }
      }
    })
    return newOrder
  })

  // Historial DESPUÉS de que la transacción terminó
  await saveHistory(order.id, preventistaId, 'created', null, 'aceptado')

  return getOrderById(order.id)
}

export const updateOrder = async (
  id: number,
  data: {
    notes?: string
    items?: { productId: number; quantity: number }[]
  },
  userId: number
) => {
  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) throw new Error('Pedido no encontrado')

  if (!['pendiente', 'aceptado'].includes(order.status)) {
    throw new Error('Solo se pueden editar pedidos en estado pendiente o aceptado')
  }

  await prisma.$transaction(async (tx) => {
    // Actualizar notas
    if (data.notes !== undefined) {
      await tx.order.update({ where: { id }, data: { notes: data.notes } })
    }

    // Si mandan nuevos items, reemplazar todos
    if (data.items && data.items.length > 0) {
      const productIds = data.items.map(i => i.productId)
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, isActive: true }
      })

      if (products.length !== productIds.length) {
        throw new Error('Uno o más productos no existen o están inactivos')
      }

      // Borrar items anteriores
      await tx.orderItem.deleteMany({ where: { orderId: id } })

      // Crear nuevos items
      await tx.orderItem.createMany({
        data: data.items.map(item => {
          const product = products.find(p => p.id === item.productId)!
          return {
            orderId: id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: product.price
          }
        })
      })
    }
  })

  await saveHistory(id, userId, 'updated', order.status, order.status)

  return getOrderById(id)
}

export const changeOrderStatus = async (
  id: number,
  newStatus: OrderStatus,
  userId: number
) => {
  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) throw new Error('Pedido no encontrado')

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status: newStatus,
      ...(newStatus === 'entregado' && { deliveredAt: new Date() })
    }
  })

  await saveHistory(id, userId, 'status_changed', order.status, newStatus)

  return updated
}

export const assignOrders = async (
  orderIds: number[],
  distributorId: number,
  adminId: number
) => {
  const distributor = await prisma.user.findUnique({ where: { id: distributorId } })
  if (!distributor || distributor.role !== 'distribuidor') {
    throw new Error('Distribuidor no válido')
  }

  // Verificar que todos los pedidos existen y están en estado aceptado
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } }
  })

  if (orders.length !== orderIds.length) {
    throw new Error('Uno o más pedidos no existen')
  }

  const notAccepted = orders.filter(o => o.status !== 'aceptado')
  if (notAccepted.length > 0) {
    throw new Error(`Los pedidos ${notAccepted.map(o => o.id).join(', ')} no están en estado aceptado`)
  }

  // Actualizar todos
  await prisma.order.updateMany({
    where: { id: { in: orderIds } },
    data: { distributorId, status: 'asignado' }
  })

  // Historial de cada pedido
  for (const orderId of orderIds) {
    await saveHistory(orderId, adminId, 'assigned', 'aceptado', 'asignado')
  }

  return { assigned: orderIds.length }
}

export const getOrdersForMap = async () => {
  return prisma.order.findMany({
    where: { status: { in: ['aceptado', 'asignado'] } },
    select: {
      id: true,
      status: true,
      regionId: true,
      client: { select: { latitude: true, longitude: true, name: true } }
    }
  })
}
