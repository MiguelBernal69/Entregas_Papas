import { Router } from 'express'
import {
  getAll,
  getInventoryStats,
  getStockBalance,
  getProductionList,
  addProduction,
  updateProduction,
  removeProduction,
  getOne,
  create,
  update,
  toggle,
  remove,
  purge
} from './products.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { authorize } from '../../middlewares/role.middleware'

const router = Router()

router.use(authenticate)

router.get('/', authorize('admin', 'preventista'), getAll)
router.get('/inventory-stats', authorize('admin'), getInventoryStats)
router.get('/stock-balance', authorize('admin'), getStockBalance)
router.get('/production', authorize('admin'), getProductionList)
router.post('/production', authorize('admin'), addProduction)
router.put('/production/:id', authorize('admin'), updateProduction)
router.delete('/production/:id', authorize('admin'), removeProduction)
router.get('/:id', authorize('admin', 'preventista'), getOne)
router.post('/', authorize('admin'), create)
router.put('/:id', authorize('admin'), update)
router.patch('/:id/toggle', authorize('admin'), toggle)
router.delete('/:id', authorize('admin'), remove)
router.delete('/:id/purge', authorize('admin'), purge)

export default router