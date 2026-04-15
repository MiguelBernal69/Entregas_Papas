import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';

import '../../services/order_service.dart';
import '../orders_screen.dart';

class DistribuidorHomeScreen extends StatefulWidget {
  const DistribuidorHomeScreen({super.key});

  @override
  State<DistribuidorHomeScreen> createState() => _DistribuidorHomeScreenState();
}

class _DistribuidorHomeScreenState extends State<DistribuidorHomeScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: const [_DistribuidorDashboard(), OrdersScreen()],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        selectedItemColor: const Color(0xFF3B82F6),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard),
            label: 'Resumen',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.local_shipping),
            label: 'Mi Ruta',
          ),
        ],
      ),
    );
  }
}

class _DistribuidorDashboard extends StatefulWidget {
  const _DistribuidorDashboard();

  @override
  State<_DistribuidorDashboard> createState() => _DistribuidorDashboardState();
}

class _DistribuidorDashboardState extends State<_DistribuidorDashboard> {
  bool _loading = true;
  Map<String, int> _initialStock = {};
  Map<String, int> _remainingStock = {};
  int _totalInitialQty = 0;
  int _totalRemainingQty = 0;
  double _totalCollected = 0;
  int _entregadosCount = 0;
  int _pendientesCount = 0;

  @override
  void initState() {
    super.initState();
    _fetchDashboardData();
  }

  Future<void> _fetchDashboardData() async {
    setState(() => _loading = true);
    try {
      final now = DateTime.now();
      final today =
          "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";

      // Fetch all assigned and delivered for TODAY
      final orders = await OrderService.getMyOrders(date: today);

      Map<String, int> initial = {};
      Map<String, int> remaining = {};
      int totalInitialQty = 0;
      int totalRemainingQty = 0;
      double collected = 0;
      int entregados = 0;
      int pendientes = 0;

      for (var order in orders) {
        final status = order.status.toLowerCase();
        if (status == 'entregado') {
          entregados++;
          collected += order.total;
        } else if (status == 'asignado') {
          pendientes++;
          // Sumar al stock que aún queda en la camioneta
          for (var item in order.items) {
            totalRemainingQty += item.quantity;
            remaining.update(
              item.productName,
              (val) => val + item.quantity,
              ifAbsent: () => item.quantity,
            );
          }
        }

        for (var item in order.items) {
          totalInitialQty += item.quantity;
          initial.update(
            item.productName,
            (val) => val + item.quantity,
            ifAbsent: () => item.quantity,
          );
        }
      }

      setState(() {
        _initialStock = initial;
        _remainingStock = remaining;
        _totalInitialQty = totalInitialQty;
        _totalRemainingQty = totalRemainingQty;
        _totalCollected = collected;
        _entregadosCount = entregados;
        _pendientesCount = pendientes;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.read<AuthProvider>().user;

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Reporte del Día',
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
            icon: const Icon(Icons.refresh),
            onPressed: _fetchDashboardData,
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => context.read<AuthProvider>().logout(),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchDashboardData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Resumen Financiero
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF10B981), Color(0xFF059669)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.green.withValues(alpha: 0.3),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(
                                Icons.account_balance_wallet,
                                color: Colors.white,
                                size: 20,
                              ),
                              SizedBox(width: 8),
                              Text(
                                'Total a Depositar (Hoy)',
                                style: TextStyle(
                                  color: Colors.white70,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Bs. ${_totalCollected.toStringAsFixed(2)}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 32,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Recaudado de $_entregadosCount pedidos entregados',
                            style: const TextStyle(
                              color: Colors.white38,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Status Cards
                    Row(
                      children: [
                        Expanded(
                          child: _StatCard(
                            title: 'Entregas',
                            value: '$_entregadosCount',
                            subtitle: 'Completadas',
                            icon: Icons.check_circle,
                            color: Colors.green,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _StatCard(
                            title: 'Faltantes',
                            value: '$_pendientesCount',
                            subtitle: 'Por entregar',
                            icon: Icons.pending_actions,
                            color: Colors.orange,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    const Text(
                      'Resumen de Mercadería',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 16),

                    DefaultTabController(
                      length: 2,
                      child: Column(
                        children: [
                          Container(
                            height: 45,
                            decoration: BoxDecoration(
                              color: Colors.grey.shade200,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: TabBar(
                              indicatorSize: TabBarIndicatorSize.tab,
                              dividerColor: Colors.transparent,
                              indicator: BoxDecoration(
                                borderRadius: BorderRadius.circular(10),
                                color: const Color(0xFF3B82F6),
                              ),
                              labelColor: Colors.white,
                              unselectedLabelColor: Colors.grey,
                              tabs: const [
                                Tab(text: 'Carga Total'),
                                Tab(text: 'En Camioneta'),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          SizedBox(
                            height: 350, // Ajustar según necesidad
                            child: TabBarView(
                              children: [
                                _InventoryList(
                                  stock: _initialStock,
                                  label: 'Total de productos cargados hoy',
                                  totalQty: _totalInitialQty,
                                ),
                                _InventoryList(
                                  stock: _remainingStock,
                                  label: 'Productos pendientes por entregar',
                                  totalQty: _totalRemainingQty,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

class _InventoryList extends StatelessWidget {
  final Map<String, int> stock;
  final String label;
  final int totalQty;

  const _InventoryList({
    required this.stock,
    required this.label,
    required this.totalQty,
  });

  @override
  Widget build(BuildContext context) {
    if (stock.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.inventory_2_outlined,
              size: 48,
              color: Colors.grey.shade300,
            ),
            const SizedBox(height: 12),
            Text(
              'Sin movimientos registrados',
              style: TextStyle(color: Colors.grey.shade400),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12, left: 4),
          child: Row(
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  color: Colors.grey,
                  fontStyle: FontStyle.italic,
                ),
              ),
              const Spacer(),
              Text(
                'Total: $totalQty',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [
                BoxShadow(
                  color: Colors.black12,
                  blurRadius: 4,
                  offset: Offset(0, 2),
                ),
              ],
            ),
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: stock.length,
              separatorBuilder: (_, _) => const Divider(height: 1, indent: 60),
              itemBuilder: (context, index) {
                String product = stock.keys.elementAt(index);
                int qty = stock[product]!;
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: const Color(
                      0xFF3B82F6,
                    ).withValues(alpha: 0.1),
                    child: const Icon(
                      Icons.inventory_2,
                      color: Color(0xFF3B82F6),
                      size: 18,
                    ),
                  ),
                  title: Text(
                    product,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'x$qty',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.blue,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final MaterialColor color;

  const _StatCard({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 28),
          const SizedBox(height: 12),
          Text(
            value,
            style: TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.w900,
              color: color.shade700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          Text(
            subtitle,
            style: const TextStyle(fontSize: 12, color: Colors.grey),
          ),
        ],
      ),
    );
  }
}
