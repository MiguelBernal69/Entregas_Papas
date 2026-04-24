import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/order.dart';
import '../services/order_service.dart';
import '../providers/auth_provider.dart';
import 'map_screen.dart';
import '../widgets/client_details_sheet.dart';
import '../widgets/delivery_form.dart';
import '../config/api.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  List<Order> _pendingOrders = [];
  List<Order> _deliveredOrders = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _loading = true);
    try {
      final now = DateTime.now();
      final today =
          "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";

      // Cargamos ambos tipos de pedidos para hoy
      final results = await Future.wait([
        OrderService.getMyOrders(status: 'asignado'),
        OrderService.getMyOrders(status: 'entregado', date: today),
      ]);

      setState(() {
        _pendingOrders = results[0];
        _deliveredOrders = results[1];
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  /// Muestra el diálogo de entrega con cantidades editables para entrega parcial
  Future<void> _deliver(int orderId) async {
    final order = _pendingOrders.firstWhere((o) => o.id == orderId);

    // Crear controladores para cada item con la cantidad pedida como valor inicial
    final controllers = <int, TextEditingController>{};
    for (var item in order.items) {
      controllers[item.id] = TextEditingController(text: item.quantity.toString());
    }

    final result = await showModalBottomSheet<List<Map<String, int>>?>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => DeliveryForm(order: order, controllers: controllers),
    );

    // Limpiar controladores
    for (var c in controllers.values) {
      c.dispose();
    }

    if (result == null) return;

    // Determinar si es entrega completa o parcial
    bool isPartial = false;
    for (var item in result) {
      final orderItem = order.items.firstWhere((i) => i.id == item['orderItemId']);
      if (item['deliveredQuantity']! < orderItem.quantity) {
        isPartial = true;
        break;
      }
    }

    final ok = await OrderService.deliverOrder(
      orderId,
      deliveredItems: result,
    );

    if (ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(isPartial ? '⚠️ Entrega parcial registrada' : '✅ Pedido entregado'),
          backgroundColor: isPartial ? Colors.orange : Colors.green,
        ),
      );
      _fetchData();
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.read<AuthProvider>().user;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: const Color(0xFFF3F4F6),
        appBar: AppBar(
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Mi Ruta',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
              ),
              Text(
                'Hola, ${user?.name ?? ''}',
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
            ],
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.map_outlined),
              tooltip: 'Ver mapa',
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => MapScreen(orders: _pendingOrders),
                ),
              ).then((_) => _fetchData()), // Refrescar al volver del mapa
            ),
            IconButton(
              icon: const Icon(Icons.logout),
              onPressed: () => context.read<AuthProvider>().logout(),
            ),
          ],
          bottom: const TabBar(
            indicatorColor: Color(0xFF3B82F6),
            labelColor: Color(0xFF3B82F6),
            unselectedLabelColor: Colors.grey,
            tabs: [
              Tab(text: 'Pendientes', icon: Icon(Icons.pending_actions)),
              Tab(text: 'Historial Hoy', icon: Icon(Icons.history)),
            ],
          ),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : TabBarView(
                children: [
                  _OrderList(
                    orders: _pendingOrders,
                    emptyMessage: 'No tienes pedidos pendientes',
                    onRefresh: _fetchData,
                    onDeliver: _deliver,
                  ),
                  _OrderList(
                    orders: _deliveredOrders,
                    emptyMessage: 'Aún no has entregado pedidos hoy',
                    onRefresh: _fetchData,
                    isHistory: true,
                  ),
                ],
              ),
      ),
    );
  }
}

// Formulario removido a widgets/delivery_form.dart

// ─── Lista de pedidos (reutilizable) ───────────────────────

class _OrderList extends StatelessWidget {
  final List<Order> orders;
  final String emptyMessage;
  final RefreshCallback onRefresh;
  final Function(int)? onDeliver;
  final bool isHistory;

  const _OrderList({
    required this.orders,
    required this.emptyMessage,
    required this.onRefresh,
    this.onDeliver,
    this.isHistory = false,
  });

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(isHistory ? '🕒' : '📦', style: const TextStyle(fontSize: 48)),
            const SizedBox(height: 12),
            Text(emptyMessage, style: const TextStyle(color: Colors.grey)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: orders.length,
        itemBuilder: (context, index) {
          final order = orders[index];
          return _OrderCard(
            order: order,
            onDeliver: onDeliver != null ? () => onDeliver!(order.id) : null,
            isHistory: isHistory,
            onUpdate: onRefresh,
          );
        },
      ),
    );
  }
}

