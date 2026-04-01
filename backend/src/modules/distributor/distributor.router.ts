import { Router } from 'express'
import { getMyOrders, getMyOrderById, deliverOrder } from './distributor.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { authorize } from '../../middlewares/role.middleware'

const router = Router()

router.use(authenticate, authorize('distribuidor'))

router.get('/orders', getMyOrders)
router.get('/orders/:id', getMyOrderById)
router.patch('/orders/:id/deliver', deliverOrder)

export default router