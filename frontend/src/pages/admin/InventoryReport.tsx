import { useEffect, useState, useMemo } from 'react'
import Layout from '../../components/Layout'
import { getInventoryStats } from '../../api/products'

interface ProductStat {
  product: {
    id: number
    name: string
    unit: string
    price: number
    category: string
    isActive: boolean
  }
  pedidaRegular: number
  vendidaRegular: number
  devueltaRegular: number
  pendienteRegular: number
  pedidaBonif: number
  entregadaBonif: number
  devueltaBonif: number
  pendienteBonif: number
  totalDinero: number
  pedidosCount: number
  totalBultosMovidos: number
}

interface SummaryStats {
  totalProductos: number
  totalVendidaRegular: number
  totalDevueltaRegular: number
  totalPendienteRegular: number
  totalEntregadaBonif: number
  totalDevueltaBonif: number
  totalPendienteBonif: number
  totalDinero: number
  totalBultosEntregados: number
}

export default function InventoryReport() {
  const [stats, setStats] = useState<ProductStat[]>([])
  const [summary, setSummary] = useState<SummaryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodPreset, setPeriodPreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Calcula las fechas para los presets
  const getDateRangeForPreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom') => {
    const now = new Date()
    const formatDate = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    if (preset === 'today') {
      const todayStr = formatDate(now)
      return { start: todayStr, end: todayStr }
    }
    if (preset === 'yesterday') {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      const yStr = formatDate(y)
      return { start: yStr, end: yStr }
    }
    if (preset === 'week') {
      const first = new Date(now)
      const day = first.getDay() || 7
      first.setDate(first.getDate() - day + 1) // Lunes
      return { start: formatDate(first), end: formatDate(now) }
    }
    if (preset === 'month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: formatDate(first), end: formatDate(now) }
    }
    return { start: '', end: '' }
  }

  const fetchStats = async () => {
    setLoading(true)
    try {
      let s = startDate
      let e = endDate

      if (periodPreset !== 'custom' && periodPreset !== 'all') {
        const range = getDateRangeForPreset(periodPreset)
        s = range.start
        e = range.end
      }

      const res = await getInventoryStats({
        startDate: s || undefined,
        endDate: e || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
      })

      setStats(res.products || [])
      setSummary(res.summary || null)
    } catch (error) {
      console.error('Error fetching inventory stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [periodPreset, selectedCategory])

  // Categorías únicas
  const categories = useMemo(() => {
    const set = new Set<string>()
    stats.forEach(s => {
      if (s.product.category) set.add(s.product.category)
    })
    return Array.from(set)
  }, [stats])

  // Filtrado en memoria por buscador
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return stats
    const term = searchTerm.toLowerCase()
    return stats.filter(s =>
      s.product.name.toLowerCase().includes(term) ||
      s.product.category.toLowerCase().includes(term)
    )
  }, [stats, searchTerm])

  // Exportar reporte a CSV
  const handleExportCSV = () => {
    if (filteredProducts.length === 0) return

    const headers = [
      'Producto',
      'Categoría',
      'Unidad',
      'Precio Unit (Bs)',
      'Pedidos Incluidos',
      'Preventa Pedida',
      'Vendidos Entregados',
      'Devueltos',
      'Bonificaciones Entregadas',
      'Bonificaciones Devueltas',
      'En Ruta / Pendiente',
      'Total Cobrado (Bs)'
    ]

    const rows = filteredProducts.map(s => [
      `"${s.product.name.replace(/"/g, '""')}"`,
      `"${s.product.category}"`,
      `"${s.product.unit}"`,
      s.product.price.toFixed(2),
      s.pedidosCount,
      s.pedidaRegular,
      s.vendidaRegular,
      s.devueltaRegular,
      s.entregadaBonif,
      s.devueltaBonif,
      s.pendienteRegular,
      s.totalDinero.toFixed(2)
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Inventario_Productos_${periodPreset}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Estilos para impresión formal de inventario */}
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #inventory-print-section, #inventory-print-section * {
              visibility: visible;
            }
            #inventory-print-section {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 10mm;
              color: black !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>

        {/* Encabezado Principal */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📈</span>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                Inventario y Balance de Productos
              </h1>
            </div>
            <p className="text-gray-500 text-xs md:text-sm mt-0.5">
              Control exacto de unidades vendidas, devueltas, bonificaciones obsequiadas y recaudación
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
              title="Descargar archivo Excel / CSV"
            >
              <span>📊</span>
              <span>Exportar Excel</span>
            </button>

            <button
              onClick={() => window.print()}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
            >
              <span>🖨️</span>
              <span>Imprimir Reporte</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Presets de Período */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-gray-500 mr-1">Período:</span>
            {[
              { id: 'today', label: 'Hoy' },
              { id: 'yesterday', label: 'Ayer' },
              { id: 'week', label: 'Esta Semana' },
              { id: 'month', label: 'Este Mes' },
              { id: 'all', label: 'Histórico' },
              { id: 'custom', label: 'Rango Fecha' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriodPreset(p.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  periodPreset === p.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Rango de Fechas Personalizado (Si aplica) */}
          {periodPreset === 'custom' && (
            <div className="flex items-center gap-2 bg-blue-50/60 p-2 rounded-xl border border-blue-100">
              <span className="text-xs font-semibold text-blue-900">Desde:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white"
              />
              <span className="text-xs font-semibold text-blue-900">Hasta:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white"
              />
              <button
                onClick={fetchStats}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1 rounded-lg"
              >
                Filtrar
              </button>
            </div>
          )}

          {/* Filtro por Categoría y Buscador */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="text-xs font-bold border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white text-gray-700 outline-none"
            >
              <option value="all">Todas las Categorías</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <div className="relative">
              <span className="absolute left-2.5 top-2.5 text-xs text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Buscar producto..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:bg-white text-gray-800 w-40 md:w-52 outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        </div>

        {/* Tarjetas KPI de Resumen Superior */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl shrink-0">
                📦
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate">
                  Ventas Entregadas
                </p>
                <h3 className="text-xl font-black text-emerald-700">
                  {summary.totalVendidaRegular} <span className="text-xs font-semibold text-emerald-600">unds</span>
                </h3>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-rose-100 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-xl shrink-0">
                ↩️
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate">
                  Devoluciones
                </p>
                <h3 className="text-xl font-black text-rose-700">
                  {summary.totalDevueltaRegular + summary.totalDevueltaBonif} <span className="text-xs font-semibold text-rose-600">unds</span>
                </h3>
                {summary.totalDevueltaBonif > 0 && (
                  <p className="text-[10px] text-gray-400">({summary.totalDevueltaRegular} venta + {summary.totalDevueltaBonif} bonif)</p>
                )}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-purple-100 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-xl shrink-0">
                🎁
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate">
                  Bonificaciones
                </p>
                <h3 className="text-xl font-black text-purple-700">
                  {summary.totalEntregadaBonif} <span className="text-xs font-semibold text-purple-600">gratis</span>
                </h3>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-amber-100 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl shrink-0">
                🚚
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate">
                  En Ruta / Pendientes
                </p>
                <h3 className="text-xl font-black text-amber-700">
                  {summary.totalPendienteRegular + summary.totalPendienteBonif} <span className="text-xs font-semibold text-amber-600">unds</span>
                </h3>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-blue-100 flex items-center gap-3 col-span-2 md:col-span-1">
              <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-xl shrink-0">
                💰
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate">
                  Recaudación Total
                </p>
                <h3 className="text-xl font-black text-blue-700 truncate">
                  Bs. {summary.totalDinero.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
              </div>
            </div>
          </div>
        )}

        {/* Contenido / Tabla Imprimible */}
        <div id="inventory-print-section" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Membrete visible en impresión */}
          <div className="hidden print:block p-4 border-b border-gray-300 text-center">
            <h2 className="text-xl font-black">DISTRIBUIDORA LUNOVA</h2>
            <p className="text-xs text-gray-600">REPORTE OFICIAL DE INVENTARIO Y BALANCE DE PRODUCTOS</p>
            <p className="text-xs text-gray-500 mt-1">
              Fecha de Emisión: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
            </p>
          </div>

          {loading ? (
            <div className="p-16 text-center text-gray-400">
              <div className="animate-spin text-3xl mb-3">⏳</div>
              <p className="text-sm font-semibold">Cargando balance de inventario...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-16 text-center text-gray-400">
              <div className="text-4xl mb-3">🥔</div>
              <p className="text-base font-bold text-gray-700">No se encontraron productos</p>
              <p className="text-xs text-gray-400 mt-1">Intenta con otro filtro de fechas o categorías</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-3">Categoría</th>
                    <th className="py-3 px-3 text-right">P. Unitario</th>
                    <th className="py-3 px-3 text-center">Preventa</th>
                    <th className="py-3 px-3 text-center bg-emerald-50/40 text-emerald-800">Vendidos</th>
                    <th className="py-3 px-3 text-center bg-rose-50/40 text-rose-800">Devueltos</th>
                    <th className="py-3 px-3 text-center bg-purple-50/40 text-purple-800">Bonificación</th>
                    <th className="py-3 px-3 text-center bg-amber-50/40 text-amber-800">En Ruta</th>
                    <th className="py-3 px-4 text-right">Total Cobrado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredProducts.map(s => {
                    const totalPedidas = s.pedidaRegular + s.pedidaBonif
                    const efectividad = totalPedidas > 0
                      ? Math.round(((s.vendidaRegular + s.entregadaBonif) / totalPedidas) * 100)
                      : 0

                    return (
                      <tr key={s.product.id} className="hover:bg-gray-50/60 transition-colors">
                        {/* Producto y Unidad */}
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          <div className="flex items-center gap-2">
                            <span>{s.product.name}</span>
                            {!s.product.isActive && (
                              <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.2 rounded font-normal">
                                Inactivo
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400 font-normal">
                            Unidad: {s.product.unit} | {s.pedidosCount} pedidos
                          </div>
                        </td>

                        {/* Categoría */}
                        <td className="py-3.5 px-3">
                          <span className="inline-block bg-blue-50 text-blue-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                            {s.product.category}
                          </span>
                        </td>

                        {/* Precio Unitario */}
                        <td className="py-3.5 px-3 text-right font-medium text-gray-600">
                          Bs. {s.product.price.toFixed(2)}
                        </td>

                        {/* Preventa Pedida */}
                        <td className="py-3.5 px-3 text-center font-bold text-gray-700">
                          {s.pedidaRegular}
                          {s.pedidaBonif > 0 && (
                            <span className="text-[10px] text-purple-600 block">+{s.pedidaBonif} bonif</span>
                          )}
                        </td>

                        {/* Vendidos Entregados */}
                        <td className="py-3.5 px-3 text-center bg-emerald-50/30 font-black text-emerald-700">
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg">
                            <span>x{s.vendidaRegular}</span>
                          </span>
                        </td>

                        {/* Devueltos */}
                        <td className="py-3.5 px-3 text-center bg-rose-50/30 font-black text-rose-700">
                          {s.devueltaRegular > 0 || s.devueltaBonif > 0 ? (
                            <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 px-2 py-0.5 rounded-lg">
                              <span>x{s.devueltaRegular + s.devueltaBonif}</span>
                            </span>
                          ) : (
                            <span className="text-gray-300 font-normal">0</span>
                          )}
                        </td>

                        {/* Bonificación Entregada */}
                        <td className="py-3.5 px-3 text-center bg-purple-50/30 font-bold text-purple-700">
                          {s.entregadaBonif > 0 ? (
                            <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 px-2 py-0.5 rounded-lg">
                              <span>🎁 x{s.entregadaBonif}</span>
                            </span>
                          ) : (
                            <span className="text-gray-300 font-normal">0</span>
                          )}
                        </td>

                        {/* En Ruta / Pendientes */}
                        <td className="py-3.5 px-3 text-center bg-amber-50/30 font-bold text-amber-700">
                          {s.pendienteRegular + s.pendienteBonif > 0 ? (
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-lg">
                              <span>⏳ x{s.pendienteRegular + s.pendienteBonif}</span>
                            </span>
                          ) : (
                            <span className="text-gray-300 font-normal">0</span>
                          )}
                        </td>

                        {/* Total Cobrado */}
                        <td className="py-3.5 px-4 text-right font-black text-gray-900">
                          <span className="text-sm">
                            Bs. {s.totalDinero.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          {totalPedidas > 0 && (
                            <div className="text-[10px] text-gray-400 font-normal">
                              {efectividad}% entregado
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>

                {/* Fila de Totales Generales al pie de tabla */}
                {summary && (
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-black text-xs">
                      <td className="py-3.5 px-4" colSpan={3}>
                        TOTALES GENERALES ({filteredProducts.length} productos)
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {summary.totalVendidaRegular + summary.totalDevueltaRegular + summary.totalPendienteRegular}
                      </td>
                      <td className="py-3.5 px-3 text-center text-emerald-300">
                        x{summary.totalVendidaRegular}
                      </td>
                      <td className="py-3.5 px-3 text-center text-rose-300">
                        x{summary.totalDevueltaRegular + summary.totalDevueltaBonif}
                      </td>
                      <td className="py-3.5 px-3 text-center text-purple-300">
                        x{summary.totalEntregadaBonif}
                      </td>
                      <td className="py-3.5 px-3 text-center text-amber-300">
                        x{summary.totalPendienteRegular + summary.totalPendienteBonif}
                      </td>
                      <td className="py-3.5 px-4 text-right text-emerald-400 text-sm">
                        Bs. {summary.totalDinero.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
