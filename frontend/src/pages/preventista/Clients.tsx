import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { MapContainer, TileLayer, Marker, useMapEvents, Polygon } from 'react-leaflet'
import { getClients, createClient, updateClient, deleteClient } from '../../api/clients'
import { getRegions } from '../../api/regions'
import type { Client } from '../../types'
import L from 'leaflet'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

// ── Componente interno que captura clicks en el mapa ──────────
function LocationPicker({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}

// ── Componente del mapa de selección ─────────────────────────
function MapPicker({
  latitude,
  longitude,
  onChange,
  regions
}: {
  latitude: string
  longitude: string
  onChange: (lat: number, lng: number) => void
  regions: any[]
}) {
  const hasPosition = latitude && longitude
  const center: [number, number] = hasPosition
    ? [Number(latitude), Number(longitude)]
    : [-17.3895, -66.1568]

  const toLeafletCoords = (coords: number[][]): [number, number][] => {
    return coords.map(c => [c[1], c[0]])
  }

  return (
    <div className="rounded-xl overflow-hidden border border-gray-300" style={{ height: '220px' }}>
      <MapContainer
        center={center}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        <LocationPicker onSelect={onChange} />
        {regions.map(region => {
          if (!region.polygon?.coordinates) return null
          const coords = toLeafletCoords(region.polygon.coordinates[0])
          return (
            <Polygon
              key={region.id}
              positions={coords}
              pathOptions={{ color: region.color, fillColor: region.color, fillOpacity: 0.15, weight: 2 }}
              interactive={false}
            />
          )
        })}
        {hasPosition && (
          <Marker position={[Number(latitude), Number(longitude)]} />
        )}
      </MapContainer>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────
export default function PreventistaClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [regions, setRegions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', ownerName: '', phone: '', address: '',
    latitude: '', longitude: ''
  })

  const fetchClients = async () => {
    try {
      const [data, rData] = await Promise.all([getClients(), getRegions()])
      setClients(data)
      setRegions(rData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchClients() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', ownerName: '', phone: '', address: '', latitude: '', longitude: '' })
    setPhoto(null)
    setError('')
    setShowModal(true)
  }

  const openEdit = (client: Client) => {
    setEditing(client)
    setForm({
      name: client.name,
      ownerName: client.ownerName,
      phone: client.phone,
      address: client.address,
      latitude: client.latitude.toString(),
      longitude: client.longitude.toString()
    })
    setPhoto(null)
    setError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.latitude || !form.longitude) {
      setError('Debes seleccionar la ubicación en el mapa')
      return
    }
    setError('')
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      if (photo) fd.append('photo', photo)

      if (editing) {
        await updateClient(editing.id, fd)
      } else {
        await createClient(fd)
      }
      setShowModal(false)
      fetchClients()
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Desactivar este cliente?')) return
    try {
      await deleteClient(id)
      fetchClients()
    } catch (err) {
      console.error(err)
    }
  }

  const getLocation = () => {
    navigator.geolocation.getCurrentPosition(
      pos => setForm(f => ({
        ...f,
        latitude: pos.coords.latitude.toString(),
        longitude: pos.coords.longitude.toString()
      })),
      () => alert('No se pudo obtener la ubicación')
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
            <p className="text-gray-500 text-sm mt-1">Tiendas registradas</p>
          </div>
          <button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            + Nuevo cliente
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-12">Cargando...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map(client => (
              <div key={client.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {client.photoUrl ? (
                  <img src={client.photoUrl} alt={client.name} className="w-full h-36 object-cover" />
                ) : (
                  <div className="w-full h-36 bg-gray-100 flex items-center justify-center text-4xl">🏪</div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800">{client.name}</h3>
                  <p className="text-sm text-gray-500">{client.ownerName}</p>
                  <p className="text-sm text-gray-500 mt-1">{client.address}</p>
                  <p className="text-sm text-gray-500">📞 {client.phone}</p>
                  {client.region && (
                    <span
                      className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full"
                      style={{ background: client.region.color + '20', color: client.region.color }}
                    >
                      {client.region.name}
                    </span>
                  )}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => openEdit(client)}
                      className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(client.id)}
                      className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      Desactivar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-800 mb-5">
              {editing ? 'Editar cliente' : 'Nuevo cliente'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Nombre del negocio" value={form.name} onChange={v => setForm({ ...form, name: v })} required />
              <Field label="Nombre del dueño" value={form.ownerName} onChange={v => setForm({ ...form, ownerName: v })} required />
              <Field label="Teléfono" value={form.phone} onChange={v => setForm({ ...form, phone: v })} required />
              <Field label="Dirección" value={form.address} onChange={v => setForm({ ...form, address: v })} required />

              {/* Sección de ubicación */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Ubicación del local
                  </label>
                  <button
                    type="button"
                    onClick={getLocation}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    📍 Usar mi ubicación
                  </button>
                </div>

                {/* Mapa para elegir */}
                <MapPicker
                  latitude={form.latitude}
                  longitude={form.longitude}
                  regions={regions}
                  onChange={(lat, lng) => setForm(f => ({
                    ...f,
                    latitude: lat.toFixed(6),
                    longitude: lng.toFixed(6)
                  }))}
                />

                <p className="text-xs text-gray-400 mt-1.5 text-center">
                  Haz clic en el mapa para marcar la ubicación exacta del local
                </p>

                {/* Coordenadas mostradas */}
                {form.latitude && form.longitude && (
                  <div className="flex gap-2 mt-2">
                    <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600">
                      <span className="text-gray-400">Lat: </span>{form.latitude}
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600">
                      <span className="text-gray-400">Lng: </span>{form.longitude}
                    </div>
                  </div>
                )}
              </div>

              {/* Foto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Foto del local (opcional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setPhoto(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-600"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
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
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}

function Field({ label, value, onChange, required = false }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}