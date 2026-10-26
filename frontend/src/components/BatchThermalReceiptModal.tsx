import { useState, useRef } from 'react'
import type { Order } from '../types'

interface BatchThermalReceiptModalProps {
  orders: Order[]
  title?: string
  onClose: () => void
}

export default function BatchThermalReceiptModal({
  orders,
  title = 'Imprimir Boletas en Lote',
  onClose,
}: BatchThermalReceiptModalProps) {
  const [printerMode, setPrinterMode] = useState<'80mm' | '58mm' | 'a4'>('80mm')
  const [includeSummary, setIncludeSummary] = useState(true)
  const [copied, setCopied] = useState(false)
  const printAreaRef = useRef<HTMLDivElement>(null)

  if (!orders || orders.length === 0) return null

  // Totales acumulados
  const totalBultosVenta = orders.reduce(
    (sum, o) => sum + o.items.filter(i => !i.isBonification).reduce((s, i) => s + i.quantity, 0),
    0
  )
  const totalBultosBonif = orders.reduce(
    (sum, o) => sum + o.items.filter(i => i.isBonification).reduce((s, i) => s + i.quantity, 0),
    0
  )
  const totalBultosGeneral = totalBultosVenta + totalBultosBonif

  const totalCobrarGeneral = orders.reduce((sum, o) => {
    const regularItems = o.items.filter(i => !i.isBonification)
    const sub = regularItems.reduce(
      (s, i) => s + i.unitPrice * (i.deliveredQuantity ?? i.quantity),
      0
    )
    return sum + Math.max(0, sub - Number(o.discount || 0))
  }, 0)

  // Resumen consolidado de productos en la carga
  const productSummary: Record<string, { regular: number; bonif: number; unitPrice: number }> = {}
  orders.forEach(o => {
    o.items.forEach(it => {
      const name = it.product.name
      if (!productSummary[name]) {
        productSummary[name] = { regular: 0, bonif: 0, unitPrice: it.unitPrice }
      }
      if (it.isBonification) {
        productSummary[name].bonif += it.quantity
      } else {
        productSummary[name].regular += (it.deliveredQuantity ?? it.quantity)
      }
    })
  })

  // Generador de texto plano para todas las boletas
  const generateAllReceiptsText = (width: '80mm' | '58mm' | 'a4'): string => {
    const colWidth = width === '58mm' ? 32 : 44
    const divider = '-'.repeat(colWidth)
    const dblDivider = '='.repeat(colWidth)

    const center = (text: string) => {
      if (text.length >= colWidth) return text.substring(0, colWidth)
      const pad = Math.floor((colWidth - text.length) / 2)
      return ' '.repeat(pad) + text
    }

    const row = (left: string, right: string) => {
      const space = colWidth - left.length - right.length
      if (space <= 0) return `${left} ${right}`
      return left + ' '.repeat(space) + right
    }

    const lines: string[] = []

    if (includeSummary) {
      lines.push(dblDivider)
      lines.push(center('HOJA DE RUTA / CARGA TOTAL'))
      lines.push(center('DISTRIBUIDORA LUNOVA'))
      lines.push(center('contacto: 74347987'))
      lines.push(dblDivider)
      lines.push(row('FECHA:', new Date().toLocaleDateString()))
      lines.push(row('HORA:', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })))
      lines.push(row('TOTAL PEDIDOS:', `${orders.length}`))
      lines.push(row('TOTAL BULTOS/UNDS:', `${totalBultosGeneral}`))
      lines.push(row('TOTAL A COBRAR:', `Bs. ${totalCobrarGeneral.toFixed(2)}`))
      lines.push(divider)
      lines.push('RESUMEN DE PRODUCTOS:')
      lines.push(divider)
      Object.entries(productSummary).forEach(([name, data]) => {
        lines.push(`${data.regular}x ${name}`)
        if (data.bonif > 0) {
          lines.push(`  + ${data.bonif}x [BONIF GRATIS]`)
        }
      })
      lines.push(dblDivider)
      lines.push(center('FIN RESUMEN DE CARGA'))
      lines.push(dblDivider)
      lines.push('\n\n')
    }

    orders.forEach((order) => {
      const regularItems = order.items.filter(i => !i.isBonification)
      const bonifItems = order.items.filter(i => i.isBonification)
      const discountVal = Number(order.discount || 0)
      const subtotal = regularItems.reduce((acc, i) => acc + i.unitPrice * (i.deliveredQuantity ?? i.quantity), 0)
      const finalTotal = Math.max(0, subtotal - discountVal)

      lines.push(center('DISTRIBUIDORA LUNOVA'))
      lines.push(center('contacto: 74347987'))
      lines.push(divider)
      lines.push(`pedido #${order.id}`)
      lines.push(`vendedor: ${order.preventista?.name || order.distributor?.name || 'Distribución'}`)
      const dateToUse = order.deliveredAt ? new Date(order.deliveredAt) : new Date(order.createdAt)
      const dateFormatted = `${dateToUse.toLocaleDateString()} ${dateToUse.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      lines.push(`fecha entrega: ${dateFormatted}`)
      lines.push(`cliente: ${order.client.name}`)
      if (order.client.phone) lines.push(`contacto: ${order.client.phone}`)
      if (order.client.address) lines.push(`direccion: ${order.client.address}`)
      lines.push(divider)

      if (width === '58mm') {
        lines.push('Descripcion         CANT  P.U  total')
      } else {
        lines.push('Descripcion                    CANT   P.U    total')
      }
      lines.push(divider)

      for (const it of regularItems) {
        const qty = it.deliveredQuantity ?? it.quantity
        const cant = `x${qty}`
        const price = it.unitPrice.toFixed(2)
        const subt = (it.unitPrice * qty).toFixed(2)
        const maxLen = width === '58mm' ? 16 : 26

        lines.push(
          `${it.product.name.substring(0, maxLen).padEnd(maxLen)} ${cant.padStart(4)} ${price.padStart(5)} ${subt.padStart(6)}`
        )
      }

      // Solo si el pedido tiene bonificaciones
      if (bonifItems.length > 0) {
        lines.push(divider)
        lines.push('*** BONIFICACIONES (GRATIS) ***')
        for (const it of bonifItems) {
          lines.push(`[BONIF] ${it.product.name} x${it.quantity} (GRATIS)`)
        }
      }

      lines.push(divider)
      // Solo si el pedido tiene descuento de preventa
      if (discountVal > 0) {
        lines.push(row('subtotal:', `Bs. ${subtotal.toFixed(2)}`))
        lines.push(row('descuento:', `-Bs. ${discountVal.toFixed(2)}`))
        lines.push(divider)
      }

      lines.push(row('total:', `Bs. ${finalTotal.toFixed(2)}`))
      lines.push(divider)
      if (order.notes) {
        lines.push(`obs: ${order.notes}`)
        lines.push(divider)
      }
      lines.push(center('gracias por su compra'))
      lines.push('')
      lines.push(`- - - - - - - - - - CORTAR AQUI (#${order.id}) - - - - - - - - - -`)
      lines.push('')
      lines.push('')
    })

    return lines.join('\n')
  }

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generateAllReceiptsText(printerMode))
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // fallback
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      {/* Estilos para impresión masiva de boletas continuas o paginadas */}
      <style>{`
        @media print {
          @page {
            size: ${printerMode === '80mm' ? '80mm auto' : printerMode === '58mm' ? '58mm auto' : 'A4 portrait'};
            margin: ${printerMode === 'a4' ? '10mm' : '0'};
          }
          body * {
            visibility: hidden;
          }
          #batch-thermal-container, #batch-thermal-container * {
            visibility: visible;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #batch-thermal-container {
            position: absolute;
            left: 0;
            top: 0;
            width: ${printerMode === '80mm' ? '80mm' : printerMode === '58mm' ? '58mm' : '100%'} !important;
            padding: ${printerMode === 'a4' ? '0' : '4mm'} !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 13px !important;
            font-weight: bold !important;
            line-height: 1.25 !important;
          }
          .batch-receipt-item {
            page-break-after: always !important;
            break-after: page !important;
            margin-bottom: ${printerMode === 'a4' ? '0' : '12mm'} !important;
            padding-bottom: ${printerMode === 'a4' ? '0' : '8mm'} !important;
            border-bottom: ${printerMode === 'a4' ? 'none' : '2px dashed #000'} !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[95vh] border border-gray-100">
        {/* Cabecera del modal */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between no-print">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🖨️</span>
              <h3 className="font-bold text-base">{title}</h3>
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {orders.length} pedidos
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Imprime todos los pedidos juntos en una sola tirada para salir a repartir
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Barra de Controles y Selector de Formato */}
        <div className="bg-slate-50 p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Formato:</span>
            <button
              onClick={() => setPrinterMode('80mm')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                printerMode === '80mm'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              80mm (Epson)
            </button>
            <button
              onClick={() => setPrinterMode('58mm')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                printerMode === '58mm'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              58mm (POS)
            </button>
            <button
              onClick={() => setPrinterMode('a4')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                printerMode === 'a4'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              Hoja A4 / Carta
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSummary}
              onChange={e => setIncludeSummary(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <span>Incluir Hoja de Resumen de Carga</span>
          </label>
        </div>

        {/* Resumen Superior */}
        <div className="bg-blue-50/70 border-b border-blue-100 p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs text-blue-900 no-print">
          <div>
            <strong>Total Pedidos:</strong> {orders.length} | <strong>Total Bultos:</strong> {totalBultosGeneral} ({totalBultosVenta} venta + {totalBultosBonif} bonif.)
          </div>
          <div className="text-sm font-black text-blue-700">
            Total a Cobrar en Ruta: Bs. {totalCobrarGeneral.toFixed(2)}
          </div>
        </div>

        {/* Contenido Visual Previsualizable / Imprimible */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-200/50 flex justify-center">
          <div
            id="batch-thermal-container"
            ref={printAreaRef}
            className={`bg-white shadow-md p-4 transition-all duration-200 ${
              printerMode === '80mm'
                ? 'w-[320px]'
                : printerMode === '58mm'
                ? 'w-[230px]'
                : 'w-[500px]'
            } font-mono text-[13px] font-bold leading-snug select-text`}
          >
            {/* Hoja de Resumen de Carga (Opcional) */}
            {includeSummary && (
              <div className="batch-receipt-item pb-4 mb-6 border-b-2 border-dashed border-black">
                <div className="text-center pb-2">
                  <h4 className="font-black text-[15px] tracking-wide">DISTRIBUIDORA LUNOVA</h4>
                  <p className="text-[12px] font-bold text-black mt-0.5">contacto: 74347987</p>
                  <p className="text-[12px] font-black text-black mt-0.5">
                    === RESUMEN / MANIFIESTO DE RUTA ===
                  </p>
                  <div className="border-b-2 border-dashed border-black my-2" />
                </div>

                <div className="space-y-1 mb-2 text-[12px] font-bold">
                  <div className="flex justify-between">
                    <span>FECHA:</span>
                    <span>{new Date().toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>HORA IMPRESIÓN:</span>
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex justify-between font-black">
                    <span>TOTAL PEDIDOS:</span>
                    <span>{orders.length}</span>
                  </div>
                  <div className="flex justify-between font-black">
                    <span>TOTAL BULTOS/UNDS:</span>
                    <span>{totalBultosGeneral}</span>
                  </div>
                  <div className="flex justify-between font-black text-[14px] text-black pt-1 border-t border-black">
                    <span>TOTAL A COBRAR:</span>
                    <span>Bs. {totalCobrarGeneral.toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-b border-black my-2" />
                <div className="font-black text-[12px] pb-1">CARGA POR PRODUCTO:</div>
                <div className="space-y-1 text-[12px]">
                  {Object.entries(productSummary).map(([name, data]) => (
                    <div key={name} className="flex justify-between items-start">
                      <span className="flex-1">
                        <strong>{data.regular}x</strong> {name}
                        {data.bonif > 0 && <span className="text-black"> (+{data.bonif} bonif)</span>}
                      </span>
                      <span className="font-black">{(data.regular + data.bonif)} bultos</span>
                    </div>
                  ))}
                </div>

                <div className="border-b-2 border-dashed border-black my-3" />
                <div className="text-center text-[11px] font-black">
                  - - - - - - INICIO DE BOLETAS INDIVIDUALES - - - - - -
                </div>
              </div>
            )}

            {/* Boletas individuales de cada pedido */}
            {orders.map((order) => {
              const regularItems = order.items.filter(i => !i.isBonification)
              const bonifItems = order.items.filter(i => i.isBonification)
              const discountVal = Number(order.discount || 0)
              const subtotal = regularItems.reduce(
                (acc, i) => acc + i.unitPrice * (i.deliveredQuantity ?? i.quantity),
                0
              )
              const finalTotal = Math.max(0, subtotal - discountVal)

              return (
                <div key={order.id} className="batch-receipt-item pb-4 mb-6">
                  {/* Encabezado */}
                  <div className="text-center pb-2">
                    <h4 className="font-black text-[15px] tracking-wide">DISTRIBUIDORA LUNOVA</h4>
                    <p className="text-[12px] font-bold text-black mt-0.5">contacto: 74347987</p>
                    <div className="border-b border-black my-1.5" />
                  </div>

                  {/* Datos del Pedido */}
                  <div className="space-y-1 mb-2 font-bold text-[12px]">
                    <div className="font-black">pedido #{order.id}</div>
                    <div><span className="font-black">vendedor:</span> {order.preventista?.name || order.distributor?.name || 'Distribución'}</div>
                    <div>
                      <span className="font-black">fecha entrega:</span>{' '}
                      {(() => {
                        const d = order.deliveredAt ? new Date(order.deliveredAt) : new Date(order.createdAt)
                        return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      })()}
                    </div>
                    <div><span className="font-black">cliente:</span> {order.client.name}</div>
                    {order.client.phone && <div><span className="font-black">contacto:</span> {order.client.phone}</div>}
                    {order.client.address && <div><span className="font-black">direccion:</span> {order.client.address}</div>}
                  </div>

                  <div className="border-b border-black my-1.5" />

                  {/* Encabezado de Productos */}
                  <div className="flex justify-between font-black text-[12px] pb-1 border-b border-black">
                    <span className="flex-1 min-w-0 pr-1">Descripcion</span>
                    <span className="w-10 text-center">CANT</span>
                    <span className="w-12 text-right">P.U</span>
                    <span className="w-14 text-right">total</span>
                  </div>

                  {/* Items Regulares */}
                  <div className="py-1 space-y-1">
                    {regularItems.map(item => {
                      const qty = item.deliveredQuantity ?? item.quantity
                      return (
                        <div key={item.id} className="flex items-start gap-1 text-[12px] font-bold">
                          <span className="flex-1 min-w-0 pr-1 break-all leading-tight">{item.product.name}</span>
                          <span className="w-10 shrink-0 text-center font-black">x{qty}</span>
                          <span className="w-12 shrink-0 text-right">{item.unitPrice.toFixed(2)}</span>
                          <span className="w-14 shrink-0 text-right font-black">
                            {(item.unitPrice * qty).toFixed(2)}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Bonificaciones (Solo si tiene) */}
                  {bonifItems.length > 0 && (
                    <div className="my-1 border-t border-dashed border-black pt-1">
                      <div className="text-[11px] font-black tracking-wide text-black">
                        🎁 BONIFICACIONES (GRATIS)
                      </div>
                      <div className="space-y-1 mt-0.5 font-bold">
                        {bonifItems.map(item => (
                          <div key={`bon-${item.id}`} className="flex items-start gap-1 text-[12px] text-black">
                            <span className="flex-1 min-w-0 pr-1 break-all leading-tight">[BONIF] {item.product.name}</span>
                            <span className="w-10 shrink-0 text-center font-black">x{item.quantity}</span>
                            <span className="w-12 shrink-0 text-right text-[10px]">0.00</span>
                            <span className="w-14 shrink-0 text-right font-black text-[10px]">GRATIS</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-b border-black my-1.5" />

                  {/* Totales y Descuentos */}
                  <div className="space-y-0.5 text-[12px] font-bold">
                    {discountVal > 0 && (
                      <>
                        <div className="flex justify-between text-black">
                          <span>subtotal:</span>
                          <span>Bs. {subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-black text-black">
                          <span>descuento:</span>
                          <span>-Bs. {discountVal.toFixed(2)}</span>
                        </div>
                        <div className="border-b border-dashed border-black my-1" />
                      </>
                    )}
                    <div className="flex justify-between font-black text-[14px] pt-0.5">
                      <span>total:</span>
                      <span>Bs. {finalTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {order.notes && (
                    <div className="mt-2 border-t border-dashed border-black pt-1 text-[11px] text-black font-bold">
                      <span className="font-black">obs:</span> {order.notes}
                    </div>
                  )}

                  <div className="border-t border-black my-2" />

                  <div className="text-center pb-1 text-[12px] font-bold lowercase">
                    gracias por su compra
                  </div>

                  {/* Marca de corte para la impresora térmica */}
                  <div className="text-center my-3 text-[10px] text-gray-600 font-bold tracking-widest">
                    - - - - - - - ✂️ CORTE TICKET #{order.id} - - - - - - -
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Botones de acción inferiores */}
        <div className="bg-white p-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 no-print">
          <button
            onClick={handleCopyText}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
          >
            <span>{copied ? '✅' : '📋'}</span>
            <span>{copied ? '¡Copiado al portapapeles!' : 'Copiar todo el texto plano'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handlePrint}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 transform hover:scale-105"
            >
              <span className="text-sm">🖨️</span>
              <span>Imprimir Todo en Uno ({orders.length} pedidos)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
