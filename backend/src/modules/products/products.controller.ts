import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import * as service from './products.service'

export const getAll = async (req: AuthRequest, res: Response) => {
  try {
    // Preventistas solo ven productos activos
    const onlyActive = req.user?.role === 'preventista'
    const products = await service.getAllProducts(onlyActive)
    res.json(products)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export const getOne = async (req: AuthRequest, res: Response) => {
  try {
    const product = await service.getProductById(Number(req.params.id))
    res.json(product)
  } catch (error: any) {
    res.status(404).json({ message: error.message })
  }
}

export const create = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, price, unit } = req.body

    if (!name || !price || !unit) {
      res.status(400).json({ message: 'name, price y unit son requeridos' })
      return
    }

    const product = await service.createProduct({
      name,
      description,
      price: Number(price),
      unit
    })
    res.status(201).json(product)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const update = async (req: AuthRequest, res: Response) => {
  try {
    const data: any = { ...req.body }
    if (data.price) data.price = Number(data.price)

    const product = await service.updateProduct(Number(req.params.id), data)
    res.json(product)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const toggle = async (req: AuthRequest, res: Response) => {
  try {
    const product = await service.toggleProduct(Number(req.params.id))
    res.json(product)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const remove = async (req: AuthRequest, res: Response) => {
  try {
    await service.deleteProduct(Number(req.params.id))
    res.json({ message: 'Producto eliminado correctamente' })
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}