import prisma from '../../prisma/client'

/**
 * Abre una nueva sesión de distribución (por carga).
 * Un distribuidor puede tener múltiples sesiones históricas, pero solo una activa.
 */
export const openSession = async (distributorId: number) => {
    // Verificar que no tenga una sesión activa
    const existing = await prisma.distributionSession.findFirst({
        where: { distributorId, status: 'activa' }
    })

    if (existing) {
        throw new Error('Ya tienes una sesión de distribución activa. Ciérrala antes de abrir otra.')
    }

    return prisma.distributionSession.create({
        data: { distributorId }
    })
}

/**
 * Obtiene la sesión activa del distribuidor (o null)
 */
export const getActiveSession = async (distributorId: number) => {
    const session = await prisma.distributionSession.findFirst({
        where: { distributorId, status: 'activa' },
        include: {
            distributor: { select: { id: true, name: true } }
        }
    })

    return session // puede ser null
}

/**
 * Calcula el reporte de la sesión activa:
 * - Productos vendidos (entregados + entrega_parcial)
 * - Productos devueltos (diferencia quantity - deliveredQuantity)
 * - Dinero recaudado
 * - Puntos de entrega visitados
 * - Stock restante en camioneta (pedidos aún asignados)
 */
export const getSessionReport = async (distributorId: number) => {
    const session = await prisma.distributionSession.findFirst({
        where: { distributorId, status: 'activa' }
    })

    if (!session) {
        throw new Error('No tienes una sesión activa')
    }

    // Pedidos desde que se abrió la sesión
    const orders = await prisma.order.findMany({
        where: {
            distributorId,
            OR: [
                // Pedidos actualmente asignados (en camioneta, pendientes de entregar)
                // Sin filtro de fecha: solo los que siguen en estado 'asignado' son los de hoy
                { status: 'asignado' },
                // Pedidos rechazados DURANTE esta sesión (filtrado por fecha de cierre/rechazo)
                {
                    status: 'rechazado',
                    deliveredAt: { gte: session.openedAt }
                },
                // Pedidos entregados/parciales durante esta sesión
                {
                    status: { in: ['entregado', 'entrega_parcial'] },
                    deliveredAt: { gte: session.openedAt }
                }
            ]
        },
        include: {
            client: { select: { id: true, name: true, address: true } },
            items: {
                include: {
                    product: { select: { id: true, name: true, unit: true } }
                }
            }
        }
    })

    // Métricas
    let totalRecaudado = 0
    let puntosEntregados = 0
    let pedidosPendientes = 0
    let pedidosRechazados = 0

    // Key = productId para evitar colisión de nombres
    // Separado en regulares y bonificaciones
    const regularVendidos: Record<string, { productId: number; name: string; unit: string; cantidadPedida: number; cantidadEntregada: number; cantidadDevuelta: number; monto: number }> = {}
    const bonificacionesVendidas: Record<string, { productId: number; name: string; unit: string; cantidadPedida: number; cantidadEntregada: number }> = {}
    const stockEnCamioneta: Record<string, { productId: number; name: string; unit: string; cantidad: number }> = {}

    for (const order of orders) {
        const status = order.status

        if (status === 'entregado' || status === 'entrega_parcial') {
            puntosEntregados++

            for (const item of order.items) {
                const isBoni = item.isBonification
                const delivered = item.deliveredQuantity ?? item.quantity
                const devuelto = item.quantity - delivered
                // Bonificaciones no suman dinero (unitPrice=0, pero lo hacemos explícito)
                const monto = isBoni ? 0 : delivered * item.unitPrice
                totalRecaudado += monto

                const key = String(item.productId)

                if (isBoni) {
                    // Acumular bonificaciones por separado
                    if (!bonificacionesVendidas[key]) {
                        bonificacionesVendidas[key] = {
                            productId: item.productId,
                            name: item.product.name,
                            unit: item.product.unit,
                            cantidadPedida: 0,
                            cantidadEntregada: 0
                        }
                    }
                    bonificacionesVendidas[key].cantidadPedida += item.quantity
                    bonificacionesVendidas[key].cantidadEntregada += delivered
                } else {
                    // Acumular productos regulares vendidos
                    if (!regularVendidos[key]) {
                        regularVendidos[key] = {
                            productId: item.productId,
                            name: item.product.name,
                            unit: item.product.unit,
                            cantidadPedida: 0,
                            cantidadEntregada: 0,
                            cantidadDevuelta: 0,
                            monto: 0
                        }
                    }
                    regularVendidos[key].cantidadPedida += item.quantity
                    regularVendidos[key].cantidadEntregada += delivered
                    regularVendidos[key].cantidadDevuelta += devuelto
                    regularVendidos[key].monto += monto

                    // Devueltos de regulares vuelven al stock físico
                    if (devuelto > 0) {
                        if (!stockEnCamioneta[key]) {
                            stockEnCamioneta[key] = {
                                productId: item.productId,
                                name: item.product.name,
                                unit: item.product.unit,
                                cantidad: 0
                            }
                        }
                        stockEnCamioneta[key].cantidad += devuelto
                    }
                }
            }
        } else if (status === 'asignado') {
            pedidosPendientes++

            for (const item of order.items) {
                if (item.isBonification) continue // bonificaciones no cuentan en stock físico del camión
                const key = String(item.productId)
                if (!stockEnCamioneta[key]) {
                    stockEnCamioneta[key] = {
                        productId: item.productId,
                        name: item.product.name,
                        unit: item.product.unit,
                        cantidad: 0
                    }
                }
                stockEnCamioneta[key].cantidad += item.quantity
            }
        } else if (status === 'rechazado') {
            pedidosRechazados++

            // Pedido rechazado: todos los ítems regulares vuelven al stock del camión
            for (const item of order.items) {
                if (item.isBonification) continue
                const key = String(item.productId)
                if (!stockEnCamioneta[key]) {
                    stockEnCamioneta[key] = {
                        productId: item.productId,
                        name: item.product.name,
                        unit: item.product.unit,
                        cantidad: 0
                    }
                }
                stockEnCamioneta[key].cantidad += item.quantity
            }
        }
    }

    return {
        session: {
            id: session.id,
            openedAt: session.openedAt,
            status: session.status
        },
        resumen: {
            totalRecaudado,
            puntosEntregados,
            pedidosPendientes,
            pedidosRechazados,
            totalPedidos: orders.length
        },
        productosVendidos: Object.values(regularVendidos),
        bonificacionesEntregadas: Object.values(bonificacionesVendidas),
        stockEnCamioneta: Object.values(stockEnCamioneta),
        pedidos: orders.map(o => ({
            id: o.id,
            status: o.status,
            client: o.client,
            items: o.items.map(i => ({
                productName: i.product.name,
                unit: i.product.unit,
                quantity: i.quantity,
                deliveredQuantity: i.deliveredQuantity,
                unitPrice: i.unitPrice,
                isBonification: i.isBonification
            }))
        }))
    }
}

