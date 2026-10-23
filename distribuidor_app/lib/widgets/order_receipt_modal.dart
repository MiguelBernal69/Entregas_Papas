import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../models/order.dart';

class OrderReceiptModal extends StatefulWidget {
  final Order order;
  final String? distributorName;
  final Map<int, int>? customDeliveredQuantities;

  const OrderReceiptModal({
    super.key,
    required this.order,
    this.distributorName,
    this.customDeliveredQuantities,
  });

  /// Método estático para abrir el modal desde cualquier pantalla
  static void show(
    BuildContext context, {
    required Order order,
    String? distributorName,
    Map<int, int>? customDeliveredQuantities,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => OrderReceiptModal(
        order: order,
        distributorName: distributorName,
        customDeliveredQuantities: customDeliveredQuantities,
      ),
    );
  }

  /// Genera el texto monoespaciado optimizado para impresoras térmicas
  /// [is80mm] = true para Epson TM-T20III / 80mm (44 columnas)
  /// [is80mm] = false para Impresoras Bluetooth portátiles / 58mm (32 columnas)
  static String buildReceiptText({
    required Order order,
    String? distributorName,
    Map<int, int>? customDeliveredQuantities,
    bool is80mm = true,
  }) {
    final buffer = StringBuffer();
    final lineWidth = is80mm ? 44 : 32;

    String padRight(String text, int width) =>
        text.length >= width ? text.substring(0, width) : text.padRight(width);
    String padLeft(String text, int width) =>
        text.length >= width ? text.substring(0, width) : text.padLeft(width);
    String center(String text) {
      if (text.length >= lineWidth) return text;
      final leftPadding = (lineWidth - text.length) ~/ 2;
      return ' ' * leftPadding + text;
    }

    final sepDouble = '=' * lineWidth;
    final sepSingle = '-' * lineWidth;

    // Cantidades reales o entregadas
    int getDeliveredQty(OrderItem item) {
      if (customDeliveredQuantities != null &&
          customDeliveredQuantities.containsKey(item.id)) {
        return customDeliveredQuantities[item.id]!;
      }
      return item.actualDelivered;
    }

    final isHistory = order.status == 'entregado' || order.status == 'entrega_parcial';
    final regularItems = order.items.where((i) => !i.isBonification).toList();
    final boniItems = order.items.where((i) => i.isBonification).toList();

    // Cálculos de totales
    double subtotal = 0.0;
    int totalRegularQty = 0;
    int totalBoniQty = 0;

    for (final item in regularItems) {
      final qty = isHistory || customDeliveredQuantities != null
          ? getDeliveredQty(item)
          : item.quantity;
      subtotal += qty * item.unitPrice;
      totalRegularQty += qty;
    }

    for (final item in boniItems) {
      final qty = isHistory || customDeliveredQuantities != null
          ? getDeliveredQty(item)
          : item.quantity;
      totalBoniQty += qty;
    }

    final discount = order.discount;
    final totalNeto = (subtotal - discount) > 0 ? (subtotal - discount) : 0.0;
    final totalFisico = totalRegularQty + totalBoniQty;

    // Formateo de fecha
    String dateStr;
    try {
      final dt = DateTime.parse(order.createdAt).toLocal();
      String p(int n) => n.toString().padLeft(2, '0');
      dateStr = "${p(dt.day)}/${p(dt.month)}/${dt.year} ${p(dt.hour)}:${p(dt.minute)}";
    } catch (_) {
      dateStr = order.createdAt;
    }

    buffer.writeln(sepDouble);
    buffer.writeln(center("DISTRIBUIDORA PAPAS"));
    buffer.writeln(center("BOLETA DE ENTREGA Y VENTA"));
    buffer.writeln(sepDouble);
    buffer.writeln("Pedido:      #${order.id}");
    buffer.writeln("Fecha:       $dateStr");
    buffer.writeln("Estado:      ${order.status.toUpperCase()}");
    if (order.preventistaName != null && order.preventistaName!.trim().isNotEmpty) {
      buffer.writeln("Preventista: ${order.preventistaName}");
    }
    if (distributorName != null && distributorName.trim().isNotEmpty) {
      buffer.writeln("Repartidor:  $distributorName");
    }
    buffer.writeln(sepSingle);
    buffer.writeln("DATOS DEL CLIENTE:");
    buffer.writeln("Cliente:   ${order.client.name}");
    if (order.client.ownerName.trim().isNotEmpty) {
      buffer.writeln("Titular:   ${order.client.ownerName}");
    }
    if (order.client.phone.trim().isNotEmpty) {
      buffer.writeln("Teléfono:  ${order.client.phone}");
    }
    if (order.client.address.trim().isNotEmpty) {
      buffer.writeln("Dirección: ${order.client.address}");
    }
    buffer.writeln(sepSingle);

    if (is80mm) {
      // Formato para 80mm Epson TM-T20III (44 columnas)
      buffer.writeln("Cant  Producto                 P.U.    Total");
      buffer.writeln(sepSingle);

      for (final item in regularItems) {
        final qty = isHistory || customDeliveredQuantities != null
            ? getDeliveredQty(item)
            : item.quantity;
        final itemTotal = qty * item.unitPrice;
        final qtyStr = padRight("$qty${item.productUnit}", 5);
        final puStr = padLeft(item.unitPrice.toStringAsFixed(2), 7);
        final totStr = padLeft(itemTotal.toStringAsFixed(2), 9);
        const maxLen = 21;

        if (item.productName.length <= maxLen) {
          final nameStr = padRight(item.productName, maxLen);
          buffer.writeln("$qtyStr $nameStr $puStr $totStr");
        } else {
          final first = item.productName.substring(0, maxLen);
          buffer.writeln("$qtyStr $first $puStr $totStr");
          var rem = item.productName.substring(maxLen).trim();
          while (rem.isNotEmpty) {
            final take = rem.length > maxLen ? maxLen : rem.length;
            final chunk = rem.substring(0, take);
            buffer.writeln("      $chunk");
            rem = rem.substring(take).trim();
          }
        }

        if (item.deliveredQuantity != null && item.deliveredQuantity! < item.quantity) {
          buffer.writeln("   (Pedido: ${item.quantity} -> Devuelto: ${item.quantity - qty})");
        }
      }

      if (boniItems.isNotEmpty) {
        buffer.writeln(sepSingle);
        buffer.writeln("*** BONIFICACIONES (100% GRATIS) ***");
        for (final item in boniItems) {
          final qty = isHistory || customDeliveredQuantities != null
              ? getDeliveredQty(item)
              : item.quantity;
          final qtyStr = padRight("$qty${item.productUnit}", 5);
          final fullName = "[BONIF] ${item.productName}";
          const maxLen = 28;

          if (fullName.length <= maxLen) {
            final nameStr = padRight(fullName, maxLen);
            buffer.writeln("$qtyStr $nameStr  GRATIS");
          } else {
            final first = fullName.substring(0, maxLen);
            buffer.writeln("$qtyStr $first  GRATIS");
            var rem = fullName.substring(maxLen).trim();
            while (rem.isNotEmpty) {
              final take = rem.length > maxLen ? maxLen : rem.length;
              final chunk = rem.substring(0, take);
              buffer.writeln("      $chunk");
              rem = rem.substring(take).trim();
            }
          }
        }
      }

      buffer.writeln(sepSingle);
      buffer.writeln("Subtotal venta:           ${padLeft('Bs. ${subtotal.toStringAsFixed(2)}', 16)}");
      if (discount > 0) {
        buffer.writeln("Descuento preventa:       ${padLeft('-Bs. ${discount.toStringAsFixed(2)}', 16)}");
        buffer.writeln(sepSingle);
      }
      buffer.writeln("TOTAL A COBRAR:           ${padLeft('Bs. ${totalNeto.toStringAsFixed(2)}', 16)}");
    } else {
      // Formato para 58mm Bluetooth Portátil (32 columnas)
      buffer.writeln("Cant  Producto            P.U.  Total");
      buffer.writeln(sepSingle);

      for (final item in regularItems) {
        final qty = isHistory || customDeliveredQuantities != null
            ? getDeliveredQty(item)
            : item.quantity;
        final itemTotal = qty * item.unitPrice;
        final qtyStr = padRight("$qty${item.productUnit}", 5);
        final puStr = padLeft(item.unitPrice.toStringAsFixed(1), 5);
        final totStr = padLeft(itemTotal.toStringAsFixed(2), 7);
        const maxLen = 17;

        if (item.productName.length <= maxLen) {
          final nameStr = padRight(item.productName, maxLen);
          buffer.writeln("$qtyStr $nameStr $puStr $totStr");
        } else {
          final first = item.productName.substring(0, maxLen);
          buffer.writeln("$qtyStr $first $puStr $totStr");
          var rem = item.productName.substring(maxLen).trim();
          while (rem.isNotEmpty) {
            final take = rem.length > maxLen ? maxLen : rem.length;
            final chunk = rem.substring(0, take);
            buffer.writeln("     $chunk");
            rem = rem.substring(take).trim();
          }
        }

        if (item.deliveredQuantity != null && item.deliveredQuantity! < item.quantity) {
          buffer.writeln("   (Pedido: ${item.quantity} -> Dev: ${item.quantity - qty})");
        }
      }

      if (boniItems.isNotEmpty) {
        buffer.writeln(sepSingle);
        buffer.writeln("** BONIFICACIONES (GRATIS) **");
        for (final item in boniItems) {
          final qty = isHistory || customDeliveredQuantities != null
              ? getDeliveredQty(item)
              : item.quantity;
          final qtyStr = padRight("$qty${item.productUnit}", 5);
          final fullName = "[BON] ${item.productName}";
          const maxLen = 20;

          if (fullName.length <= maxLen) {
            final nameStr = padRight(fullName, maxLen);
            buffer.writeln("$qtyStr $nameStr GRATIS");
          } else {
            final first = fullName.substring(0, maxLen);
            buffer.writeln("$qtyStr $first GRATIS");
            var rem = fullName.substring(maxLen).trim();
            while (rem.isNotEmpty) {
              final take = rem.length > maxLen ? maxLen : rem.length;
              final chunk = rem.substring(0, take);
              buffer.writeln("     $chunk");
              rem = rem.substring(take).trim();
            }
          }
        }
      }

      buffer.writeln(sepSingle);
      buffer.writeln("Subtotal venta:     ${padLeft('Bs. ${subtotal.toStringAsFixed(2)}', 12)}");
      if (discount > 0) {
        buffer.writeln("Descuento prevent.: ${padLeft('-Bs. ${discount.toStringAsFixed(2)}', 12)}");
        buffer.writeln(sepSingle);
      }
      buffer.writeln("TOTAL A COBRAR:     ${padLeft('Bs. ${totalNeto.toStringAsFixed(2)}', 12)}");
    }

    buffer.writeln(sepDouble);
    buffer.writeln("RESUMEN DE BULTOS / CARGA:");
    buffer.writeln("  • Venta regular:   $totalRegularQty unidades");
    if (totalBoniQty > 0) {
      buffer.writeln("  • Bonificaciones:  $totalBoniQty unidades [GRATIS 🎁]");
    }
    buffer.writeln("  • TOTAL ENTREGADO: $totalFisico unidades");

    if (order.notes != null && order.notes!.trim().isNotEmpty) {
      buffer.writeln(sepSingle);
      buffer.writeln("OBSERVACIONES:");
      buffer.writeln(order.notes!.trim());
    }

    buffer.writeln(sepSingle);
    buffer.writeln(center("¡Muchas gracias por su compra!"));
    buffer.writeln(center("*** COMPROBANTE OFICIAL ***"));
    buffer.writeln("$sepDouble\n");

    return buffer.toString();
  }

