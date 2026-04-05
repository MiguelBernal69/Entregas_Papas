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
    final user = context.read<AuthProvider>().user;

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: const [
          _DistribuidorDashboard(),
          OrdersScreen(),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        selectedItemColor: const Color(0xFF3B82F6),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: 'Resumen'),
          BottomNavigationBarItem(icon: Icon(Icons.local_shipping), label: 'Mi Ruta'),
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
  Map<String, int> _inventoryStock = {};
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
      // By passing no status, we fetch all assigned and delivered from the backend
      final orders = await OrderService.getMyOrders();
      
      Map<String, int> stock = {};
      int entregados = 0;
      int pendientes = 0;

      for (var order in orders) {
        if (order.status == 'entregado') {
          entregados++;
        } else if (order.status == 'asignado') {
          pendientes++;
          // Calcular inventario total que tiene que cargar (sólo de los asignados pendientes + si queremos sumar los q ya entregó? 
          // El stock "cargado" suele ser la suma total inicial. Sumamos todo para tener el stock con el q inició el día.
        }
        
        // Sumamos al stock total independientemente si se entregó o no, esto equivale al stock q debió subir a la furgoneta hoy
        for (var item in order.items) {
          stock.update(
            item.productName,
            (val) => val + item.quantity,
            ifAbsent: () => item.quantity,
          );
        }
      }

      setState(() {
        _inventoryStock = stock;
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
              'Panel Distribuidor',
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
                    // Status Cards
                    Row(
                      children: [
                        Expanded(
                          child: _StatCard(
                            title: 'Entregas Hoy',
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
                      'Inventario Total a Cargar',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Suma de todos tus pedidos de hoy',
                      style: TextStyle(fontSize: 13, color: Colors.grey),
                    ),
                    const SizedBox(height: 16),

                    if (_inventoryStock.isEmpty)
                      const Card(
                        child: Padding(
                          padding: EdgeInsets.all(20),
                          child: Center(
                            child: Text(
                              'No tienes inventario o pedidos asignados hoy.',
                              style: TextStyle(color: Colors.grey),
                            ),
                          ),
                        ),
                      )
                    else
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.02),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            )
                          ],
                        ),
                        child: ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: _inventoryStock.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, index) {
                            String product = _inventoryStock.keys.elementAt(index);
                            int qty = _inventoryStock[product]!;
                            return ListTile(
                              leading: CircleAvatar(
                                backgroundColor: const Color(0xFF3B82F6).withValues(alpha: 0.1),
                                child: const Icon(Icons.inventory_2, color: Color(0xFF3B82F6), size: 18),
                              ),
                              title: Text(
                                product,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                              ),
                              trailing: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
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
                  ],
                ),
              ),
            ),
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
          )
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
