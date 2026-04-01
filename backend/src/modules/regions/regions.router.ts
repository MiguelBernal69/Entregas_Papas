import { Router } from 'express'
import { getAll, getOne, create, update, remove, getOrdersInRegion, detectRegion } from './regions.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { authorize } from '../../middlewares/role.middleware'

const router = Router()

router.use(authenticate, authorize('admin'))

// Rutas específicas antes que las de parámetros
router.get('/detect', detectRegion)
router.get('/:id/orders', getOrdersInRegion)

router.get('/', getAll)
router.get('/:id', getOne)
router.post('/', create)
router.put('/:id', update)
router.delete('/:id', remove)

export default router