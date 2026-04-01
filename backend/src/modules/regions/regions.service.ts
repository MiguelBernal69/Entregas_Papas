import prisma from '../../prisma/client'

// GeoJSON polygon que llega del frontend se convierte a WKT para PostGIS
// Ejemplo GeoJSON: { "type": "Polygon", "coordinates": [[[-66.15, -17.38], ...]] }
const geojsonToWKT = (coordinates: number[][][]): string => {
  const points = coordinates[0].map(p => `${p[0]} ${p[1]}`).join(', ')
  return `POLYGON((${points}))`
}

export const getAllRegions = async () => {
  // ST_AsGeoJSON convierte el polígono a GeoJSON para enviarlo al frontend
  const regions = await prisma.$queryRaw<any[]>`
    SELECT 
      r.id, r.name, r.color, r."createdAt",
      u.name as "creatorName",
      ST_AsGeoJSON(r.polygon)::json as polygon
    FROM "Region" r
    LEFT JOIN "User" u ON u.id = r."createdBy"
    ORDER BY r."createdAt" DESC
  `
  return regions
}

export const getRegionById = async (id: number) => {
  const regions = await prisma.$queryRaw<any[]>`
    SELECT 
      r.id, r.name, r.color, r."createdAt",
      u.name as "creatorName",
      ST_AsGeoJSON(r.polygon)::json as polygon
    FROM "Region" r
    LEFT JOIN "User" u ON u.id = r."createdBy"
    WHERE r.id = ${id}
  `
  if (!regions.length) throw new Error('Región no encontrada')
  return regions[0]
}

export const createRegion = async (
  data: { name: string; color?: string; polygon: any },
  createdBy: number
) => {
  if (!data.polygon?.coordinates) throw new Error('Polígono GeoJSON inválido')

  const wkt = geojsonToWKT(data.polygon.coordinates)

  // Crear la región base con Prisma
  const region = await prisma.region.create({
    data: {
      name: data.name,
      color: data.color ?? '#3B82F6',
      createdBy
    }
  })

  // Actualizar el polígono con PostGIS
  // ST_GeomFromText convierte WKT a geometry, 4326 = sistema GPS estándar
  await prisma.$executeRaw`
    UPDATE "Region" 
    SET polygon = ST_GeomFromText(${wkt}, 4326)
    WHERE id = ${region.id}
  `

  return getRegionById(region.id)
}

export const updateRegion = async (
  id: number,
  data: { name?: string; color?: string; polygon?: any }
) => {
  const existing = await prisma.region.findUnique({ where: { id } })
  if (!existing) throw new Error('Región no encontrada')

  // Actualizar campos básicos
  if (data.name || data.color) {
    await prisma.region.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.color && { color: data.color })
      }
    })
  }

  // Actualizar polígono si se mandó uno nuevo
  if (data.polygon?.coordinates) {
    const wkt = geojsonToWKT(data.polygon.coordinates)
    await prisma.$executeRaw`
      UPDATE "Region"
      SET polygon = ST_GeomFromText(${wkt}, 4326)
      WHERE id = ${id}
    `
  }

  return getRegionById(id)
}

export const deleteRegion = async (id: number) => {
  const existing = await prisma.region.findUnique({ where: { id } })
  if (!existing) throw new Error('Región no encontrada')

  await prisma.region.delete({ where: { id } })
  return { message: 'Región eliminada' }
}

export const getOrdersByRegion = async (id: number) => {
  const existing = await prisma.region.findUnique({ where: { id } })
  if (!existing) throw new Error('Región no encontrada')

  // Buscar pedidos cuyos clientes están DENTRO del polígono con ST_Within
  const orders = await prisma.$queryRaw<any[]>`
    SELECT 
      o.id, o.status, o."createdAt", o.notes,
      c.name as "clientName", c.address,
      c.latitude, c.longitude,
      u.name as "preventistaName"
    FROM "Order" o
    JOIN "Client" c ON c.id = o."clientId"
    JOIN "User" u ON u.id = o."preventistaId"
    JOIN "Region" r ON r.id = ${id}
    WHERE ST_Within(
      ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4326),
      r.polygon
    )
    AND o.status = 'aceptado'
    ORDER BY o."createdAt" DESC
  `
  return orders
}

// Detectar en qué región cae un punto (para asignar región al cliente)
export const getRegionByPoint = async (latitude: number, longitude: number) => {
  const regions = await prisma.$queryRaw<any[]>`
    SELECT id, name, color
    FROM "Region"
    WHERE ST_Within(
      ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326),
      polygon
    )
    LIMIT 1
  `
  return regions[0] ?? null
}