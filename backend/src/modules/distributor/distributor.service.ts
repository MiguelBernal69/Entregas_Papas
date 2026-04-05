import prisma from '../../prisma/client'
import pool from '../../config/db'

export const getMyOrders = async (distributorId: number, statusQuery?: string) => {
    // Si no manda query, por defecto traemos asignado y entregado para que pueda sacar stats,
    // o sino lo que mande por query (ej. 'asignado').
    let statusFilter: any = { in: ['asignado', 'entregado'] }
    
    if (statusQuery) {
        statusFilter = statusQuery
    }

    return prisma.order.findMany({
        where: {
            distributorId,
            status: statusFilter
        },
        include: {
            client: {
                select: {
                    id: true,
                    name: true,
                    ownerName: true,
                    phone: true,
                    address: true,
                    latitude: true,
                    longitude: true
                }
            },
            items: {
                include: {
                    product: { select: { id: true, name: true, unit: true } }
                }
            },
            region: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' }
    })
}

export const getMyOrderById = async (orderId: number, distributorId: number) => {
    const order = await prisma.order.findFirst({
        where: {
            id: orderId,
            distributorId
        },
        include: {
            client: true,
            items: {
                include: {
                    product: { select: { id: true, name: true, unit: true } }
                }
            },
            region: { select: { id: true, name: true } }
        }
    })

    if (!order) throw new Error('Pedido no encontrado o no te pertenece')
    return order
}

export const deliverOrder = async (orderId: number, distributorId: number) => {
    // Verificar que el pedido pertenece a este distribuidor
    const order = await prisma.order.findFirst({
        where: { id: orderId, distributorId, status: 'asignado' }
    })

    if (!order) throw new Error('Pedido no encontrado, no te pertenece o ya fue entregado')

    // Marcar como entregado
    const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
            status: 'entregado',
            deliveredAt: new Date()
        }
    })

    // Guardar historial con snapshot usando pool para evitar problemas con el adapter
    const snapshot = await buildSnapshot(orderId)
    await prisma.orderHistory.create({
        data: {
            orderId,
            changedBy: distributorId,
            action: 'delivered',
            previousStatus: 'asignado',
            newStatus: 'entregado',
            snapshotData: snapshot
        }
    })

    return updated
}

// Helper para construir snapshot del pedido
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
            deliveredAt: order.deliveredAt,
            createdAt: order.createdAt
        },
        client: {
            id: order.client.id,
            name: order.client.name,
            ownerName: order.client.ownerName,
            address: order.client.address,
            latitude: order.client.latitude,
            longitude: order.client.longitude,
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