import 'package:flutter/material.dart';
import '../../models/order.dart';
import '../../models/client.dart';
import '../../models/product.dart';
import '../../services/preventista_order_service.dart';
import '../../services/client_service.dart';

const _statusColor = {
  'pendiente': Color(0xFFFEF9C3),
  'aceptado': Color(0xFFDBEAFE),
  'asignado': Color(0xFFEDE9FE),
  'entregado': Color(0xFFDCFCE7),
};

const _statusText = {
  'pendiente': Color(0xFFCA8A04),
  'aceptado': Color(0xFF2563EB),
  'asignado': Color(0xFF7C3AED),
  'entregado': Color(0xFF16A34A),
};

class PreventistaOrdersScreen extends StatefulWidget {
  const PreventistaOrdersScreen({super.key});

  @override
  State<PreventistaOrdersScreen> createState() =>
      _PreventistaOrdersScreenState();
}

class _PreventistaOrdersScreenState extends State<PreventistaOrdersScreen> {
  final List<Order> _orders = [];
  bool _loading = true;
  bool _loadingMore = false;
  int _page = 1;
  bool _hasMore = true;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _fetchOrders();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
            _scrollController.position.maxScrollExtent - 200 &&
        !_loadingMore &&
        _hasMore) {
      _fetchMoreOrders();
    }
  }

  Future<void> _fetchOrders() async {
    setState(() {
      _loading = true;
      _page = 1;
      _hasMore = true;
      _orders.clear();
    });
    try {
      final data = await PreventistaOrderService.getMyOrders(page: 1);
      setState(() {
        _orders.addAll(data);
        _loading = false;
        if (data.length < 30) _hasMore = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _fetchMoreOrders() async {
    setState(() => _loadingMore = true);
    try {
      final nextPage = _page + 1;
      final data = await PreventistaOrderService.getMyOrders(page: nextPage);
      setState(() {
        _orders.addAll(data);
        _page = nextPage;
        _loadingMore = false;
        if (data.length < 30) _hasMore = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _loadingMore = false);
      }
    }
  }

  void _openCreateOrder() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CreateOrderSheet(
        onSaved: () {
          Navigator.pop(context);
          _fetchOrders();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: const Text('Mis Pedidos'),
        elevation: 0,
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _openCreateOrder,
        backgroundColor: const Color(0xFF3B82F6),
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _orders.isEmpty
              ? const Center(
                  child: Text(
                    'No hay pedidos aún',
                    style: TextStyle(color: Colors.grey),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _fetchOrders,
                  child: ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: _orders.length + (_hasMore ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == _orders.length) {
                        return const Padding(
                          padding: EdgeInsets.symmetric(vertical: 24),
                          child: Center(child: CircularProgressIndicator()),
                        );
                      }

                      final order = _orders[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 0,
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    'Pedido #${order.id}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 15,
                                    ),
                                  ),
                                  const Spacer(),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: _statusColor[order.status],
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      order.status.toUpperCase(),
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w900,
                                        color: _statusText[order.status],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                order.client.name,
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              Text(
                                order.client.address,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: Colors.grey,
                                ),
                              ),
                              if (order.notes != null) ...[
                                const SizedBox(height: 4),
                                Text(
                                  '📝 ${order.notes}',
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: Colors.orange,
                                  ),
                                ),
                              ],
                              const Divider(height: 16),
                              ...order.items.map(
                                (item) => Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      '${item.productName} x${item.quantity}',
                                      style: const TextStyle(fontSize: 13),
                                    ),
                                    Text(
                                      'Bs. ${(item.unitPrice * item.quantity).toStringAsFixed(2)}',
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Divider(height: 16),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    'Total',
                                    style: TextStyle(fontWeight: FontWeight.bold),
                                  ),
                                  Text(
                                    'Bs. ${order.total.toStringAsFixed(2)}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF3B82F6),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}

// ── Formulario crear pedido ───────────────────────────────────
class CreateOrderSheet extends StatefulWidget {
  final VoidCallback onSaved;
  final Client? initialClient;
  const CreateOrderSheet({super.key, required this.onSaved, this.initialClient});

  @override
  State<CreateOrderSheet> createState() => _CreateOrderSheetState();
}

class _CreateOrderSheetState extends State<CreateOrderSheet> {
  List<Client> _clients = [];
  List<Product> _products = [];
  Client? _selectedClient;
  final _notesCtrl = TextEditingController();
  final List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _selectedClient = widget.initialClient;
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final clients = await ClientService.getClients();
      final products = await PreventistaOrderService.getProducts();
      setState(() {
        _clients = clients;
        _products = products;
        
        // If initialClient is set, find its updated reference in the fetched clients list
        if (_selectedClient != null) {
           try {
             _selectedClient = _clients.firstWhere((c) => c.id == _selectedClient!.id);
           } catch(e) {
             _selectedClient = null;
           }
        }
        
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  void _addProduct(Product product) {
    final exists = _items.indexWhere((i) => i['productId'] == product.id);
    if (exists >= 0) {
      setState(() => _items[exists]['quantity']++);
    } else {
      setState(
        () => _items.add({
          'productId': product.id,
          'quantity': 1,
          'name': product.name,
          'price': product.price,
        }),
      );
    }
  }

  void _removeProduct(int productId) {
    setState(() => _items.removeWhere((i) => i['productId'] == productId));
  }

  void _updateQty(int productId, int qty) {
    if (qty < 1) return;
    setState(() {
      final idx = _items.indexWhere((i) => i['productId'] == productId);
      if (idx >= 0) _items[idx]['quantity'] = qty;
    });
  }

  double get _total => _items.fold(
    0,
    (s, i) => s + (i['price'] as double) * (i['quantity'] as int),
  );

  Future<void> _save() async {
    if (_selectedClient == null) {
      setState(() => _error = 'Selecciona un cliente');
      return;
    }
    if (_items.isEmpty) {
      setState(() => _error = 'Agrega al menos un producto');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await PreventistaOrderService.createOrder(
        clientId: _selectedClient!.id,
        notes: _notesCtrl.text.isEmpty ? null : _notesCtrl.text,
        items: _items
            .map(
              (i) => {'productId': i['productId'], 'quantity': i['quantity']},
            )
            .toList(),
      );
      widget.onSaved();
    } catch (e) {
      setState(() {
        _error = e.toString();
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.92,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Container(
                  margin: const EdgeInsets.symmetric(vertical: 12),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),

                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Row(
                    children: [
                      const Text(
                        'Nuevo pedido',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const Spacer(),
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                ),

                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Cliente
                        const Text(
                          'Cliente',
                          style: TextStyle(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 8),
                        DropdownButtonFormField<Client>(
                          initialValue: _selectedClient,
                          hint: const Text('Seleccionar cliente'),
                          decoration: InputDecoration(
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 12,
                            ),
                          ),
                          items: _clients
                              .map(
                                (c) => DropdownMenuItem(
                                  value: c,
                                  child: Text(c.name),
                                ),
                              )
                              .toList(),
                          onChanged: (c) => setState(() => _selectedClient = c),
                        ),

                        const SizedBox(height: 16),

                        // Notas
                        TextField(
                          controller: _notesCtrl,
                          decoration: InputDecoration(
                            labelText: 'Notas (opcional)',
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),

                        const SizedBox(height: 16),

                        // Productos
                        const Text(
                          'Productos',
                          style: TextStyle(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 8),
                        ..._products.map(
                          (p) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(
                              p.name,
                              style: const TextStyle(fontSize: 14),
                            ),
                            subtitle: Text(
                              'Bs. ${p.price.toStringAsFixed(2)} / ${p.unit}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            trailing: IconButton(
                              icon: const Icon(
                                Icons.add_circle,
                                color: Color(0xFF3B82F6),
                              ),
                              onPressed: () => _addProduct(p),
                            ),
                          ),
                        ),

                        // Items seleccionados
                        if (_items.isNotEmpty) ...[
                          const Divider(),
                          const Text(
                            'Resumen',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 8),
                          ..._items.map(
                            (item) => Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    item['name'],
                                    style: const TextStyle(fontSize: 13),
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(
                                    Icons.remove_circle_outline,
                                    size: 20,
                                  ),
                                  onPressed: () => _updateQty(
                                    item['productId'],
                                    item['quantity'] - 1,
                                  ),
                                ),
                                Text(
                                  '${item['quantity']}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(
                                    Icons.add_circle_outline,
                                    size: 20,
                                  ),
                                  onPressed: () => _updateQty(
                                    item['productId'],
                                    item['quantity'] + 1,
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(
                                    Icons.delete_outline,
                                    color: Colors.red,
                                    size: 20,
                                  ),
                                  onPressed: () =>
                                      _removeProduct(item['productId']),
                                ),
                              ],
                            ),
                          ),
                          const Divider(),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Total',
                                style: TextStyle(fontWeight: FontWeight.bold),
                              ),
                              Text(
                                'Bs. ${_total.toStringAsFixed(2)}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF3B82F6),
                                ),
                              ),
                            ],
                          ),
                        ],

                        if (_error != null) ...[
                          const SizedBox(height: 10),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.red.shade50,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              _error!,
                              style: TextStyle(
                                color: Colors.red.shade700,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],

                        const SizedBox(height: 20),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: _saving ? null : _save,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF3B82F6),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: _saving
                                ? const SizedBox(
                                    height: 18,
                                    width: 18,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Text(
                                    'Crear pedido',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