  @override
  State<OrderReceiptModal> createState() => _OrderReceiptModalState();
}

class _OrderReceiptModalState extends State<OrderReceiptModal> {
  bool _is80mm = true; // Por defecto Epson TM-T20III (80mm)

  /// Genera un documento PDF nítido y de alto contraste listo para impresión directa
  Future<Uint8List> _generateThermalPdf(PdfPageFormat format) async {
    final doc = pw.Document();

    final isHistory = widget.order.status == 'entregado' || widget.order.status == 'entrega_parcial';
    final regularItems = widget.order.items.where((i) => !i.isBonification).toList();
    final boniItems = widget.order.items.where((i) => i.isBonification).toList();

    int getDeliveredQty(OrderItem item) {
      if (widget.customDeliveredQuantities != null &&
          widget.customDeliveredQuantities!.containsKey(item.id)) {
        return widget.customDeliveredQuantities![item.id]!;
      }
      return item.actualDelivered;
    }

    double subtotal = 0.0;
    int totalRegularQty = 0;
    int totalBoniQty = 0;

    for (final item in regularItems) {
      final qty = isHistory || widget.customDeliveredQuantities != null
          ? getDeliveredQty(item)
          : item.quantity;
      subtotal += qty * item.unitPrice;
      totalRegularQty += qty;
    }

    for (final item in boniItems) {
      final qty = isHistory || widget.customDeliveredQuantities != null
          ? getDeliveredQty(item)
          : item.quantity;
      totalBoniQty += qty;
    }

    final discount = widget.order.discount;
    final totalNeto = (subtotal - discount) > 0 ? (subtotal - discount) : 0.0;
    final totalFisico = totalRegularQty + totalBoniQty;

    String dateStr;
    try {
      final dt = DateTime.parse(widget.order.createdAt).toLocal();
      String p(int n) => n.toString().padLeft(2, '0');
      dateStr = "${p(dt.day)}/${p(dt.month)}/${dt.year} ${p(dt.hour)}:${p(dt.minute)}";
    } catch (_) {
      dateStr = widget.order.createdAt;
    }

    final regularFont = await PdfGoogleFonts.robotoRegular();
    final boldFont = await PdfGoogleFonts.robotoBold();

    doc.addPage(
      pw.Page(
        pageFormat: format,
        theme: pw.ThemeData.withFont(base: regularFont, bold: boldFont),
        build: (pw.Context context) {
          return pw.Container(
            padding: const pw.EdgeInsets.all(6),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                // Cabecera
                pw.Center(
                  child: pw.Text(
                    'DISTRIBUIDORA DE PAPAS',
                    style: pw.TextStyle(
                      font: boldFont,
                      fontSize: _is80mm ? 14 : 12,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                ),
                pw.Center(
                  child: pw.Text(
                    'COMPROBANTE DE ENTREGA Y VENTA',
                    style: pw.TextStyle(
                      font: boldFont,
                      fontSize: _is80mm ? 9 : 8,
                    ),
                  ),
                ),
                pw.SizedBox(height: 2),
                pw.Center(
                  child: pw.Text(
                    _is80mm ? 'EPSON TM-T20III (80mm)' : 'BLUETOOTH TERMICA (58mm)',
                    style: const pw.TextStyle(fontSize: 7),
                  ),
                ),
                pw.Divider(thickness: 1.5),

                // Datos de orden
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text(
                      'PEDIDO: #${widget.order.id}',
                      style: pw.TextStyle(font: boldFont, fontSize: 10),
                    ),
                    pw.Text(
                      widget.order.status.toUpperCase(),
                      style: pw.TextStyle(font: boldFont, fontSize: 8),
                    ),
                  ],
                ),
                pw.Text('FECHA: $dateStr', style: const pw.TextStyle(fontSize: 8)),
                if (widget.order.preventistaName != null && widget.order.preventistaName!.isNotEmpty)
                  pw.Text('PREVENTISTA: ${widget.order.preventistaName}', style: const pw.TextStyle(fontSize: 8)),
                if (widget.distributorName != null && widget.distributorName!.isNotEmpty)
                  pw.Text('REPARTIDOR: ${widget.distributorName}', style: const pw.TextStyle(fontSize: 8)),
                pw.Divider(thickness: 0.8),

                pw.Text('CLIENTE: ${widget.order.client.name}', style: pw.TextStyle(font: boldFont, fontSize: 9)),
                if (widget.order.client.ownerName.isNotEmpty)
                  pw.Text('TITULAR: ${widget.order.client.ownerName}', style: const pw.TextStyle(fontSize: 8)),
                if (widget.order.client.phone.isNotEmpty)
                  pw.Text('TEL: ${widget.order.client.phone}', style: const pw.TextStyle(fontSize: 8)),
                if (widget.order.client.address.isNotEmpty)
                  pw.Text('DIR: ${widget.order.client.address}', style: const pw.TextStyle(fontSize: 8)),
                pw.Divider(thickness: 1),

                // Tabla de Productos Venta
                pw.Row(
                  children: [
                    pw.SizedBox(width: 25, child: pw.Text('CANT', style: pw.TextStyle(font: boldFont, fontSize: 8))),
                    pw.Expanded(child: pw.Text('PRODUCTO', style: pw.TextStyle(font: boldFont, fontSize: 8))),
                    pw.SizedBox(width: 35, child: pw.Text('P.U.', textAlign: pw.TextAlign.right, style: pw.TextStyle(font: boldFont, fontSize: 8))),
                    pw.SizedBox(width: 45, child: pw.Text('TOTAL', textAlign: pw.TextAlign.right, style: pw.TextStyle(font: boldFont, fontSize: 8))),
                  ],
                ),
                pw.Divider(thickness: 0.5),

                ...regularItems.map((item) {
                  final qty = isHistory || widget.customDeliveredQuantities != null
                      ? getDeliveredQty(item)
                      : item.quantity;
                  final itemTotal = qty * item.unitPrice;
                  return pw.Padding(
                    padding: const pw.EdgeInsets.symmetric(vertical: 1.5),
                    child: pw.Row(
                      children: [
                        pw.SizedBox(width: 25, child: pw.Text('${qty}x', style: pw.TextStyle(font: boldFont, fontSize: 8))),
                        pw.Expanded(child: pw.Text(item.productName, style: const pw.TextStyle(fontSize: 8))),
                        pw.SizedBox(width: 35, child: pw.Text(item.unitPrice.toStringAsFixed(2), textAlign: pw.TextAlign.right, style: const pw.TextStyle(fontSize: 8))),
                        pw.SizedBox(width: 45, child: pw.Text(itemTotal.toStringAsFixed(2), textAlign: pw.TextAlign.right, style: pw.TextStyle(font: boldFont, fontSize: 8))),
                      ],
                    ),
                  );
                }),

                // Sección de Bonificaciones
                if (boniItems.isNotEmpty) ...[
                  pw.Divider(thickness: 1),
                  pw.Container(
                    width: double.infinity,
                    color: PdfColors.black,
                    padding: const pw.EdgeInsets.symmetric(vertical: 2),
                    child: pw.Center(
                      child: pw.Text(
                        'BONIFICACIONES (100% GRATIS)',
                        style: pw.TextStyle(
                          font: boldFont,
                          color: PdfColors.white,
                          fontSize: 8,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  pw.SizedBox(height: 2),
                  ...boniItems.map((item) {
                    final qty = isHistory || widget.customDeliveredQuantities != null
                        ? getDeliveredQty(item)
                        : item.quantity;
                    return pw.Padding(
                      padding: const pw.EdgeInsets.symmetric(vertical: 1.5),
                      child: pw.Row(
                        children: [
                          pw.SizedBox(width: 25, child: pw.Text('${qty}x', style: pw.TextStyle(font: boldFont, fontSize: 8))),
                          pw.Expanded(child: pw.Text('[BONIF] ${item.productName}', style: pw.TextStyle(font: boldFont, fontSize: 8))),
                          pw.SizedBox(width: 45, child: pw.Text('GRATIS', textAlign: pw.TextAlign.right, style: pw.TextStyle(font: boldFont, fontSize: 8))),
                        ],
                      ),
                    );
                  }),
                ],

                pw.Divider(thickness: 1),

                // Totales
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text('Subtotal Venta:', style: const pw.TextStyle(fontSize: 8)),
                    pw.Text('Bs. ${subtotal.toStringAsFixed(2)}', style: const pw.TextStyle(fontSize: 8)),
                  ],
                ),
                if (discount > 0)
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text('Descuento Preventa:', style: pw.TextStyle(font: boldFont, fontSize: 8)),
                      pw.Text('-Bs. ${discount.toStringAsFixed(2)}', style: pw.TextStyle(font: boldFont, fontSize: 8)),
                    ],
                  ),
                pw.Divider(thickness: 1.5),
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text('TOTAL A COBRAR:', style: pw.TextStyle(font: boldFont, fontSize: _is80mm ? 12 : 10)),
                    pw.Text('Bs. ${totalNeto.toStringAsFixed(2)}', style: pw.TextStyle(font: boldFont, fontSize: _is80mm ? 12 : 10)),
                  ],
                ),
                pw.Divider(thickness: 1),

                // Resumen físico
                pw.Text('• Venta regular: $totalRegularQty unidades', style: const pw.TextStyle(fontSize: 7.5)),
                if (totalBoniQty > 0)
                  pw.Text('• Bonificaciones: $totalBoniQty unidades (GRATIS)', style: pw.TextStyle(font: boldFont, fontSize: 7.5)),
                pw.Text('• TOTAL BULTOS ENTREGADOS: $totalFisico unidades', style: pw.TextStyle(font: boldFont, fontSize: 8)),

                if (widget.order.notes != null && widget.order.notes!.trim().isNotEmpty) ...[
                  pw.SizedBox(height: 3),
                  pw.Text('OBS: ${widget.order.notes!.trim()}', style: const pw.TextStyle(fontSize: 7.5)),
                ],

                pw.SizedBox(height: 6),
                pw.Center(
                  child: pw.Text(
                    '¡GRACIAS POR SU COMPRA!',
                    style: pw.TextStyle(font: boldFont, fontSize: 8),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );

    return doc.save();
  }

  /// Ejecuta la impresión directa nativa en el dispositivo
  Future<void> _directPrint() async {
    final format = _is80mm
        ? const PdfPageFormat(80 * PdfPageFormat.mm, double.infinity, marginAll: 2 * PdfPageFormat.mm)
        : const PdfPageFormat(58 * PdfPageFormat.mm, double.infinity, marginAll: 1 * PdfPageFormat.mm);

    try {
      await Printing.layoutPdf(
        name: 'Boleta_Pedido_${widget.order.id}',
        format: format,
        onLayout: (PdfPageFormat f) => _generateThermalPdf(format),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error al enviar a impresora: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final receiptText = OrderReceiptModal.buildReceiptText(
      order: widget.order,
      distributorName: widget.distributorName,
      customDeliveredQuantities: widget.customDeliveredQuantities,
      is80mm: _is80mm,
    );

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Barra de arrastre
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Encabezado
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.receipt_long,
                    color: Color(0xFF2563EB),
                    size: 24,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Boleta de Pedido #${widget.order.id}',
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                      ),
                      Text(
                        '${widget.order.client.name} • ${_is80mm ? "Epson (80mm)" : "Bluetooth (58mm)"}',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, color: Colors.grey),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Selector de Ancho: Epson 80mm vs Bluetooth 58mm
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(10),
                      onTap: () => setState(() => _is80mm = true),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          color: _is80mm ? Colors.white : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: _is80mm
                              ? [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.05),
                                    blurRadius: 4,
                                  ),
                                ]
                              : null,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.print,
                              size: 16,
                              color: _is80mm ? const Color(0xFF2563EB) : Colors.grey,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Epson (80mm)',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: _is80mm ? const Color(0xFF2563EB) : Colors.grey.shade700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(10),
                      onTap: () => setState(() => _is80mm = false),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          color: !_is80mm ? Colors.white : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: !_is80mm
                              ? [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.05),
                                    blurRadius: 4,
                                  ),
                                ]
                              : null,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.bluetooth,
                              size: 16,
                              color: !_is80mm ? const Color(0xFF2563EB) : Colors.grey,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Bluetooth (58mm)',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: !_is80mm ? const Color(0xFF2563EB) : Colors.grey.shade700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Vista del ticket térmico (Como antes, en negrita y tamaño de fuente más grande)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF9FAFB),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: SelectableText(
                receiptText,
                style: const TextStyle(
                  fontFamily: 'Courier',
                  fontSize: 12.5,
                  fontWeight: FontWeight.bold,
                  color: Colors.black,
                  height: 1.25,
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Botones de Acción
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: receiptText));
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Row(
                            children: [
                              const Icon(Icons.check_circle, color: Colors.white),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  '📋 Boleta (${_is80mm ? "80mm Epson" : "58mm Bluetooth"}) copiada para RawBT.',
                                ),
                              ),
                            ],
                          ),
                          backgroundColor: const Color(0xFF10B981),
                          duration: const Duration(seconds: 3),
                        ),
                      );
                    },
                    icon: const Icon(Icons.copy, size: 18),
                    label: const Text('Copiar RawBT'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF2563EB),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _directPrint,
                    icon: const Icon(Icons.print, size: 18),
                    label: Text(_is80mm ? 'Imprimir 80mm' : 'Imprimir 58mm'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      elevation: 2,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
