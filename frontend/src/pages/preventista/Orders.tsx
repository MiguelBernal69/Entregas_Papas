import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { getOrders, createOrder, updateOrder } from '../../api/orders'
import { getClients } from '../../api/clients'
import { getProducts } from '../../api/products'
import type { Order, Client, Product } from '../../types'

const statusColor: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  aceptado:  'bg-blue-100 text-blue-700',
  asignado:  'bg-purple-100 text-purple-700',
  entregado: 'bg-green-100 text-green-700'
}

interface ItemForm { productId: number; quantity: number; productName: string; price: number }

export default function PreventistaOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Order | null>(null)
  const [detail, setDetail] = useState<Order | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [clientId, setClientId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<ItemForm[]>([])

  const fetchData = async () => {
    try {
      const [ordersData, clientsData, productsData] = await Promise.all([
        getOrders(), getClients(), getProducts()
      ])
      setOrders(ordersData)
      setClients(clientsData)
      setProducts(productsData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const openCreate = () => {
    setEditing(null)
    setClientId('')
    setNotes('')
    setItems([])
    setError('')
    setShowModal(true)
  }

  const openEdit = (order: Order) => {
    setEditing(order)
    setClientId(order.clientId.toString())
    setNotes(order.notes ?? '')
    setItems(order.items.map(i => ({
      productId: i.productId,
      quantity: i.quantity,
      productName: i.product.name,
      price: i.unitPrice
    })))
    setError('')
    setShowModal(true)
  }

  const addItem = (productId: number) => {
    const product = products.find(p => p.id === productId)
    if (!product) return
    const exists = items.find(i => i.productId === productId)
    if (exists) {
      setItems(items.map(i => i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i))
    } else {
      setItems([...items, { productId, quantity: 1, productName: product.name, price: product.price }])
    }
  }

  const removeItem = (productId: number) => {
    setItems(items.filter(i => i.productId !== productId))
  }

  const updateQty = (productId: number, qty: number) => {
    if (qty < 1) return
    setItems(items.map(i => i.productId === productId ? { ...i, quantity: qty } : i))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) { setError('Agrega al menos un producto'); return }
    setError('')
    setSaving(true)
    try {
      const data = {
        clientId: Number(clientId),
        notes,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity }))
      }
      if (editing) {
        await updateOrder(editing.id, data)
      } else {
        await createOrder(data)
      }
      setShowModal(false)
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Mis Pedidos</h1>
            <p className="text-gray-500 text-sm mt-1">Pedidos que has subido al sistema</p>
          </div>
          <button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            + Nuevo pedido
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="text-center text-gray-400 py-12">Cargando...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-5 py-3 text-gray-600 font-medium">#</th>
                  <th className="text-left px-5 py-3 text-gray-600 font-medium">Cliente</th>
                  <th className="text-left px-5 py-3 text-gray-600 font-medium">Productos</th>
                  <th className="text-left px-5 py-3 text-gray-600 font-medium">Total</th>
                  <th className="text-left px-5 py-3 text-gray-600 font-medium">Estado</th>
                  <th className="text-left px-5 py-3 text-gray-600 font-medium">Fecha</th>
                  <th className="text-left px-5 py-3 text-gray-600 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 font-medium text-gray-800">#{order.id}</td>
                    <td className="px-5 py-4 text-gray-800">{order.client.name}</td>
                    <td className="px-5 py-4 text-gray-500">{order.items.length} producto(s)</td>
                    <td className="px-5 py-4 font-medium">
                      Bs. {order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toFixed(2)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusColor[order.status]}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 flex gap-2">
                      <button
                        onClick={() => setDetail(order)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                      >
                        Ver
                      </button>
                      {['pendiente', 'aceptado'].includes(order.status) && (
                        <button
                          onClick={() => openEdit(order)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          Editar
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

      {/* Modal crear/editar pedido */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-800 mb-5">
              {editing ? 'Editar pedido' : 'Nuevo pedido'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  required
                  disabled={!!editing}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar cliente</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} — {c.ownerName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Agregar productos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agregar producto</label>
                <select
                  onChange={e => { if (e.target.value) addItem(Number(e.target.value)); e.target.value = '' }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar producto...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — Bs. {p.price.toFixed(2)} / {p.unit}</option>
                  ))}
                </select>
              </div>

              {/* Lista de items */}
              {items.length > 0 && (
                <div className="border rounded-xl overflow-hidden">
                  {items.map(item => (
                    <div key={item.productId} className="flex items-center justify-between px-4 py-3 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{item.productName}</p>
                        <p className="text-xs text-gray-500">Bs. {item.price.toFixed(2)} c/u</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => updateQty(item.productId, item.quantity - 1)} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold">−</button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button type="button" onClick={() => updateQty(item.productId, item.quantity + 1)} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold">+</button>
                        <button type="button" onClick={() => removeItem(item.productId)} className="ml-2 text-red-400 hover:text-red-600 text-lg">✕</button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-3 bg-gray-50 font-semibold text-sm">
                    <span>Total</span>
                    <span>Bs. {total.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium py-2.5 rounded-lg"
                >
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal detalle */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800">Pedido #{detail.id}</h2>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Cliente</span>
                <span className="font-medium">{detail.client.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Estado</span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusColor[detail.status]}`}>{detail.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Dirección</span>
                <span className="font-medium text-right">{detail.client.address}</span>
              </div>
              {detail.notes && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Notas</span>
                  <span className="font-medium">{detail.notes}</span>
                </div>
              )}
              <div className="border-t pt-3 space-y-2">
                {detail.items.map(item => (
                  <div key={item.id} className="flex justify-between">
                    <span className="text-gray-600">{item.product.name} x{item.quantity}</span>
                    <span className="font-medium">Bs. {(item.unitPrice * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Total</span>
                  <span>Bs. {detail.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}