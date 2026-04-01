import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import * as service from './distributor.service'

export const getMyOrders = async (req: AuthRequest, res: Response) => {
    try {
        const orders = await service.getMyOrders(req.user!.id)
        res.json(orders)
    } catch (error: any) {
        res.status(500).json({ message: error.message })
    }
}

export const getMyOrderById = async (req: AuthRequest, res: Response) => {
    try {
        const order = await service.getMyOrderById(
            Number(req.params.id),
            req.user!.id
        )
        res.json(order)
    } catch (error: any) {
        res.status(404).json({ message: error.message })
    }
}

export const deliverOrder = async (req: AuthRequest, res: Response) => {
    try {
        const order = await service.deliverOrder(
            Number(req.params.id),
            req.user!.id
        )
        res.json({ message: 'Pedido entregado correctamente', order })
    } catch (error: any) {
        res.status(400).json({ message: error.message })
    }
}