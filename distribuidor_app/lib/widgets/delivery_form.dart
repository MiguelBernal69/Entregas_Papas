import 'package:flutter/material.dart';
import '../models/order.dart';

class DeliveryForm extends StatefulWidget {
  final Order order;
  final Map<int, TextEditingController> controllers;

  const DeliveryForm({super.key, required this.order, required this.controllers});

  @override
  State<DeliveryForm> createState() => _DeliveryFormState();
}

class _DeliveryFormState extends State<DeliveryForm> {
  double _calculatedTotal = 0;

  @override
  void initState() {
    super.initState();
    _calculateTotal();
    // Escuchar cambios en todos los controladores
    for (var c in widget.controllers.values) {
      c.addListener(_calculateTotal);
    }
  }

  void _calculateTotal() {
    double total = 0;
    for (var item in widget.order.items) {
      final text = widget.controllers[item.id]?.text ?? '0';
      final qty = int.tryParse(text) ?? 0;
      total += qty * item.unitPrice;
    }
    setState(() => _calculatedTotal = total);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 20,
        right: 20,
        top: 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
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

            // Título
            Row(
              children: [
                const Icon(Icons.local_shipping, color: Color(0xFF3B82F6)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Entregar a ${widget.order.client.name}',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Ajusta las cantidades si el cliente no acepta todo el pedido',
              style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
            ),
            const Divider(height: 24),

            // Lista de productos con campos editables
            ...widget.order.items.map((item) {
              final controller = widget.controllers[item.id]!;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.productName,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                          Text(
                            'Pedido: ${item.quantity} ${item.productUnit} · Bs. ${item.unitPrice.toStringAsFixed(2)} c/u',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Botón -
                    IconButton(
                      onPressed: () {
                        int val = int.tryParse(controller.text) ?? 0;
                        if (val > 0) {
                          controller.text = (val - 1).toString();
                        }
                      },
                      icon: const Icon(Icons.remove_circle_outline),
                      color: Colors.red.shade400,
                      iconSize: 28,
                    ),
                    // Campo de cantidad
                    SizedBox(
                      width: 50,
                      child: TextField(
                        controller: controller,
                        keyboardType: TextInputType.number,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                        decoration: InputDecoration(
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 4,
                            vertical: 8,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                    ),
                    // Botón +
                    IconButton(
                      onPressed: () {
                        int val = int.tryParse(controller.text) ?? 0;
                        if (val < item.quantity) {
                          controller.text = (val + 1).toString();
                        }
                      },
                      icon: const Icon(Icons.add_circle_outline),
                      color: Colors.green.shade400,
                      iconSize: 28,
                    ),
                  ],
                ),
              );
            }),

            const Divider(height: 16),

            // Total calculado
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Total a cobrar:',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                Text(
                  'Bs. ${_calculatedTotal.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF3B82F6),
                  ),
                ),
              ],
            ),

            // Aviso si es parcial
            if (_calculatedTotal < widget.order.total) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.orange.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning_amber, color: Colors.orange.shade700, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Entrega parcial — Se devolverán productos no aceptados',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.orange.shade800,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 16),

            // Botones
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context, null),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text('Cancelar'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      // Validar cantidades
                      List<Map<String, int>> deliveredItems = [];
                      for (var item in widget.order.items) {
                        final text = widget.controllers[item.id]?.text ?? '0';
                        int qty = int.tryParse(text) ?? 0;
                        if (qty < 0) qty = 0;
                        if (qty > item.quantity) qty = item.quantity;
                        deliveredItems.add({
                          'orderItemId': item.id,
                          'deliveredQuantity': qty,
                        });
                      }
                      Navigator.pop(context, deliveredItems);
                    },
                    icon: const Icon(Icons.check_circle, size: 18),
                    label: const Text(
                      'Confirmar Entrega',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      elevation: 0,
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
