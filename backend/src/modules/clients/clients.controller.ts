import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import * as service from './clients.service'
import fs from 'fs'

export const getAll = async (req: AuthRequest, res: Response) => {
  try {
    const clients = await service.getAllClients()
    res.json(clients)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export const getOne = async (req: AuthRequest, res: Response) => {
  try {
    const client = await service.getClientById(Number(req.params.id))
    res.json(client)
  } catch (error: any) {
    res.status(404).json({ message: error.message })
  }
}

export const create = async (req: AuthRequest, res: Response) => {
  try {
    const { name, ownerName, phone, address, latitude, longitude, regionId } = req.body

    if (!name || !ownerName || !phone || !address || !latitude || !longitude) {
      res.status(400).json({ message: 'Faltan campos requeridos' })
      return
    }

    // Si se subió una foto, construimos la URL
    const photoUrl = req.file
      ? `${req.protocol}://${req.get('host')}/uploads/clients/${req.file.filename}`
      : undefined

    const client = await service.createClient(
      {
        name,
        ownerName,
        phone,
        address,
        latitude: Number(latitude),
        longitude: Number(longitude),
        regionId: regionId ? Number(regionId) : undefined,
        photoUrl
      },
      req.user!.id
    )

    res.status(201).json(client)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const update = async (req: AuthRequest, res: Response) => {
  try {
    const updateData: any = { ...req.body }

    // Si se subió nueva foto
    if (req.file) {
      updateData.photoUrl = `${req.protocol}://${req.get('host')}/uploads/clients/${req.file.filename}`

      // Borrar foto anterior si existe
      const existing = await service.getClientById(Number(req.params.id))
      if (existing.photoUrl) {
        const oldPath = existing.photoUrl.split('/uploads/')[1]
        const fullPath = `uploads/${oldPath}`
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
      }
    }

    if (updateData.latitude) updateData.latitude = Number(updateData.latitude)
    if (updateData.longitude) updateData.longitude = Number(updateData.longitude)
    if (updateData.regionId) updateData.regionId = Number(updateData.regionId)

    const client = await service.updateClient(Number(req.params.id), updateData)
    res.json(client)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const remove = async (req: AuthRequest, res: Response) => {
  try {
    await service.deleteClient(Number(req.params.id))
    res.json({ message: 'Cliente desactivado correctamente' })
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}