import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { getSessions, getSessionDetail, closeSession } from '../../api/sessions'
import { getUsers } from '../../api/users'
import type { User } from '../../types'

interface Session {
  id: number
  distributorId: number
  status: 'activa' | 'cerrada'
  openedAt: string
  closedAt?: string
  closedByAdminId?: number
  notes?: string
  snapshotData?: any
  liveReport?: any
  distributor: { id: number; name: string }
  closedByAdmin?: { id: number; name: string }
}

export default function DistributionSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [distributors, setDistributors] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Session | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [filterDistributor, setFilterDistributor] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [closingId, setClosingId] = useState<number | null>(null)
  const [closeNotes, setCloseNotes] = useState('')

  const fetchSessions = async () => {
    try {
      const params: any = {}
      if (filterDistributor) params.distributorId = filterDistributor
      if (filterStatus) params.status = filterStatus

      const [sessionsData, usersData] = await Promise.all([
        getSessions(params),
        getUsers()
      ])
      setSessions(sessionsData)
      setDistributors(usersData.filter((u: User) => u.role === 'distribuidor'))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSessions() }, [filterDistributor, filterStatus])

  const openDetail = async (sessionId: number) => {
    setDetailLoading(true)
    try {
      const data = await getSessionDetail(sessionId)
      setDetail(data)
    } catch (err) {
      console.error(err)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleClose = async (sessionId: number) => {
    try {
      await closeSession(sessionId, closeNotes)
      setClosingId(null)
      setCloseNotes('')
      setDetail(null)
      fetchSessions()
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Error al cerrar sesión')
    }
  }

  const activeCount = sessions.filter(s => s.status === 'activa').length

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Distribución</h1>
          <p className="text-gray-500 text-sm mt-1">
            Gestiona las sesiones de distribución y cierre de jornadas
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-green-200 rounded-2xl p-5">
            <div className="text-2xl mb-1">🟢</div>
            <div className="text-3xl font-bold text-gray-800">{activeCount}</div>
            <div className="text-sm text-gray-500 mt-1">Sesiones activas</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="text-2xl mb-1">📋</div>
            <div className="text-3xl font-bold text-gray-800">{sessions.length}</div>
            <div className="text-sm text-gray-500 mt-1">Total sesiones</div>
          </div>
          <div className="bg-white border border-purple-200 rounded-2xl p-5 col-span-2 lg:col-span-1">
            <div className="text-2xl mb-1">🚛</div>
            <div className="text-3xl font-bold text-gray-800">{distributors.length}</div>
            <div className="text-sm text-gray-500 mt-1">Distribuidores</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
          <select
            value={filterDistributor}
            onChange={e => setFilterDistributor(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los distribuidores</option>
            {distributors.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los estados</option>
            <option value="activa">Activa</option>
            <option value="cerrada">Cerrada</option>
          </select>

          {(filterDistributor || filterStatus) && (
            <button
              onClick={() => { setFilterDistributor(''); setFilterStatus('') }}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              ✕ Limpiar
            </button>
          )}
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="text-center text-gray-400 py-12">Cargando sesiones...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center text-gray-400 py-12">No hay sesiones registradas</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">#</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Distribuidor</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Estado</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Apertura</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Cierre</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sessions.map(session => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 font-medium text-gray-800">#{session.id}</td>
                    <td className="px-4 py-4 text-gray-800">{session.distributor.name}</td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        session.status === 'activa'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {session.status === 'activa' ? '🟢 Activa' : '⚪ Cerrada'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-500">
                      {new Date(session.openedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-gray-500">
                      {session.closedAt ? new Date(session.closedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-4 flex gap-2">
                      <button
                        onClick={() => openDetail(session.id)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        Ver reporte
                      </button>
                      {session.status === 'activa' && (
                        <button
                          onClick={() => setClosingId(session.id)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                        >
                          Cerrar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal de confirmación de cierre */}
      {closingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              Cerrar Sesión #{closingId}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Al cerrar la sesión se guardará un snapshot del reporte actual.
              El distribuidor podrá abrir una nueva sesión después.
            </p>
            <textarea
              value={closeNotes}
              onChange={e => setCloseNotes(e.target.value)}
              placeholder="Notas del cierre (opcional)..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setClosingId(null); setCloseNotes('') }}
                className="flex-1 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleClose(closingId)}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
              >
                Confirmar Cierre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle del reporte */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  Reporte — {detail.distributor.name}
                </h2>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  detail.status === 'activa' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {detail.status === 'activa' ? '🟢 En curso' : '⚪ Cerrada'}
                </span>
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {detailLoading ? (
              <div className="text-center py-8 text-gray-400">Cargando...</div>
            ) : (
              <ReportContent report={detail.status === 'activa' ? detail.liveReport : detail.snapshotData} />
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}

// Componente que muestra el contenido del reporte
function ReportContent({ report }: { report: any }) {
  if (!report) {
    return <p className="text-center text-gray-400 py-8">No hay datos de reporte disponibles</p>
  }

  const resumen = report.resumen || {}
  const productosVendidos = report.productosVendidos || []
  const stockEnCamioneta = report.stockEnCamioneta || []

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-700">
            Bs. {(resumen.totalRecaudado ?? 0).toFixed(2)}
          </div>
          <div className="text-xs text-green-600 mt-1">Dinero recaudado</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{resumen.puntosEntregados ?? 0}</div>
          <div className="text-xs text-blue-600 mt-1">Puntos entregados</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-700">{resumen.pedidosPendientes ?? 0}</div>
          <div className="text-xs text-orange-600 mt-1">Pendientes</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-700">{resumen.pedidosRechazados ?? 0}</div>
          <div className="text-xs text-red-600 mt-1">Rechazados</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-purple-700">{resumen.totalPedidos ?? 0}</div>
          <div className="text-xs text-purple-600 mt-1">Total pedidos</div>
        </div>
      </div>

      {/* Tabla de productos vendidos */}
      {productosVendidos.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3">Productos Vendidos</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Producto</th>
                <th className="text-center px-3 py-2 text-gray-600 font-medium">Pedido</th>
                <th className="text-center px-3 py-2 text-gray-600 font-medium">Entregado</th>
                <th className="text-center px-3 py-2 text-gray-600 font-medium">Devuelto</th>
                <th className="text-right px-3 py-2 text-gray-600 font-medium">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {productosVendidos.map((p: any, i: number) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-medium text-gray-800">{p.name}</td>
                  <td className="px-3 py-2 text-center">{p.cantidadPedida}</td>
                  <td className="px-3 py-2 text-center text-green-600 font-medium">{p.cantidadEntregada}</td>
                  <td className="px-3 py-2 text-center">
                    {p.cantidadDevuelta > 0 ? (
                      <span className="text-orange-600 font-medium">{p.cantidadDevuelta}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">Bs. {p.monto.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabla de Bonificaciones Entregadas */}
      {report.bonificacionesEntregadas && report.bonificacionesEntregadas.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span>🎁 Bonificaciones Entregadas (Gratis / Promoción)</span>
          </h3>
          <table className="w-full text-sm">
            <thead className="bg-emerald-50">
              <tr>
                <th className="text-left px-3 py-2 text-emerald-800 font-medium">Producto</th>
                <th className="text-center px-3 py-2 text-emerald-800 font-medium">Pedida</th>
                <th className="text-center px-3 py-2 text-emerald-800 font-medium">Entregada</th>
                <th className="text-right px-3 py-2 text-emerald-800 font-medium">Costo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.bonificacionesEntregadas.map((b: any, i: number) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-medium text-gray-800">{b.name}</td>
                  <td className="px-3 py-2 text-center">{b.cantidadPedida}</td>
                  <td className="px-3 py-2 text-center text-emerald-600 font-bold">{b.cantidadEntregada}</td>
                  <td className="px-3 py-2 text-right text-emerald-600 font-bold">GRATIS</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stock en camioneta */}
      {stockEnCamioneta.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3">Stock en Camioneta (para devolver)</h3>
          <div className="grid grid-cols-2 gap-2">
            {stockEnCamioneta.map((s: any, i: number) => (
              <div key={i} className="bg-orange-50 border border-orange-100 rounded-lg p-3 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">{s.name}</span>
                <span className="text-sm font-bold text-orange-600">x{s.cantidad}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detalle desplegable de todos los pedidos */}
      <PedidosExpandable pedidos={report.pedidos || []} />
    </div>
  )
}

function PedidosExpandable({ pedidos }: { pedidos: any[] }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('todos')
  const [openOrderIds, setOpenOrderIds] = useState<Set<number>>(new Set())

  const entregados = pedidos.filter(p => p.status === 'entregado').length
  const parciales  = pedidos.filter(p => p.status === 'entrega_parcial').length
  const rechazados = pedidos.filter(p => p.status === 'rechazado').length
  const pendientes = pedidos.filter(p => p.status === 'asignado' || p.status === 'pendiente').length

  const filteredPedidos = pedidos.filter(p => {
    if (filterStatus === 'todos') return true
    if (filterStatus === 'pendientes') return p.status === 'asignado' || p.status === 'pendiente'
    return p.status === filterStatus
  })

  const toggleOrder = (orderId: number) => {
    setOpenOrderIds(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'entregado':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">✅ Entregado</span>
      case 'entrega_parcial':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">⚠️ Parcial</span>
      case 'rechazado':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">🚫 Rechazado</span>
      case 'asignado':
      case 'pendiente':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">🕐 Pendiente</span>
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{status}</span>
    }
  }

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-white">
      {/* Cabecera del desplegable */}
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/80 transition-colors text-left"
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <span className="font-bold text-gray-800 text-base">Detalle de Pedidos de la Jornada</span>
            <span className="text-xs bg-gray-200 text-gray-700 font-semibold px-2 py-0.5 rounded-full">
              {pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'}
            </span>
          </div>

          {/* Badges de resumen rápido */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {entregados > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                {entregados} entregados
              </span>
            )}
            {parciales > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                {parciales} parciales
              </span>
            )}
            {rechazados > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 bg-red-100 text-red-800 rounded-md">
                {rechazados} rechazados
              </span>
            )}
            {pendientes > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md">
                {pendientes} pendientes
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-gray-500 font-medium text-sm">
          <span>{isExpanded ? 'Ocultar' : 'Ver pedidos'}</span>
          <span className={`transform transition-transform text-lg ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {/* Contenido expandible */}
      {isExpanded && (
        <div className="p-4 border-t border-gray-200 space-y-4">
          {/* Filtros rápidos por estado */}
          {pedidos.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => setFilterStatus('todos')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  filterStatus === 'todos' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Todos ({pedidos.length})
              </button>
              {entregados > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterStatus('entregado')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    filterStatus === 'entregado' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  Entregados ({entregados})
                </button>
              )}
              {parciales > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterStatus('entrega_parcial')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    filterStatus === 'entrega_parcial' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  Parciales ({parciales})
                </button>
              )}
              {rechazados > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterStatus('rechazado')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    filterStatus === 'rechazado' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
                  }`}
                >
                  Rechazados ({rechazados})
                </button>
              )}
              {pendientes > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterStatus('pendientes')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    filterStatus === 'pendientes' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  Pendientes ({pendientes})
                </button>
              )}
            </div>
          )}

          {filteredPedidos.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-6">
              No hay pedidos que coincidan con este filtro.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredPedidos.map((pedido: any) => {
                const isOpen = openOrderIds.has(pedido.id)
                const items = pedido.items || []

                let totalCalculado = 0
                items.forEach((item: any) => {
                  if (item.isBonification) return
                  const cant = item.deliveredQuantity ?? item.quantity ?? 0
                  totalCalculado += cant * (item.unitPrice || 0)
                })

                return (
                  <div
                    key={pedido.id}
                    className="border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors"
                  >
                    {/* Fila del pedido */}
                    <div
                      onClick={() => toggleOrder(pedido.id)}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer bg-white hover:bg-gray-50/75 select-none"
                    >
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5">{getStatusBadge(pedido.status)}</div>
                        <div>
                          <div className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                            <span>Pedido #{pedido.id}</span>
                            <span className="text-gray-400 font-normal">·</span>
                            <span>{pedido.client?.name || 'Cliente sin nombre'}</span>
                          </div>
                          {pedido.client?.address && (
                            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                              <span>📍</span>
                              <span className="truncate max-w-md">{pedido.client.address}</span>
                            </div>
                          )}
                          {pedido.notes && (
                            <div className="text-xs text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded mt-1 border border-amber-200/50 inline-block">
                              📝 {pedido.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-center">
                        <div className="text-right">
                          <div className="text-xs text-gray-400">Total</div>
                          <div className="font-bold text-gray-800 text-sm">
                            Bs. {totalCalculado.toFixed(2)}
                          </div>
                        </div>
                        <span className={`text-gray-400 text-xs px-2 py-1 rounded bg-gray-100 flex items-center gap-1 font-medium`}>
                          <span>{items.length} {items.length === 1 ? 'item' : 'items'}</span>
                          <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                        </span>
                      </div>
                    </div>

                    {/* Detalle desplegable de items */}
                    {isOpen && (
                      <div className="bg-slate-50 border-t border-gray-200 p-3 sm:p-4 text-xs">
                        <div className="font-medium text-gray-600 mb-2">Detalle de Productos:</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="text-gray-500 border-b border-gray-200 pb-1">
                                <th className="pb-1.5 font-medium">Producto</th>
                                <th className="pb-1.5 font-medium text-center">Pedida</th>
                                <th className="pb-1.5 font-medium text-center">Entregada</th>
                                <th className="pb-1.5 font-medium text-center">Devuelta</th>
                                <th className="pb-1.5 font-medium text-right">Precio U.</th>
                                <th className="pb-1.5 font-medium text-right">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200/60">
                              {items.map((it: any, idx: number) => {
                                const isBoni = Boolean(it.isBonification)
                                const pedida = it.quantity || 0
                                const entregada = it.deliveredQuantity !== null && it.deliveredQuantity !== undefined
                                  ? it.deliveredQuantity
                                  : pedida
                                const devuelta = Math.max(0, pedida - entregada)
                                const unitPrice = it.unitPrice || 0
                                const subtotal = entregada * unitPrice

                                return (
                                  <tr key={idx} className="hover:bg-slate-100/60">
                                    <td className="py-2 font-medium text-gray-800">
                                      <div className="flex items-center gap-1.5">
                                        {isBoni && (
                                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                            🎁 BONIF
                                          </span>
                                        )}
                                        <span>{it.productName || 'Producto'}</span>
                                      </div>
                                    </td>
                                    <td className="py-2 text-center text-gray-600">
                                      {pedida} {it.unit || ''}
                                    </td>
                                    <td className="py-2 text-center font-bold text-emerald-700">
                                      {entregada} {it.unit || ''}
                                    </td>
                                    <td className="py-2 text-center">
                                      {devuelta > 0 ? (
                                        <span className="text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded">
                                          {devuelta} {it.unit || ''}
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">0</span>
                                      )}
                                    </td>
                                    <td className="py-2 text-right text-gray-600">
                                      {isBoni ? '—' : `Bs. ${unitPrice.toFixed(2)}`}
                                    </td>
                                    <td className="py-2 text-right font-semibold text-gray-800">
                                      {isBoni ? (
                                        <span className="text-emerald-700 font-bold">GRATIS</span>
                                      ) : (
                                        `Bs. ${subtotal.toFixed(2)}`
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
