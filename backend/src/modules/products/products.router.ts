import { Router } from 'express'
import { getAll, getOne, create, update, toggle, remove } from './products.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { authorize } from '../../middlewares/role.middleware'

const router = Router()

router.use(authenticate)

router.get('/', authorize('admin', 'preventista'), getAll)
router.get('/:id', authorize('admin', 'preventista'), getOne)
router.post('/', authorize('admin'), create)
router.put('/:id', authorize('admin'), update)
router.patch('/:id/toggle', authorize('admin'), toggle)
router.delete('/:id', authorize('admin'), remove)

export default router