// ─── Card de cada pedido ───────────────────────────────────

class _OrderCard extends StatelessWidget {
  final Order order;
  final VoidCallback? onDeliver;
  final bool isHistory;
  final VoidCallback? onUpdate;

  const _OrderCard({
    required this.order,
    this.onDeliver,
    this.isHistory = false,
    this.onUpdate,
  });

  @override
  Widget build(BuildContext context) {
    final bool isPartial = order.isPartial;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: _getStatusColor(isHistory, isPartial).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _getStatusLabel(isHistory, isPartial, order.id),
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                      color: _getStatusColor(isHistory, isPartial),
                    ),
                  ),
                ),
                const Spacer(),
                const Icon(Icons.location_on, size: 14, color: Colors.grey),
                const SizedBox(width: 2),
                Flexible(
                  child: Text(
                    order.client.address,
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Cliente
            Row(
              children: [
                if (order.client.photoUrl != null &&
                    order.client.photoUrl!.isNotEmpty)
                  ClipOval(
                    child: Image.network(
                      Api.getImageUrl(order.client.photoUrl!),
                      height: 36,
                      width: 36,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => const Icon(
                        Icons.store,
                        size: 18,
                        color: Colors.blueGrey,
                      ),
                    ),
                  )
                else
                  const Icon(Icons.store, size: 18, color: Colors.blueGrey),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        order.client.name,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      Text(
                        order.client.ownerName,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.account_circle, color: Colors.blue),
                  onPressed: () {
                    ClientDetailsSheet.show(
                      context,
                      id: order.client.id,
                      name: order.client.name,
                      ownerName: order.client.ownerName,
                      phone: order.client.phone,
                      address: order.client.address,
                      latitude: order.client.latitude,
                      longitude: order.client.longitude,
                      photoUrl: order.client.photoUrl,
                      onUpdate: onUpdate,
                    );
                  },
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Teléfono
            Row(
              children: [
                const Icon(Icons.phone, size: 16, color: Colors.grey),
                const SizedBox(width: 8),
                Text(order.client.phone, style: const TextStyle(fontSize: 13)),
              ],
            ),

            if (order.notes != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.note, size: 16, color: Colors.orange),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      order.notes!,
                      style: const TextStyle(fontSize: 13),
                    ),
                  ),
                ],
              ),
            ],

            const Divider(height: 20),

            // Productos
            ...order.items.map(
              (item) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          Text(
                            '${item.productName} x${item.quantity}',
                            style: const TextStyle(
                              fontSize: 13,
                              color: Colors.black87,
                            ),
                          ),
                          // Mostrar cantidad entregada si es parcial
                          if (isHistory && item.deliveredQuantity != null && item.deliveredQuantity! < item.quantity) ...[
                            const SizedBox(width: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                              decoration: BoxDecoration(
                                color: Colors.orange.shade50,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                '→ ${item.deliveredQuantity}',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.orange.shade800,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    Text(
                      'Bs. ${(item.unitPrice * item.actualDelivered).toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const Divider(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  isHistory && order.isPartial ? 'Total cobrado' : 'Total',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                Text(
                  'Bs. ${order.totalEntregado.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF3B82F6),
                  ),
                ),
              ],
            ),

            if (!isHistory) ...[
              const SizedBox(height: 12),
              // Botones
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) =>
                              MapScreen(orders: [order], focusOrder: order),
                        ),
                      ),
                      icon: const Icon(Icons.map_outlined, size: 16),
                      label: const Text('Ver en mapa'),
                      style: OutlinedButton.styleFrom(
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                  if (onDeliver != null) ...[
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: onDeliver,
                        icon: const Icon(Icons.check_circle_outline, size: 16),
                        label: const Text('Entregar'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.green,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Color _getStatusColor(bool history, bool partial) {
    if (!history) return const Color(0xFF8B5CF6);
    if (partial) return Colors.orange;
    return Colors.green;
  }

  String _getStatusLabel(bool history, bool partial, int orderId) {
    if (!history) return 'Pedido #$orderId';
    if (partial) return 'PARCIAL';
    return 'ENTREGADO';
  }
}
