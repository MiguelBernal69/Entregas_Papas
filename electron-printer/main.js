const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

const SERVER_URL = 'http://178.105.45.6'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Distribuidora Lunova — Sistema de Entregas',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(SERVER_URL)
  mainWindow.setMenuBarVisibility(false)

  mainWindow.webContents.on('did-fail-load', () => {
    mainWindow.webContents.loadURL(`data:text/html,<!DOCTYPE html>
      <html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:white">
        <div style="text-align:center">
          <h2>Sin conexion al servidor</h2>
          <p>No se pudo conectar a <b>${SERVER_URL}</b></p>
          <p style="font-size:13px;color:#94a3b8">Verifica tu internet e intenta de nuevo.</p>
          <button onclick="location.href='${SERVER_URL}'"
            style="margin-top:16px;padding:10px 24px;background:#3b82f6;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px">
            Reintentar
          </button>
        </div>
      </body></html>`)
  })
}

// ─── Genera HTML térmico para una boleta ─────────────────────────────────────
function buildReceiptHtml(order) {
  const regularItems = order.items.filter(i => !i.isBonification)
  const bonifItems = order.items.filter(i => i.isBonification)
  const discountVal = Number(order.discount || 0)
  const subtotal = regularItems.reduce(
    (acc, i) => acc + i.unitPrice * (i.deliveredQuantity ?? i.quantity), 0
  )
  const finalTotal = Math.max(0, subtotal - discountVal)
  const dateToUse = order.deliveredAt ? new Date(order.deliveredAt) : new Date(order.createdAt)
  const dateStr = `${dateToUse.toLocaleDateString()} ${dateToUse.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

  const itemRows = regularItems.map(it => {
    const qty = it.deliveredQuantity ?? it.quantity
    return `<tr>
      <td style="width:50%">${it.product.name}</td>
      <td style="text-align:center;width:12%">x${qty}</td>
      <td style="text-align:right;width:18%">${it.unitPrice.toFixed(2)}</td>
      <td style="text-align:right;width:20%"><b>${(it.unitPrice * qty).toFixed(2)}</b></td>
    </tr>`
  }).join('')

  const bonifSection = bonifItems.length > 0 ? `
    <tr><td colspan="4" style="border-top:1px dashed #000;padding-top:4px;font-weight:900;font-size:11px">BONIFICACIONES (GRATIS):</td></tr>
    ${bonifItems.map(it => `<tr><td colspan="3">[BONIF] ${it.product.name} x${it.quantity}</td><td style="text-align:right">GRATIS</td></tr>`).join('')}
  ` : ''

  const discountSection = discountVal > 0 ? `
    <div style="display:flex;justify-content:space-between"><span>subtotal:</span><span>Bs. ${subtotal.toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between"><span>descuento:</span><span>-Bs. ${discountVal.toFixed(2)}</span></div>
    <hr style="border:none;border-top:1px dashed #000;margin:4px 0">
  ` : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      @page { size: 80mm auto; margin: 2mm 2mm 15mm 2mm; }
      body { font-family: 'Courier New', monospace; font-size: 12px; font-weight: bold;
             width: 100%; color: #000; line-height: 1.35; }
      hr { border: none; border-top: 1px solid #000; margin: 5px 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 1px 0; font-size: 11px; vertical-align: top; }
      th { border-bottom: 1px solid #000; font-size: 11px; }
      .center { text-align: center; }
      .total-row { font-size: 15px; font-weight: 900; }
    </style>
  </head><body>
    <div class="center"><b style="font-size:15px">DISTRIBUIDORA LUNOVA</b></div>
    <div class="center">contacto: 74347987</div>
    <hr>
    <div><b>pedido #${order.id}</b></div>
    <div>vendedor: ${(order.preventista?.name || order.distributor?.name || 'Distribucion').substring(0, 38)}</div>
    <div>fecha: ${dateStr}</div>
    <div>cliente: ${order.client.name}</div>
    ${order.client.phone ? `<div>tel: ${order.client.phone}</div>` : ''}
    ${order.client.address ? `<div>dir: ${order.client.address}</div>` : ''}
    <hr>
    <table>
      <thead><tr>
        <th style="text-align:left">Descripcion</th>
        <th style="text-align:center">CANT</th>
        <th style="text-align:right">P.U</th>
        <th style="text-align:right">TOTAL</th>
      </tr></thead>
      <tbody>${itemRows}${bonifSection}</tbody>
    </table>
    <hr>
    ${discountSection}
    <div class="total-row" style="display:flex;justify-content:space-between">
      <span>TOTAL:</span><span>Bs. ${finalTotal.toFixed(2)}</span>
    </div>
    ${order.notes ? `<hr><div>obs: ${order.notes}</div>` : ''}
    <hr>
    <div class="center">gracias por su compra</div>
  </body></html>`
}

// ─── Imprimir una boleta en ventana oculta (sin diálogo) ─────────────────────
function printOrderSilently(order, deviceName) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false },
    })

    const html = buildReceiptHtml(order)
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    win.webContents.once('did-finish-load', () => {
      const options = {
        silent: true,         // sin diálogo de impresión
        printBackground: true,
        color: false,
      }
      if (deviceName) options.deviceName = deviceName

      win.webContents.print(options, (success, errorType) => {
        win.close()
        resolve({ ok: success, error: success ? null : errorType })
      })
    })
  })
}

// ─── Handler principal de impresión ESC/POS ──────────────────────────────────
ipcMain.handle('print-escpos', async (event, orders) => {
  try {
    // Obtener impresoras disponibles para encontrar la predeterminada
    const printers = await mainWindow.webContents.getPrintersAsync()
    const defaultPrinter = printers.find(p => p.isDefault)
    const deviceName = defaultPrinter?.displayName || defaultPrinter?.name || null

    let failed = 0
    for (const order of orders) {
      const result = await printOrderSilently(order, deviceName)
      if (!result.ok) failed++
      // Pequeña pausa entre boletas para que la impresora procese y corte
      await new Promise(r => setTimeout(r, 800))
    }

    return {
      ok: failed === 0,
      count: orders.length - failed,
      printer: deviceName || 'impresora predeterminada',
      error: failed > 0 ? `${failed} boleta(s) fallaron` : null,
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ─── Listar impresoras disponibles ───────────────────────────────────────────
ipcMain.handle('list-printers', async () => {
  try {
    const printers = await mainWindow.webContents.getPrintersAsync()
    return {
      ok: true,
      devices: printers.map(p => ({ name: p.name, displayName: p.displayName, isDefault: p.isDefault })),
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ─── Ciclo de vida ────────────────────────────────────────────────────────────
app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
