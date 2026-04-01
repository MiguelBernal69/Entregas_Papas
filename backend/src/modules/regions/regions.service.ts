import prisma from '../../prisma/client'
import pool from '../../config/db'

const geojsonToWKT = (coordinates: number[][][]): string => {
  const points = coordinates[0].map(p => `${p[0]} ${p[1]}`).join(', ')
  return `POLYGON((${points}))`
}

export const getAllRegions = async () => {
  const result = await pool.query(`
    SELECT 
      r.id, r.name, r.color, r."createdAt",
      u.name as "creatorName",
      ST_AsGeoJSON(r.polygon)::json as polygon
    FROM "Region" r
    LEFT JOIN "User" u ON u.id = r."createdBy"
    ORDER BY r."createdAt" DESC
  `)
  return result.rows
}

export const getRegionById = async (id: number) => {
  const result = await pool.query(`
    SELECT 
      r.id, r.name, r.color, r."createdAt",
      u.name as "creatorName",
      ST_AsGeoJSON(r.polygon)::json as polygon
    FROM "Region" r
    LEFT JOIN "User" u ON u.id = r."createdBy"
    WHERE r.id = $1
  `, [id])

  if (!result.rows.length) throw new Error('Región no encontrada')
  return result.rows[0]
}

export const createRegion = async (
  data: { name: string; color?: string; polygon: any },
  createdBy: number
) => {
  if (!data.polygon?.coordinates) throw new Error('Polígono GeoJSON inválido')

  const wkt = geojsonToWKT(data.polygon.coordinates)

  const region = await prisma.region.create({
    data: {
      name: data.name,
      color: data.color ?? '#3B82F6',
      createdBy
    }
  })

  await pool.query(
    `UPDATE "Region" SET polygon = ST_GeomFromText($1, 4326) WHERE id = $2`,
    [wkt, region.id]
  )

  // Asignar automáticamente la región a todos los clientes que caen dentro del polígono
  await pool.query(`
    UPDATE "Client"
    SET "regionId" = $1
    WHERE ST_Within(
      ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
      (SELECT polygon FROM "Region" WHERE id = $1)
    )
  `, [region.id])

  // Propagar también a pedidos activos de esos clientes
  await pool.query(`
    UPDATE "Order" o
    SET "regionId" = $1
    FROM "Client" c
    WHERE o."clientId" = c.id
      AND c."regionId" = $1
      AND o.status IN ('pendiente', 'aceptado', 'asignado')
  `, [region.id])

  return getRegionById(region.id)
}

export const updateRegion = async (
  id: number,
  data: { name?: string; color?: string; polygon?: any }
) => {
  const existing = await prisma.region.findUnique({ where: { id } })
  if (!existing) throw new Error('Región no encontrada')

  if (data.name || data.color) {
    await prisma.region.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.color && { color: data.color })
      }
    })
  }

  if (data.polygon?.coordinates) {
    const wkt = geojsonToWKT(data.polygon.coordinates)
    await pool.query(
      `UPDATE "Region" SET polygon = ST_GeomFromText($1, 4326) WHERE id = $2`,
      [wkt, id]
    )
  }

  return getRegionById(id)
}

export const deleteRegion = async (id: number) => {
  const existing = await prisma.region.findUnique({ where: { id } })
  if (!existing) throw new Error('Región no encontrada')

  // Limpiar regionId de clientes y pedidos activos que pertenecían a esta región
  await pool.query(
    `UPDATE "Order" SET "regionId" = NULL WHERE "regionId" = $1 AND status IN ('pendiente', 'aceptado', 'asignado')`,
    [id]
  )
  await prisma.client.updateMany({
    where: { regionId: id },
    data: { regionId: null }
  })

  await prisma.region.delete({ where: { id } })
  return { message: 'Región eliminada' }
}

export const getOrdersByRegion = async (id: number) => {
  const existing = await prisma.region.findUnique({ where: { id } })
  if (!existing) throw new Error('Región no encontrada')

  const result = await pool.query(`
    SELECT 
      o.id, o.status, o."createdAt", o.notes,
      c.name as "clientName", c.address,
      c.latitude, c.longitude,
      u.name as "preventistaName"
    FROM "Order" o
    JOIN "Client" c ON c.id = o."clientId"
    JOIN "User" u ON u.id = o."preventistaId"
    JOIN "Region" r ON r.id = $1
    WHERE ST_Within(
      ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4326),
      r.polygon
    )
    AND o.status = 'aceptado'
    ORDER BY o."createdAt" DESC
  `, [id])

  return result.rows
}

export const getRegionByPoint = async (latitude: number, longitude: number) => {
  const result = await pool.query(`
    SELECT id, name, color
    FROM "Region"
    WHERE ST_Within(
      ST_SetSRID(ST_MakePoint($1, $2), 4326),
      polygon
    )
    LIMIT 1
  `, [longitude, latitude])

  return result.rows[0] ?? null
}

export const recalculateAllRegions = async () => {
  // 1. Limpiar regionId de todos los clientes
  await pool.query(`UPDATE "Client" SET "regionId" = NULL`)

  // 2. Asignar la región correcta a cada cliente según su ubicación (PostGIS)
  await pool.query(`
    UPDATE "Client" c
    SET "regionId" = r.id
    FROM "Region" r
    WHERE r.polygon IS NOT NULL
      AND ST_Within(
        ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4326),
        r.polygon
      )
  `)

  // 3. Contar clientes actualizados
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM "Client" WHERE "regionId" IS NOT NULL`
  )

  // 4. Propaggar regionId a pedidos activos de cada cliente
  await pool.query(`
    UPDATE "Order" o
    SET "regionId" = c."regionId"
    FROM "Client" c
    WHERE o."clientId" = c.id
      AND o.status IN ('pendiente', 'aceptado', 'asignado')
  `)

  const ordersResult = await pool.query(
    `SELECT COUNT(*) as total FROM "Order" WHERE "regionId" IS NOT NULL AND status IN ('pendiente', 'aceptado', 'asignado')`
  )

  return {
    clientesAsignados: Number(countResult.rows[0].total),
    pedidosActualizados: Number(ordersResult.rows[0].total)
  }
}