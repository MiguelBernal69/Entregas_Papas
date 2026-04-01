import prisma from '../../prisma/client'

export const getAllClients = async () => {
  return prisma.client.findMany({
    where: { isActive: true },
    include: {
      creator: { select: { id: true, name: true } },
      region: { select: { id: true, name: true, color: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
}

export const getClientById = async (id: number) => {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
      region: { select: { id: true, name: true, color: true } },
      orders: {
        select: { id: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5 // últimos 5 pedidos
      }
    }
  })
  if (!client) throw new Error('Cliente no encontrado')
  return client
}

export const createClient = async (
  data: {
    name: string
    ownerName: string
    phone: string
    address: string
    latitude: number
    longitude: number
    regionId?: number
    photoUrl?: string
  },
  createdBy: number
) => {
  return prisma.client.create({
    data: { ...data, createdBy },
    include: {
      creator: { select: { id: true, name: true } },
      region: { select: { id: true, name: true } }
    }
  })
}

export const updateClient = async (
  id: number,
  data: {
    name?: string
    ownerName?: string
    phone?: string
    address?: string
    latitude?: number
    longitude?: number
    regionId?: number
    photoUrl?: string
  }
) => {
  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) throw new Error('Cliente no encontrado')

  return prisma.client.update({
    where: { id },
    data,
    include: {
      creator: { select: { id: true, name: true } },
      region: { select: { id: true, name: true } }
    }
  })
}

export const deleteClient = async (id: number) => {
  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) throw new Error('Cliente no encontrado')

  // Soft delete — no borra, solo desactiva
  return prisma.client.update({
    where: { id },
    data: { isActive: false }
  })
}