/**
 * Admin cierra una sesión de distribución.
 * Guarda un snapshot del reporte al momento del cierre.
 */
export const closeSession = async (sessionId: number, adminId?: number, notes?: string) => {
    const session = await prisma.distributionSession.findUnique({
        where: { id: sessionId }
    })

    if (!session) throw new Error('Sesión no encontrada')
    if (session.status === 'cerrada') throw new Error('La sesión ya está cerrada')

    // Generar reporte para el snapshot
    const report = await getSessionReport(session.distributorId)

    return prisma.distributionSession.update({
        where: { id: sessionId },
        data: {
            status: 'cerrada',
            closedAt: new Date(),
            ...(adminId && { closedByAdminId: adminId }),
            notes,
            snapshotData: report as any
        },
        include: {
            distributor: { select: { id: true, name: true } },
            closedByAdmin: { select: { id: true, name: true } }
        }
    })
}

/**
 * Lista todas las sesiones (para admin) con filtros opcionales
 */
export const getAllSessions = async (filters?: {
    distributorId?: number
    status?: 'activa' | 'cerrada'
}) => {
    return prisma.distributionSession.findMany({
        where: {
            ...(filters?.distributorId && { distributorId: filters.distributorId }),
            ...(filters?.status && { status: filters.status })
        },
        include: {
            distributor: { select: { id: true, name: true } },
            closedByAdmin: { select: { id: true, name: true } }
        },
        orderBy: { openedAt: 'desc' }
    })
}

/**
 * Obtiene una sesión por ID con su snapshot
 */
export const getSessionById = async (sessionId: number) => {
    const session = await prisma.distributionSession.findUnique({
        where: { id: sessionId },
        include: {
            distributor: { select: { id: true, name: true } },
            closedByAdmin: { select: { id: true, name: true } }
        }
    })

    if (!session) throw new Error('Sesión no encontrada')

    // Si está activa, generar reporte en vivo
    if (session.status === 'activa') {
        const liveReport = await getSessionReport(session.distributorId)
        return { ...session, liveReport }
    }

    return session
}
