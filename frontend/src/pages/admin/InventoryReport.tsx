import { useEffect, useState, useMemo } from 'react'
import Layout from '../../components/Layout'
import {
  getInventoryStats,
  getStockBalance,
  getProductionEntries,
  createProductionEntry,
  updateProductionEntry,
  deleteProductionEntry
} from '../../api/products'

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

interface StockProductBalance {
  product: {
    id: number
    name: string
    unit: string
    price: number
    category: string
    isActive: boolean
  }
  totalProducido: number
  totalVendidoRegular: number
  totalEntregadaBonif: number
  totalDevuelto: number
  totalEnRuta: number
  stockAlmacen: number
  entradasCount: number
}

interface StockSummary {
  totalProductos: number
  totalProducido: number
  totalVendidoRegular: number
  totalEntregadaBonif: number
  totalDevuelto: number
  totalEnRuta: number
  totalStockAlmacen: number
}

interface ProductionEntryItem {
  id: number
  productId: number
  quantity: number
  notes?: string
  date: string
  product: { id: number; name: string; unit: string; category: string }
  creator?: { id: number; name: string }
}

export default function InventoryReport() {
  const [activeTab, setActiveTab] = useState<'ventas' | 'produccion'>('produccion')
  const [loading, setLoading] = useState(true)

  // Filtros globales
  const [periodPreset, setPeriodPreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Estado Pestaña 1: Ventas y Devoluciones
  const [stats, setStats] = useState<ProductStat[]>([])
  const [summary, setSummary] = useState<SummaryStats | null>(null)

  // Estado Pestaña 2: Producción y Stock
  const [stockBalances, setStockBalances] = useState<StockProductBalance[]>([])
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null)
  const [productionHistory, setProductionHistory] = useState<ProductionEntryItem[]>([])

  // Modal para agregar / editar producción
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<ProductionEntryItem | null>(null)
  const [entryType, setEntryType] = useState<'in' | 'out'>('in')
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('')
  const [prodQuantity, setProdQuantity] = useState<number | ''>('')
  const [prodDate, setProdDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [prodNotes, setProdNotes] = useState<string>('')
  const [adminPassword, setAdminPassword] = useState<string>('')
  const [submittingProd, setSubmittingProd] = useState(false)

  // Modal para eliminar producción de forma segura
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; entry: ProductionEntryItem | null }>({
    show: false,
    entry: null
  })
  const [deletePassword, setDeletePassword] = useState('')
  const [submittingDelete, setSubmittingDelete] = useState(false)

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
      first.setDate(first.getDate() - day + 1)
      return { start: formatDate(first), end: formatDate(now) }
    }
    if (preset === 'month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: formatDate(first), end: formatDate(now) }
    }
    return { start: '', end: '' }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      let s = startDate
      let e = endDate

      if (periodPreset !== 'custom' && periodPreset !== 'all') {
        const range = getDateRangeForPreset(periodPreset)
        s = range.start
        e = range.end
      }

      if (activeTab === 'ventas') {
        const res = await getInventoryStats({
          startDate: s || undefined,
          endDate: e || undefined,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
        })
        setStats(res.products || [])
        setSummary(res.summary || null)
      } else {
        const [balanceRes, prodList] = await Promise.all([
          getStockBalance({
            startDate: s || undefined,
            endDate: e || undefined,
            category: selectedCategory !== 'all' ? selectedCategory : undefined,
          }),
          getProductionEntries({ limit: 30 })
        ])
        setStockBalances(balanceRes.products || [])
        setStockSummary(balanceRes.summary || null)
        setProductionHistory(prodList || [])
      }
    } catch (error) {
      console.error('Error fetching inventory/production data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [activeTab, periodPreset, selectedCategory])

  // Categorías únicas
  const categories = useMemo(() => {
    const set = new Set<string>()
    const list = activeTab === 'ventas' ? stats : stockBalances
    list.forEach(s => {
      if (s.product.category) set.add(s.product.category)
    })
    return Array.from(set)
  }, [stats, stockBalances, activeTab])

  // Filtrado en memoria por buscador
  const filteredSalesProducts = useMemo(() => {
    if (!searchTerm.trim()) return stats
    const term = searchTerm.toLowerCase()
    return stats.filter(s =>
      s.product.name.toLowerCase().includes(term) ||
      s.product.category.toLowerCase().includes(term)
    )
  }, [stats, searchTerm])

  const filteredStockProducts = useMemo(() => {
    if (!searchTerm.trim()) return stockBalances
    const term = searchTerm.toLowerCase()
    return stockBalances.filter(s =>
      s.product.name.toLowerCase().includes(term) ||
      s.product.category.toLowerCase().includes(term)
    )
  }, [stockBalances, searchTerm])

  // Abrir modal en modo crear
  const handleOpenCreateModal = (productId?: number) => {
    setEditingEntry(null)
    setEntryType('in')
    setSelectedProductId(productId ?? '')
    setProdQuantity('')
    setProdDate(new Date().toISOString().slice(0, 10))
    setProdNotes('')
    setAdminPassword('')
    setShowAddModal(true)
  }

  // Abrir modal en modo editar
  const handleOpenEditModal = (entry: ProductionEntryItem) => {
    setEditingEntry(entry)
    setEntryType(entry.quantity >= 0 ? 'in' : 'out')
    setSelectedProductId(entry.productId)
    setProdQuantity(Math.abs(entry.quantity))
    setProdDate(entry.date.slice(0, 10))
    setProdNotes(entry.notes || '')
    setAdminPassword('')
    setShowAddModal(true)
  }

  // Guardar (crear o editar) entrada de producción
  const handleSaveProduction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductId || !prodQuantity || Number(prodQuantity) === 0) {
      alert('Selecciona un producto e ingresa una cantidad distinta de 0')
      return
    }

    const qty = entryType === 'out' ? -Math.abs(Number(prodQuantity)) : Math.abs(Number(prodQuantity))

    // Si es edición o es ajuste hacia abajo (negativo), se exige contraseña de admin
    if ((editingEntry || entryType === 'out') && !adminPassword.trim()) {
      alert('Se requiere la contraseña de administrador para confirmar esta modificación o reducción de inventario')
      return
    }

    setSubmittingProd(true)
    try {
      if (editingEntry) {
        await updateProductionEntry(editingEntry.id, {
          quantity: qty,
          date: prodDate,
          notes: prodNotes.trim() || undefined,
          adminPassword
        })
      } else {
        await createProductionEntry({
          productId: Number(selectedProductId),
          quantity: qty,
          date: prodDate,
          notes: prodNotes.trim() || undefined,
          adminPassword: entryType === 'out' ? adminPassword : adminPassword || undefined
        })
      }
      setShowAddModal(false)
      setEditingEntry(null)
      setSelectedProductId('')
      setProdQuantity('')
      setProdNotes('')
      setAdminPassword('')
      fetchData()
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Error al guardar producción')
    } finally {
      setSubmittingProd(false)
    }
  }

  // Abrir modal de confirmación con contraseña para eliminar
  const handleOpenDeleteModal = (entry: ProductionEntryItem) => {
    setDeleteModal({ show: true, entry })
    setDeletePassword('')
  }

  // Confirmar eliminación con contraseña de admin
  const handleConfirmDelete = async () => {
    if (!deleteModal.entry) return
    if (!deletePassword.trim()) {
      alert('Debes ingresar la contraseña de administrador')
      return
    }

    setSubmittingDelete(true)
    try {
      await deleteProductionEntry(deleteModal.entry.id, deletePassword)
      setDeleteModal({ show: false, entry: null })
      setDeletePassword('')
      fetchData()
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Error al eliminar entrada')
    } finally {
      setSubmittingDelete(false)
    }
  }

  // Exportar reporte a CSV
  const handleExportCSV = () => {
    if (activeTab === 'ventas') {
      if (filteredSalesProducts.length === 0) return
      const headers = [
        'Producto', 'Categoría', 'Unidad', 'Precio Unit (Bs)', 'Pedidos', 'Preventa Pedida',
        'Vendidos Entregados', 'Devueltos', 'Bonificaciones Entregadas', 'En Ruta', 'Total Cobrado (Bs)'
      ]
      const rows = filteredSalesProducts.map(s => [
        `"${s.product.name.replace(/"/g, '""')}"`,
        `"${s.product.category}"`,
        `"${s.product.unit}"`,
        s.product.price.toFixed(2),
        s.pedidosCount,
        s.pedidaRegular,
        s.vendidaRegular,
        s.devueltaRegular,
        s.entregadaBonif,
        s.pendienteRegular,
        s.totalDinero.toFixed(2)
      ])
      const csv = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
      const link = document.createElement('a')
      link.href = encodeURI(csv)
      link.download = `Ventas_Devoluciones_${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
    } else {
      if (filteredStockProducts.length === 0) return
      const headers = [
        'Producto', 'Categoría', 'Unidad', 'Total Producido / Entrada (+)',
        'Ventas Entregadas (-)', 'Bonificaciones (-)', 'Devoluciones de Distribuidores (+)',
        'En Ruta (Camionetas)', 'Stock Físico en Almacén'
      ]
      const rows = filteredStockProducts.map(s => [
        `"${s.product.name.replace(/"/g, '""')}"`,
        `"${s.product.category}"`,
        `"${s.product.unit}"`,
        s.totalProducido,
        s.totalVendidoRegular,
        s.totalEntregadaBonif,
        s.totalDevuelto,
        s.totalEnRuta,
        s.stockAlmacen
      ])
      const csv = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
      const link = document.createElement('a')
      link.href = encodeURI(csv)
      link.download = `Stock_Almacen_Kardex_${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Estilos para impresión formal de inventario y stock */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #inventory-print-section, #inventory-print-section * { visibility: visible; }
            #inventory-print-section {
              position: absolute; left: 0; top: 0; width: 100%; padding: 10mm; color: black !important;
            }
            .no-print { display: none !important; }
          }
        `}</style>

        {/* Encabezado Principal */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📈</span>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                Control de Inventario, Producción y Stock
              </h1>
            </div>
            <p className="text-gray-500 text-xs md:text-sm mt-0.5">
              Control exacto de producción agregada, ventas, devoluciones de choferes y stock disponible en bodega
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'produccion' && (
              <button
                onClick={() => handleOpenCreateModal()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-md hover:shadow-lg transition-all transform hover:scale-105"
              >
                <span className="text-sm">➕</span>
                <span>Registrar Producción / Entrada</span>
              </button>
            )}

            <button
              onClick={handleExportCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
            >
              <span>📊</span>
              <span>Exportar Excel</span>
            </button>

            <button
              onClick={() => window.print()}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
            >
              <span>🖨️</span>
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        {/* Pestañas de Navegación: Producción y Almacén vs Balance de Ventas */}
        <div className="flex items-center gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('produccion')}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'produccion'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>🏭</span>
            <span>Producción y Stock en Almacén</span>
            {stockBalances.length > 0 && (
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">
                {stockBalances.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('ventas')}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'ventas'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>📦</span>
            <span>Balance de Ventas y Devoluciones</span>
          </button>
        </div>

        {/* Barra de Filtros */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-gray-500 mr-1">Período:</span>
            {[
              { id: 'today', label: 'Hoy' },
              { id: 'yesterday', label: 'Ayer' },
              { id: 'week', label: 'Esta Semana' },
              { id: 'month', label: 'Este Mes' },
              { id: 'all', label: 'Histórico Total' },
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
                onClick={fetchData}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1 rounded-lg"
              >
                Filtrar
              </button>
            </div>
          )}

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

        {/* ─── VISTA 1: PRODUCCIÓN Y STOCK EN ALMACÉN (KARDEX EN VIVO) ─── */}
        {activeTab === 'produccion' && (
          <div className="space-y-6">
            {/* Tarjetas KPI de Stock y Almacén */}
            {stockSummary && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-blue-100 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-xl shrink-0">
                    🏭
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate">
                      Producción Ingresada (+)
                    </p>
                    <h3 className="text-xl font-black text-blue-700">
                      {stockSummary.totalProducido} <span className="text-xs font-semibold text-blue-600">unds</span>
                    </h3>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl shrink-0">
                    📦
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate">
                      Salidas por Ventas (-)
                    </p>
                    <h3 className="text-xl font-black text-emerald-700">
                      {stockSummary.totalVendidoRegular + stockSummary.totalEntregadaBonif} <span className="text-xs font-semibold text-emerald-600">unds</span>
                    </h3>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-sm border border-purple-100 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-xl shrink-0">
                    ↩️
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate">
                      Devuelto al Almacén (+)
                    </p>
                    <h3 className="text-xl font-black text-purple-700">
                      {stockSummary.totalDevuelto} <span className="text-xs font-semibold text-purple-600">unds</span>
                    </h3>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-sm border border-amber-100 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl shrink-0">
                    🚚
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate">
                      En Ruta (Camionetas)
                    </p>
                    <h3 className="text-xl font-black text-amber-700">
                      {stockSummary.totalEnRuta} <span className="text-xs font-semibold text-amber-600">unds</span>
                    </h3>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white p-4 rounded-2xl shadow-md flex items-center gap-3 col-span-2 md:col-span-1">
                  <div className="w-11 h-11 rounded-xl bg-white/10 text-white flex items-center justify-center text-xl shrink-0">
                    🏢
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-blue-200 uppercase tracking-wider truncate">
                      Stock Real en Almacén
                    </p>
                    <h3 className="text-2xl font-black text-white">
                      {stockSummary.totalStockAlmacen} <span className="text-xs font-normal text-blue-200">unds</span>
                    </h3>
                  </div>
                </div>
              </div>
            )}

            {/* Tabla de Stock por Producto */}
            <div id="inventory-print-section" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">
                    Balance Físico por Producto (Kardex de Bodega)
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Fórmula: (Producción Ingresada + Devoluciones) - (Ventas + Bonificaciones + En Ruta)
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="p-16 text-center text-gray-400">
                  <div className="animate-spin text-3xl mb-3">⏳</div>
                  <p className="text-sm font-semibold">Cargando balance de stock...</p>
                </div>
              ) : filteredStockProducts.length === 0 ? (
                <div className="p-16 text-center text-gray-400">
                  <div className="text-4xl mb-3">🏭</div>
                  <p className="text-base font-bold text-gray-700">No hay datos de productos</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Producto</th>
                        <th className="py-3 px-3">Categoría</th>
                        <th className="py-3 px-3 text-center bg-blue-50/40 text-blue-800">1. Producción (+)</th>
                        <th className="py-3 px-3 text-center bg-emerald-50/40 text-emerald-800">2. Vendidos (-)</th>
                        <th className="py-3 px-3 text-center bg-purple-50/40 text-purple-800">3. Devoluciones (+)</th>
                        <th className="py-3 px-3 text-center bg-amber-50/40 text-amber-800">4. En Ruta</th>
                        <th className="py-3 px-4 text-center bg-slate-900 text-white">Stock en Almacén</th>
                        <th className="py-3 px-3 text-center no-print">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {filteredStockProducts.map(s => {
                        const isLowStock = s.stockAlmacen <= 0
                        return (
                          <tr key={s.product.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-gray-900">
                              <div>{s.product.name}</div>
                              <div className="text-[11px] text-gray-400 font-normal">
                                Unidad: {s.product.unit} | Bs. {s.product.price.toFixed(2)}
                              </div>
                            </td>

                            <td className="py-3.5 px-3">
                              <span className="inline-block bg-blue-50 text-blue-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                {s.product.category}
                              </span>
                            </td>

                            {/* 1. Producción Ingresada */}
                            <td className="py-3.5 px-3 text-center bg-blue-50/20 font-black text-blue-700">
                              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-lg">
                                <span>+{s.totalProducido}</span>
                              </span>
                            </td>

                            {/* 2. Vendidos */}
                            <td className="py-3.5 px-3 text-center bg-emerald-50/20 font-black text-emerald-700">
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg">
                                <span>-{s.totalVendidoRegular + s.totalEntregadaBonif}</span>
                              </span>
                              {s.totalEntregadaBonif > 0 && (
                                <span className="text-[10px] text-purple-600 block">({s.totalEntregadaBonif} bonif)</span>
                              )}
                            </td>

                            {/* 3. Devoluciones de distribuidores */}
                            <td className="py-3.5 px-3 text-center bg-purple-50/20 font-black text-purple-700">
                              {s.totalDevuelto > 0 ? (
                                <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 px-2 py-0.5 rounded-lg">
                                  <span>+{s.totalDevuelto}</span>
                                </span>
                              ) : (
                                <span className="text-gray-300 font-normal">0</span>
                              )}
                            </td>

                            {/* 4. En Ruta */}
                            <td className="py-3.5 px-3 text-center bg-amber-50/20 font-bold text-amber-700">
                              {s.totalEnRuta > 0 ? (
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-lg">
                                  <span>🚚 x{s.totalEnRuta}</span>
                                </span>
                              ) : (
                                <span className="text-gray-300 font-normal">0</span>
                              )}
                            </td>

                            {/* Stock Real en Almacén */}
                            <td className="py-3.5 px-4 text-center font-black">
                              <span
                                className={`inline-block px-3 py-1 rounded-xl text-sm ${
                                  s.stockAlmacen > 20
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : s.stockAlmacen > 0
                                    ? 'bg-amber-400 text-slate-900 font-black'
                                    : 'bg-rose-500 text-white'
                                }`}
                              >
                                {s.stockAlmacen} {s.product.unit}
                              </span>
                              {isLowStock && (
                                <div className="text-[10px] text-rose-500 font-bold mt-0.5">
                                  ⚠️ Sin stock en bodega
                                </div>
                              )}
                            </td>

                            {/* Acción Rápida */}
                            <td className="py-3.5 px-3 text-center no-print">
                              <button
                                onClick={() => handleOpenCreateModal(s.product.id)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] px-2.5 py-1 rounded-lg transition-colors"
                              >
                                + Entrada
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Historial Reciente de Entradas de Producción */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">
                    Últimas Entradas de Producción Registradas
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Historial de mercadería ingresada al inventario
                  </p>
                </div>
              </div>

              {productionHistory.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">
                  Aún no has registrado ninguna entrada de producción. Presiona "Registrar Producción" arriba para comenzar.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase">
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Producto</th>
                        <th className="py-2.5 px-3 text-center">Cantidad Ingresada</th>
                        <th className="py-2.5 px-3">Notas / Lote</th>
                        <th className="py-2.5 px-3">Registrado Por</th>
                        <th className="py-2.5 px-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {productionHistory.map(entry => (
                        <tr key={entry.id} className="hover:bg-gray-50/50">
                          <td className="py-2.5 px-3 font-semibold text-gray-600">
                            {new Date(entry.date).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-gray-900">
                            {entry.product.name}
                          </td>
                          <td className="py-2.5 px-3 text-center font-black">
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                              entry.quantity >= 0 ? 'bg-blue-50 text-blue-800' : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              <span>{entry.quantity >= 0 ? `+${entry.quantity}` : entry.quantity} {entry.product.unit}</span>
                              {entry.quantity < 0 && <span className="text-[10px] text-rose-500 font-semibold">(Ajuste)</span>}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-gray-500">
                            {entry.notes || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-gray-500">
                            {entry.creator?.name || 'Administración'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-2.5">
                              <button
                                onClick={() => handleOpenEditModal(entry)}
                                className="text-blue-600 hover:text-blue-800 text-xs font-bold hover:underline"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleOpenDeleteModal(entry)}
                                className="text-rose-500 hover:text-rose-700 text-xs font-bold hover:underline"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── VISTA 2: BALANCE DE VENTAS Y DEVOLUCIONES ─── */}
        {activeTab === 'ventas' && (
          <div className="space-y-6">
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

            <div id="inventory-print-section" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {loading ? (
                <div className="p-16 text-center text-gray-400">
                  <div className="animate-spin text-3xl mb-3">⏳</div>
                  <p className="text-sm font-semibold">Cargando balance de ventas...</p>
                </div>
              ) : filteredSalesProducts.length === 0 ? (
                <div className="p-16 text-center text-gray-400">
                  <div className="text-4xl mb-3">🥔</div>
                  <p className="text-base font-bold text-gray-700">No se encontraron productos</p>
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
                      {filteredSalesProducts.map(s => {
                        const totalPedidas = s.pedidaRegular + s.pedidaBonif
                        const efectividad = totalPedidas > 0
                          ? Math.round(((s.vendidaRegular + s.entregadaBonif) / totalPedidas) * 100)
                          : 0

                        return (
                          <tr key={s.product.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-gray-900">
                              <div>{s.product.name}</div>
                              <div className="text-[11px] text-gray-400 font-normal">
                                Unidad: {s.product.unit} | {s.pedidosCount} pedidos
                              </div>
                            </td>

                            <td className="py-3.5 px-3">
                              <span className="inline-block bg-blue-50 text-blue-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                {s.product.category}
                              </span>
                            </td>

                            <td className="py-3.5 px-3 text-right font-medium text-gray-600">
                              Bs. {s.product.price.toFixed(2)}
                            </td>

                            <td className="py-3.5 px-3 text-center font-bold text-gray-700">
                              {s.pedidaRegular}
                              {s.pedidaBonif > 0 && (
                                <span className="text-[10px] text-purple-600 block">+{s.pedidaBonif} bonif</span>
                              )}
                            </td>

                            <td className="py-3.5 px-3 text-center bg-emerald-50/30 font-black text-emerald-700">
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg">
                                <span>x{s.vendidaRegular}</span>
                              </span>
                            </td>

                            <td className="py-3.5 px-3 text-center bg-rose-50/30 font-black text-rose-700">
                              {s.devueltaRegular > 0 || s.devueltaBonif > 0 ? (
                                <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 px-2 py-0.5 rounded-lg">
                                  <span>x{s.devueltaRegular + s.devueltaBonif}</span>
                                </span>
                              ) : (
                                <span className="text-gray-300 font-normal">0</span>
                              )}
                            </td>

                            <td className="py-3.5 px-3 text-center bg-purple-50/30 font-bold text-purple-700">
                              {s.entregadaBonif > 0 ? (
                                <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 px-2 py-0.5 rounded-lg">
                                  <span>🎁 x{s.entregadaBonif}</span>
                                </span>
                              ) : (
                                <span className="text-gray-300 font-normal">0</span>
                              )}
                            </td>

                            <td className="py-3.5 px-3 text-center bg-amber-50/30 font-bold text-amber-700">
                              {s.pendienteRegular + s.pendienteBonif > 0 ? (
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-lg">
                                  <span>⏳ x{s.pendienteRegular + s.pendienteBonif}</span>
                                </span>
                              ) : (
                                <span className="text-gray-300 font-normal">0</span>
                              )}
                            </td>

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
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── MODAL PARA REGISTRAR O EDITAR PRODUCCIÓN / ENTRADA A ALMACÉN ─── */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-up border border-gray-100">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{editingEntry ? '✏️' : '🏭'}</span>
                  <div>
                    <h3 className="font-black text-gray-900 text-base leading-tight">
                      {editingEntry ? 'Modificar Registro de Producción' : 'Registrar Producción / Ajuste'}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {editingEntry
                        ? 'Corrige la cantidad de este registro con tu contraseña de admin'
                        : 'Ingresa nueva producción o descuenta por corrección / merma'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveProduction} className="mt-4 space-y-4">
                {/* Selector de Tipo (Entrada vs Ajuste/Reducción) */}
                <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEntryType('in')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                      entryType === 'in'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    ➕ Entrada (+) Aumentar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryType('out')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                      entryType === 'out'
                        ? 'bg-rose-50 text-rose-700 shadow-sm border border-rose-200'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    ➖ Ajuste / Reducción (-)
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Producto: *
                  </label>
                  {editingEntry ? (
                    <div className="w-full text-xs font-bold border border-gray-200 rounded-xl p-2.5 bg-gray-50 text-gray-800">
                      {editingEntry.product.name} ({editingEntry.product.unit})
                    </div>
                  ) : (
                    <select
                      value={selectedProductId}
                      onChange={e => setSelectedProductId(e.target.value ? Number(e.target.value) : '')}
                      required
                      className="w-full text-xs font-semibold border border-gray-300 rounded-xl p-2.5 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">-- Elige un producto --</option>
                      {stockBalances.map(s => (
                        <option key={s.product.id} value={s.product.id}>
                          {s.product.name} ({s.product.unit}) - Cat: {s.product.category}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      {entryType === 'out' ? 'Cantidad a Descontar: *' : 'Cantidad Producida: *'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      placeholder={entryType === 'out' ? 'Ej. 5' : 'Ej. 100'}
                      value={prodQuantity}
                      onChange={e => setProdQuantity(e.target.value ? Number(e.target.value) : '')}
                      className="w-full text-xs font-bold border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {entryType === 'out' && (
                      <span className="text-[10px] text-rose-600 mt-0.5 block font-medium">
                        Se restará del stock de bodega
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Fecha:
                    </label>
                    <input
                      type="date"
                      value={prodDate}
                      onChange={e => setProdDate(e.target.value)}
                      className="w-full text-xs font-semibold border border-gray-300 rounded-xl p-2 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Nota / Motivo de Ajuste (Opcional):
                  </label>
                  <input
                    type="text"
                    placeholder={entryType === 'out' ? 'Ej. Corrección de conteo, merma, producto dañado' : 'Ej. Producción del día, lote mañana'}
                    value={prodNotes}
                    onChange={e => setProdNotes(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Confirmación con Contraseña de Administrador (si es edición o ajuste hacia abajo) */}
                {(editingEntry || entryType === 'out') && (
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-1.5 text-amber-900 text-xs font-bold">
                      <span>🔒 Autorización de Administrador</span>
                    </div>
                    <p className="text-[11px] text-amber-700 leading-tight">
                      {editingEntry
                        ? 'Para guardar cambios en una entrada existente, ingresa tu contraseña de admin.'
                        : 'Para descontar o reducir stock, ingresa tu contraseña de admin.'}
                    </p>
                    <input
                      type="password"
                      required
                      placeholder="Tu contraseña de usuario admin"
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      className="w-full text-xs border border-amber-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none font-semibold"
                    />
                  </div>
                )}

                <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingProd}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black text-white shadow-md transition-all disabled:opacity-50 flex items-center gap-2 ${
                      entryType === 'out'
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <span>
                      {submittingProd
                        ? 'Guardando...'
                        : editingEntry
                        ? 'Guardar Modificación'
                        : entryType === 'out'
                        ? 'Registrar Reducción (-)'
                        : 'Guardar Entrada (+)'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL SEGURO PARA ELIMINAR ENTRADA CON CONTRASEÑA ─── */}
        {deleteModal.show && deleteModal.entry && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-100 animate-scale-up">
              <div className="flex items-center gap-2 text-rose-600 mb-2">
                <span className="text-xl">⚠️</span>
                <h3 className="font-bold text-base text-gray-900">Eliminar Entrada</h3>
              </div>
              <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                ¿Estás seguro de eliminar el registro de{' '}
                <strong className="text-gray-900">
                  {deleteModal.entry.quantity > 0 ? `+${deleteModal.entry.quantity}` : deleteModal.entry.quantity}{' '}
                  {deleteModal.entry.product.unit}
                </strong>{' '}
                de <strong className="text-gray-900">{deleteModal.entry.product.name}</strong>? El stock se recalculará automáticamente.
              </p>
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Contraseña de Administrador: *
                </label>
                <input
                  type="password"
                  placeholder="Ingresa tu contraseña"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteModal({ show: false, entry: null })}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={submittingDelete || !deletePassword}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
                >
                  {submittingDelete ? 'Eliminando...' : 'Confirmar Eliminación'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
