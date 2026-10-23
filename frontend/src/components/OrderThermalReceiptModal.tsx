import { useState, useRef } from 'react'
import type { Order } from '../types'

interface OrderThermalReceiptModalProps {
  order: Order | null
  onClose: () => void
}

export default function OrderThermalReceiptModal({ order, onClose }: OrderThermalReceiptModalProps) {
  const [printerMode, setPrinterMode] = useState<'80mm' | '58mm'>('80mm')
  const [copied, setCopied] = useState(false)
  const printAreaRef = useRef<HTMLDivElement>(null)

  if (!order) return null

  const regularItems = order.items.filter(i => !i.isBonification)
  const bonifItems = order.items.filter(i => i.isBonification)
  const discountVal = Number(order.discount || 0)
  const subtotal = regularItems.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)
  const finalTotal = Math.max(0, subtotal - discountVal)
  const regularBultos = regularItems.reduce((acc, i) => acc + i.quantity, 0)
  const bonifBultos = bonifItems.reduce((acc, i) => acc + i.quantity, 0)
  const totalBultos = regularBultos + bonifBultos

  // Texto térmico para Bluetooth / RawBT / Portapapeles
  const generateReceiptText = (width: '80mm' | '58mm'): string => {
    const colWidth = width === '80mm' ? 44 : 32
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
    lines.push(dblDivider)
    lines.push(center('DISTRIBUIDORA DE PAPAS'))
    lines.push(center(width === '80mm' ? 'EPSON TM-T20III (80mm)' : 'BOLETA TERMICA (58mm)'))
    lines.push(dblDivider)
    lines.push(row(`PEDIDO: #${order.id}`, `EST: ${order.status.toUpperCase()}`))
    lines.push(row('FECHA:', new Date(order.createdAt).toLocaleDateString()))
    lines.push(row('HORA:', new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })))
    lines.push(divider)
    lines.push(`CLIENTE: ${order.client.name}`)
    if (order.client.ownerName) lines.push(`PROPIETARIO: ${order.client.ownerName}`)
    if (order.client.phone) lines.push(`TEL: ${order.client.phone}`)
    if (order.client.address) lines.push(`DIR: ${order.client.address}`)
    if (order.preventista?.name) lines.push(`PREVENTISTA: ${order.preventista.name}`)
    if (order.distributor?.name) lines.push(`DISTRIBUIDOR: ${order.distributor.name}`)
    lines.push(divider)

    if (width === '80mm') {
      lines.push('CANT  DESCRIPCION                 P.UNIT    SUBTOT')
    } else {
      lines.push('CANT DESCRIPCION    P.U   SUBT')
    }
    lines.push(divider)

    for (const it of regularItems) {
      const cant = `${it.quantity}x`
      const price = it.unitPrice.toFixed(2)
      const subt = (it.unitPrice * it.quantity).toFixed(2)
      const maxLen = width === '80mm' ? 24 : 14

      if (it.product.name.length <= maxLen) {
        if (width === '80mm') {
          lines.push(`${cant.padEnd(5)} ${it.product.name.padEnd(maxLen)} ${price.padStart(7)} ${subt.padStart(8)}`)
        } else {
          lines.push(`${cant.padEnd(4)} ${it.product.name.padEnd(maxLen)} ${price.padStart(5)} ${subt.padStart(6)}`)
        }
      } else {
        const first = it.product.name.substring(0, maxLen)
        if (width === '80mm') {
          lines.push(`${cant.padEnd(5)} ${first} ${price.padStart(7)} ${subt.padStart(8)}`)
          let rem = it.product.name.substring(maxLen).trim()
          while (rem.length > 0) {
            lines.push(`      ${rem.substring(0, maxLen)}`)
            rem = rem.substring(maxLen).trim()
          }
        } else {
          lines.push(`${cant.padEnd(4)} ${first} ${price.padStart(5)} ${subt.padStart(6)}`)
          let rem = it.product.name.substring(maxLen).trim()
          while (rem.length > 0) {
            lines.push(`     ${rem.substring(0, maxLen)}`)
            rem = rem.substring(maxLen).trim()
          }
        }
      }
    }

    if (bonifItems.length > 0) {
      lines.push(divider)
      lines.push(width === '80mm' ? '*** BONIFICACIONES (GRATIS) ***' : '** BONIFICACIONES (GRATIS) **')
      for (const it of bonifItems) {
        const cant = `${it.quantity}x`
        const maxLen = width === '80mm' ? 24 : 14
        const fullName = `[BONIF] ${it.product.name}`

        if (fullName.length <= maxLen) {
          if (width === '80mm') {
            lines.push(`${cant.padEnd(5)} ${fullName.padEnd(maxLen)}    0.00     0.00`)
          } else {
            lines.push(`${cant.padEnd(4)} ${fullName.padEnd(maxLen)}  0.00   0.00`)
          }
        } else {
          const first = fullName.substring(0, maxLen)
          if (width === '80mm') {
            lines.push(`${cant.padEnd(5)} ${first}    0.00     0.00`)
            let rem = fullName.substring(maxLen).trim()
            while (rem.length > 0) {
              lines.push(`      ${rem.substring(0, maxLen)}`)
              rem = rem.substring(maxLen).trim()
            }
          } else {
            lines.push(`${cant.padEnd(4)} ${first}  0.00   0.00`)
            let rem = fullName.substring(maxLen).trim()
            while (rem.length > 0) {
              lines.push(`     ${rem.substring(0, maxLen)}`)
              rem = rem.substring(maxLen).trim()
            }
          }
        }
      }
    }

    lines.push(divider)
    lines.push(row('SUBTOTAL:', `Bs. ${subtotal.toFixed(2)}`))
    if (discountVal > 0) {
      lines.push(row('DESCUENTO PREVENTA:', `-Bs. ${discountVal.toFixed(2)}`))
    }
    lines.push(dblDivider)
    lines.push(row('TOTAL A COBRAR:', `Bs. ${finalTotal.toFixed(2)}`))
    lines.push(dblDivider)

    lines.push(row('BULTOS VENTA:', `${regularBultos}`))
    if (bonifBultos > 0) {
      lines.push(row('BULTOS BONIFICACION:', `${bonifBultos} [GRATIS]`))
    }
    lines.push(row('TOTAL BULTOS/UNDS:', `${totalBultos}`))
    lines.push(dblDivider)

    if (order.notes) {
      lines.push(`OBS: ${order.notes}`)
      lines.push(divider)
    }

    lines.push(center('¡Gracias por su preferencia!'))
    lines.push('')
    lines.push('')
    return lines.join('\n')
  }

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generateReceiptText(printerMode))
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
      {/* Estilos para impresión térmica en negrita y tamaño de fuente más grande que antes */}
      <style>{`
        @media print {
          @page {
            size: ${printerMode === '80mm' ? '80mm auto' : '58mm auto'};
            margin: 0;
          }
          body * {
            visibility: hidden;
          }
          #thermal-print-container, #thermal-print-container * {
            visibility: visible;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #thermal-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: ${printerMode === '80mm' ? '80mm' : '58mm'} !important;
            padding: 4mm !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 13px !important;
            font-weight: bold !important;
            line-height: 1.25 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[95vh] border border-gray-100">
        {/* Cabecera del modal */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between no-print">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🖨️</span>
              <h3 className="font-bold text-base">Boleta Térmica de Entrega</h3>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Compatible con Epson TM-T20III (80mm) y Bluetooth (58mm)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Selector de Impresora */}
        <div className="bg-slate-100 p-3 flex items-center justify-between gap-2 border-b border-slate-200 no-print">
          <span className="text-xs font-semibold text-slate-600">Formato:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPrinterMode('80mm')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                printerMode === '80mm'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span>🖨️ Epson TM-T20III (80mm)</span>
              <span className="text-[10px] bg-blue-700 text-blue-100 px-1.5 py-0.2 rounded-full font-normal">
                POS
              </span>
            </button>
            <button
              onClick={() => setPrinterMode('58mm')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                printerMode === '58mm'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span>📱 Bluetooth (58mm)</span>
            </button>
          </div>
        </div>

        {/* Vista Previa del Ticket Térmico (Como antes, en negrita y fuente más grande) */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-200/60 flex justify-center">
          <div
            id="thermal-print-container"
            ref={printAreaRef}
            className={`bg-white shadow-md p-5 text-black border border-slate-300 transition-all ${
              printerMode === '80mm' ? 'w-[360px]' : 'w-[280px]'
            } font-mono text-[13px] font-bold leading-snug select-text`}
          >
            {/* Cabecera */}
            <div className="text-center pb-2">
              <h4 className="font-black text-[15px] tracking-wide">DISTRIBUIDORA DE PAPAS</h4>
              <p className="text-[11px] font-bold text-gray-700 mt-0.5">
                {printerMode === '80mm' ? 'EPSON TM-T20III (80mm)' : 'IMPRESORA TERMICA (58mm)'}
              </p>
              <div className="border-b-2 border-dashed border-black my-2" />
            </div>

            {/* Datos del Pedido */}
            <div className="space-y-1 mb-2 font-bold text-[13px]">
              <div className="flex justify-between font-black">
                <span>PEDIDO: #{order.id}</span>
                <span className="uppercase text-[11px] px-1.5 bg-gray-100 border border-black font-black">
                  {order.status}
                </span>
              </div>
              <div className="flex justify-between text-black">
                <span>FECHA: {new Date(order.createdAt).toLocaleDateString()}</span>
                <span>HORA: {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="border-b border-dashed border-black my-1.5" />
              <div><span className="font-black">CLIENTE:</span> {order.client.name}</div>
              {order.client.ownerName && <div><span className="font-black">PROP:</span> {order.client.ownerName}</div>}
              {order.client.address && <div><span className="font-black">DIR:</span> {order.client.address}</div>}
              {order.client.phone && <div><span className="font-black">TEL:</span> {order.client.phone}</div>}
              {order.preventista?.name && <div><span className="font-black">PREVENTISTA:</span> {order.preventista.name}</div>}
              {order.distributor?.name && <div><span className="font-black">DISTRIBUIDOR:</span> {order.distributor.name}</div>}
            </div>

            <div className="border-b-2 border-black my-2" />

            {/* Encabezado de Productos */}
            <div className="flex justify-between font-black text-[13px] pb-1 border-b border-dashed border-black">
              <span className="w-8">CANT</span>
              <span className="flex-1 px-1">DESCRIPCION</span>
              <span className="w-12 text-right">P.U</span>
              <span className="w-14 text-right">TOTAL</span>
            </div>

            {/* Items Regulares */}
            <div className="py-1 space-y-1.5">
              {regularItems.map(item => (
                <div key={item.id} className="flex items-start gap-1 text-[13px] font-bold">
                  <span className="w-8 shrink-0 font-black">{item.quantity}x</span>
                  <span className="flex-1 min-w-0 px-1 break-all leading-tight">{item.product.name}</span>
                  <span className="w-12 shrink-0 text-right">{item.unitPrice.toFixed(2)}</span>
                  <span className="w-14 shrink-0 text-right font-black">
                    {(item.unitPrice * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Bonificaciones */}
            {bonifItems.length > 0 && (
              <div className="my-1.5 border-t border-dashed border-black pt-1.5">
                <div className="text-[12px] font-black tracking-wide text-black">
                  🎁 BONIFICACIONES (GRATIS)
                </div>
                <div className="space-y-1.5 mt-1 font-bold">
                  {bonifItems.map(item => (
                    <div key={`bon-${item.id}`} className="flex items-start gap-1 text-[13px] text-black">
                      <span className="w-8 shrink-0 font-black">{item.quantity}x</span>
                      <span className="flex-1 min-w-0 px-1 break-all leading-tight">[BONIF] {item.product.name}</span>
                      <span className="w-12 shrink-0 text-right text-[11px]">0.00</span>
                      <span className="w-14 shrink-0 text-right font-black text-[11px]">GRATIS</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-b-2 border-dashed border-black my-2" />

            {/* Totales y Descuentos */}
            <div className="space-y-1 text-[13px] font-bold">
              {discountVal > 0 ? (
                <>
                  <div className="flex justify-between text-black">
                    <span>Subtotal:</span>
                    <span>Bs. {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-black text-black">
                    <span>🏷️ Descuento preventa:</span>
                    <span>-Bs. {discountVal.toFixed(2)}</span>
                  </div>
                  <div className="border-b border-black my-1" />
                  <div className="flex justify-between font-black text-[15px] pt-0.5">
                    <span>TOTAL A COBRAR:</span>
                    <span>Bs. {finalTotal.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between font-black text-[15px] pt-0.5">
                  <span>TOTAL:</span>
                  <span>Bs. {finalTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-[12px] text-black pt-1 border-t border-dashed border-black font-bold">
                <span>Total bultos / unidades:</span>
                <span className="font-black">{totalBultos}</span>
              </div>
            </div>

            {order.notes && (
              <div className="mt-3 border-t border-dashed border-black pt-1.5 text-[11px] text-black font-bold">
                <span className="font-black">OBS:</span> {order.notes}
              </div>
            )}

            {/* Pie de Boleta */}
            <div className="text-center mt-5 pt-3 border-t-2 border-dashed border-black font-bold">
              <p className="font-black text-[13px]">¡GRACIAS POR SU COMPRA!</p>
              <p className="text-[10px] text-gray-700 mt-0.5">Comprobante de Entrega y Pedido</p>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
          <button
            onClick={handleCopyText}
            className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            {copied ? (
              <>
                <span className="text-green-600 font-bold">✓</span>
                <span className="text-green-600 font-bold">¡Texto Copiado!</span>
              </>
            ) : (
              <>
                <span>📋</span>
                <span>Copiar Texto Térmico</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2 transition-colors"
            >
              <span>🖨️</span>
              <span>Imprimir en {printerMode === '80mm' ? 'Epson TM-T20III' : 'Bluetooth'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
