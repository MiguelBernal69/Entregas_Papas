import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { getOrders, assignOrders } from '../../api/orders'
import { getUsers } from '../../api/users'
import { getRegions } from '../../api/regions'
import type { Order, User } from '../../types'

const statusColor: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  aceptado:  'bg-blue-100 text-blue-700',
  asignado:  'bg-purple-100 text-purple-700',
  entregado: 'bg-green-100 text-green-700'
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [distributors, setDistributors] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number[]>([])
  const [distributorId, setDistributorId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [regions, setRegions] = useState<any[]>([])
  const [assigning, setAssigning] = useState(false)
  const [detail, setDetail] = useState<Order | null>(null)

  const fetchOrders = async () => {
    try {
      const params: any = {}
      if (filterRegion) params.regionId = filterRegion
      const [ordersData, usersData, regionsData] = await Promise.all([
        getOrders(params),
        getUsers(),
        getRegions()
      ])
      // Excluir pedidos entregados o parciales — van a la página de Historial
      setOrders(ordersData.filter((o: Order) => o.status !== 'entregado' && o.status !== 'entrega_parcial'))
      setDistributors(usersData.filter((u: User) => u.role === 'distribuidor' && u.isActive))
      setRegions(regionsData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchData = fetchOrders

  useEffect(() => { fetchOrders() }, [filterRegion])

  const filtered = orders.filter(o => {
    if (filterStatus && o.status !== filterStatus) return false
    return true
  })

  const toggleSelect = (id: number) => {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const selectAllAceptados = () => {
    const aceptados = filtered.filter(o => o.status === 'aceptado').map(o => o.id)
    setSelected(aceptados)
  }

  const handleAssign = async () => {
    if (!distributorId || selected.length === 0) return
    setAssigning(true)
    try {
      await assignOrders({ orderIds: selected, distributorId: Number(distributorId) })
      setSelected([])
      setDistributorId('')
      fetchData()
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Error al asignar')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pedidos</h1>
          <p className="text-gray-500 text-sm mt-1">Gestiona y asigna pedidos a distribuidores</p>
        </div>

        {/* Resumen Global de Bodega (Pedidos Aceptados) */}
        {orders.some(o => o.status === 'aceptado') && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-green-900 mb-3 flex items-center gap-2">
              <span>🏭</span> Total en Bodega a preparar (Todos los pedidos Aceptados)
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(
                orders.filter(o => o.status === 'aceptado').reduce((acc, order) => {
                  order.items.forEach(item => {
                    const name = item.product.name
                    acc[name] = (acc[name] || 0) + item.quantity
                  })
                  return acc
                }, {} as Record<string, number>)
              ).map(([productName, qty]) => (
                <div key={productName} className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-green-100 flex items-center gap-2">
                  <span className="text-sm text-gray-700">{productName}</span>
                  <span className="text-sm font-bold text-green-700 px-2 flex items-center bg-green-100 rounded">
                    x{qty}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* Barra de herramientas */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="aceptado">Aceptado</option>
            <option value="asignado">Asignado</option>
          </select>

          <select
            value={filterRegion}
            onChange={e => setFilterRegion(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas las zonas</option>
            {regions.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          <button
            onClick={selectAllAceptados}
            className="text-sm text-blue-600 hover:underline"
          >
            Seleccionar aceptados
          </button>

          {selected.length > 0 && (
            <>
              <span className="text-sm text-gray-600">{selected.length} seleccionados</span>
              <select
                value={distributorId}
                onChange={e => setDistributorId(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar distribuidor</option>
                {distributors.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <button
                onClick={handleAssign}
                disabled={!distributorId || assigning}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {assigning ? 'Asignando...' : 'Asignar'}
              </button>
            </>
          )}
        </div>

        {/* Resumen de carga al camión */}
        {selected.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <span>📦</span> Total a cargar al camión ({selected.length} pedidos seleccionados)
            </h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(
                orders.filter(o => selected.includes(o.id)).reduce((acc, order) => {
                  order.items.forEach(item => {
                    const name = item.product.name
                    acc[name] = (acc[name] || 0) + item.quantity
                  })
                  return acc
                }, {} as Record<string, number>)
              ).map(([productName, qty]) => (
                <div key={productName} className="bg-white px-3 py-2 rounded-lg shadow-sm border border-blue-100 flex items-center gap-2">
                  <span className="text-sm text-gray-700">{productName}</span>
                  <span className="text-sm font-bold text-blue-700 px-2 flex items-center bg-blue-100 rounded">
                    x{qty}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="text-center text-gray-400 py-12">Cargando...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3"></th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">#</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Preventista</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Distribuidor</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Estado</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      {order.status === 'aceptado' && (
                        <input
                          type="checkbox"
                          checked={selected.includes(order.id)}
                          onChange={() => toggleSelect(order.id)}
                          className="rounded"
                        />
                      )}
                    </td>
                    <td className="px-4 py-4 font-medium text-gray-800">#{order.id}</td>
                    <td className="px-4 py-4 text-gray-800">{order.client.name}</td>
                    <td className="px-4 py-4 text-gray-500">{order.preventista.name}</td>
                    <td className="px-4 py-4 text-gray-500">{order.distributor?.name ?? '—'}</td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusColor[order.status]}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => setDetail(order)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal detalle */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800">Pedido #{detail.id}</h2>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Cliente</p>
                  <p className="font-medium">{detail.client.name}</p>
                </div>
                <div>
                  <p className="text-gray-500">Estado</p>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusColor[detail.status]}`}>
                    {detail.status}
                  </span>
                </div>
                <div>
                  <p className="text-gray-500">Preventista</p>
                  <p className="font-medium">{detail.preventista.name}</p>
                </div>
                <div>
                  <p className="text-gray-500">Distribuidor</p>
                  <p className="font-medium">{detail.distributor?.name ?? '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Dirección</p>
                  <p className="font-medium">{detail.client.address}</p>
                </div>
                {detail.notes && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Notas</p>
                    <p className="font-medium">{detail.notes}</p>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Productos</p>
                <div className="space-y-2">
                  {detail.items.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-600">{item.product.name} x{item.quantity}</span>
                      <span className="font-medium">Bs. {(item.unitPrice * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold border-t pt-2">
                    <span>Total</span>
                    <span>Bs. {detail.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}