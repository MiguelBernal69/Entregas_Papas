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
  const dateFormatted = `${dateToUse.toLocaleDateString()} ${dateToUse.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

  const itemRows = regularItems.map(it => {
    const qty = it.deliveredQuantity ?? it.quantity
    return `<tr>
      <td style="word-break: break-word;">${it.product.name}</td>
      <td align="center" style="font-weight:900;width:32px">x${qty}</td>
      <td align="right" style="width:44px">${it.unitPrice.toFixed(2)}</td>
      <td align="right" style="font-weight:900;width:48px;padding-right:2px">${(it.unitPrice * qty).toFixed(2)}</td>
    </tr>`
  }).join('')

  const bonifSection = bonifItems.length > 0 ? `
    <div style="border-bottom:1px dashed #000;margin:6px 0"></div>
    <div style="font-size:11px;font-weight:900">🎁 BONIFICACIONES (GRATIS)</div>
    ${bonifItems.map(it => `
      <div style="display:flex;justify-content:space-between;font-size:12px;padding-right:2px">
        <span>[BONIF] ${it.product.name}</span>
        <span style="font-weight:900">x${it.quantity} GRATIS</span>
      </div>
    `).join('')}
  ` : ''

  const discountSection = discountVal > 0 ? `
    <div style="display:flex;justify-content:space-between;font-size:12px;padding-right:2px">
      <span>subtotal:</span>
      <span>Bs. ${subtotal.toFixed(2)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-weight:900;font-size:12px;padding-right:2px">
      <span>descuento:</span>
      <span>-Bs. ${discountVal.toFixed(2)}</span>
    </div>
    <div style="border-bottom:1px dashed #000;margin:6px 0"></div>
  ` : ''

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Boleta Pedido #${order.id}</title>
    <style>
      @page {
        size: 80mm auto;
        margin: 0;
      }
      * { box-sizing: border-box; }
      body {
        font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.25;
        margin: 0;
        padding: 2mm 5mm 10mm 2mm;
        color: #000;
        width: 272px;
        max-width: 272px;
        box-sizing: border-box;
      }
      .text-center { text-align: center; }
      .border-b { border-bottom: 1px solid #000; margin: 5px 0; }
      .border-b-dashed { border-bottom: 1px dashed #000; margin: 5px 0; }
      .flex { display: flex; justify-content: space-between; align-items: baseline; }
      .bold { font-weight: 900; }
      .items-table { width: 100%; border-collapse: collapse; margin: 4px 0; table-layout: fixed; }
      .items-table th, .items-table td { padding: 1.5px 0; vertical-align: top; font-size: 12px; }
      .items-table th { border-bottom: 1px solid #000; }
      .feed-space { height: 40mm; }
    </style>
  </head>
  <body>
    <div class="text-center">
      <div style="font-size: 16px; font-weight: 900;">DISTRIBUIDORA LUNOVA</div>
      <div style="font-size: 12px;">contacto: 74347987</div>
      <div class="border-b"></div>
    </div>
    <div style="font-size: 12px;">
      <div class="bold">pedido #${order.id}</div>
      <div><span class="bold">vendedor:</span> ${order.preventista?.name || order.distributor?.name || 'Distribución'}</div>
      <div><span class="bold">fecha entrega:</span> ${dateFormatted}</div>
      <div><span class="bold">cliente:</span> ${order.client.name}</div>
      ${order.client.phone ? `<div><span class="bold">contacto:</span> ${order.client.phone}</div>` : ''}
      ${order.client.address ? `<div><span class="bold">direccion:</span> ${order.client.address}</div>` : ''}
    </div>
    <div class="border-b"></div>
    <table class="items-table">
      <thead>
        <tr>
          <th align="left" style="width: auto;">Descripcion</th>
          <th align="center" style="width: 32px;">CANT</th>
          <th align="right" style="width: 44px;">P.U</th>
          <th align="right" style="width: 48px; padding-right: 2px;">total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
    ${bonifSection}
    <div class="border-b"></div>
    ${discountSection}
    <div class="flex bold" style="font-size: 15px; margin-top: 3px; padding-right: 2px;">
      <span>total:</span>
      <span>Bs. ${finalTotal.toFixed(2)}</span>
    </div>
    ${order.notes ? `
      <div class="border-b-dashed"></div>
      <div style="font-size: 11px;"><span class="bold">obs:</span> ${order.notes}</div>
    ` : ''}
    <div class="border-b"></div>
    <div class="text-center" style="font-size: 12px; margin-top: 6px;">gracias por su compra</div>
    <div class="feed-space"></div>
  </body>
</html>`
}

// ─── Imprimir una boleta en ventana oculta (sin diálogo) ─────────────────────
function printOrderSilently(order, deviceName) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    const html = buildReceiptHtml(order)
    // Usamos base64 para evitar problemas de CSP con encodeURIComponent en Electron moderno
    const base64Html = Buffer.from(html, 'utf-8').toString('base64')
    win.loadURL(`data:text/html;base64,${base64Html}`)

    win.webContents.once('did-finish-load', () => {
      const options = {
        silent: true,         // sin diálogo de impresión
        printBackground: true,
        color: false,
      }
      if (deviceName) options.deviceName = deviceName

      win.webContents.print(options, (success, errorType) => {
        console.log(`[print] pedido #${order.id} → ok=${success} error=${errorType}`)
        win.close()
        resolve({ ok: success, error: success ? null : errorType })
      })
    })

    win.webContents.once('did-fail-load', (event, code, desc) => {
      console.error(`[print] did-fail-load pedido #${order.id}: ${code} ${desc}`)
      win.close()
      resolve({ ok: false, error: `did-fail-load: ${desc}` })
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
