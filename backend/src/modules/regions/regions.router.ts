import { Router } from 'express'
import { getAll, getOne, create, update, remove, getOrdersInRegion, detectRegion, recalculate } from './regions.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { authorize } from '../../middlewares/role.middleware'

const router = Router()

router.use(authenticate)

// Recalcular todas las zonas (solo admin)
router.post('/recalculate', authorize('admin'), recalculate)

// Rutas de lectura y utilidades permitidas para admin y preventista
router.get('/', authorize('admin', 'preventista'), getAll)
router.get('/detect', authorize('admin', 'preventista'), detectRegion)
router.get('/:id', authorize('admin', 'preventista'), getOne)

// Rutas de administración exclusivas para admin
router.get('/:id/orders', authorize('admin'), getOrdersInRegion)
router.post('/', authorize('admin'), create)
router.put('/:id', authorize('admin'), update)
router.delete('/:id', authorize('admin'), remove)

export default router