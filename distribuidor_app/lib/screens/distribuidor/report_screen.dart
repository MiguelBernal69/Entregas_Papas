import 'package:flutter/material.dart';
import '../../services/session_service.dart';

class ReportScreen extends StatefulWidget {
  final VoidCallback? onSessionEnded;
  const ReportScreen({super.key, this.onSessionEnded});

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  bool _loading = true;
  bool _hasSession = false;
  Map<String, dynamic>? _report;
  String? _error;

  @override
  void initState() {
    super.initState();
    _checkSession();
  }

  Future<void> _checkSession() async {
    setState(() => _loading = true);
    try {
      final session = await SessionService.getActiveSession();
      if (session != null) {
        _hasSession = true;
        await _fetchReport();
      } else {
        setState(() {
          _hasSession = false;
          _loading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _fetchReport() async {
    try {
      final report = await SessionService.getSessionReport();
      setState(() {
        _report = report;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      // Si la sesión fue cerrada por el admin u ocurre un error, 
      // regresamos al flujo de verificación que mostrará "Iniciar Jornada".
      _checkSession();
    }
  }

  Future<void> _openSession() async {
    try {
      await SessionService.openSession();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Sesión de distribución abierta'),
            backgroundColor: Colors.green,
          ),
        );
      }
      _checkSession();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _endDay() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Terminar Día'),
        content: const Text('¿Estás seguro de que quieres finalizar tu jornada? Se cerrará tu ruta y deberás rendir cuentas a bodega.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sí, Finalizar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await SessionService.closeSession();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Jornada finalizada con éxito'),
            backgroundColor: Colors.green,
          ),
        );
      }
      widget.onSessionEnded?.call();
      _checkSession();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: Colors.red));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: const Text(
          'Reporte de Distribución',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          if (_hasSession)
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _fetchReport,
            ),
          if (_hasSession)
            IconButton(
              icon: const Icon(Icons.power_settings_new),
              tooltip: 'Terminar Día',
              color: Colors.red,
              onPressed: _endDay,
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 48, color: Colors.red),
                      const SizedBox(height: 12),
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                      const SizedBox(height: 12),
                      ElevatedButton(onPressed: _checkSession, child: const Text('Reintentar')),
                    ],
                  ),
                )
              : !_hasSession
                  ? _buildNoSession()
                  : _buildReport(),
    );
  }

  Widget _buildNoSession() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.play_circle_outline,
                size: 64,
                color: Color(0xFF3B82F6),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Iniciar Jornada de Distribución',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Text(
              'Abre una sesión para comenzar a registrar tus entregas. '
              'Al finalizar, el administrador podrá revisar tu reporte '
              'y cerrar la jornada.',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _openSession,
                icon: const Icon(Icons.rocket_launch, size: 20),
                label: const Text(
                  'Abrir Sesión',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF3B82F6),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 0,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReport() {
    final resumen = _report!['resumen'] as Map<String, dynamic>;
    final productosVendidos = _report!['productosVendidos'] as List<dynamic>;
    final stockEnCamioneta = _report!['stockEnCamioneta'] as List<dynamic>;
    final pedidos = (_report!['pedidos'] as List<dynamic>?) ?? [];

    return RefreshIndicator(
      onRefresh: _fetchReport,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Estado de sesión
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.green.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.green.shade200),
              ),
              child: Row(
                children: [
                  Icon(Icons.circle, size: 10, color: Colors.green.shade600),
                  const SizedBox(width: 8),
                  const Text(
                    'Sesión activa',
                    style: TextStyle(fontWeight: FontWeight.bold, color: Colors.green),
                  ),
                  const Spacer(),
                  Text(
                    'Inicio: ${_formatDate(_report!['session']['openedAt'])}',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Card de dinero recaudado
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
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
                      Icon(Icons.account_balance_wallet, color: Colors.white, size: 20),
                      SizedBox(width: 8),
                      Text(
                        'Dinero Recaudado',
                        style: TextStyle(color: Colors.white70, fontSize: 14),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Bs. ${(resumen['totalRecaudado'] as num).toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 32,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Stats cards
            Row(
              children: [
                Expanded(
                  child: _StatMiniCard(
                    icon: Icons.check_circle,
                    color: Colors.green,
                    value: '${resumen['puntosEntregados']}',
                    label: 'Puntos\nentregados',
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _StatMiniCard(
                    icon: Icons.pending_actions,
                    color: Colors.orange,
                    value: '${resumen['pedidosPendientes']}',
                    label: 'Pedidos\npendientes',
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _StatMiniCard(
                    icon: Icons.inventory_2,
                    color: const Color(0xFF3B82F6),
                    value: '${resumen['totalPedidos']}',
                    label: 'Total\npedidos',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Productos vendidos
            const Text(
              'Productos Vendidos',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87),
            ),
            const SizedBox(height: 12),
            if (productosVendidos.isEmpty)
              _emptyState('Sin ventas registradas aún')
            else
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: const [
                    BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2)),
                  ],
                ),
                child: Column(
                  children: [
                    // Header
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                      ),
                      child: const Row(
                        children: [
                          Expanded(flex: 3, child: Text('Producto', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.grey))),
                          Expanded(child: Text('Pedido', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.grey), textAlign: TextAlign.center)),
                          Expanded(child: Text('Entreg.', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.grey), textAlign: TextAlign.center)),
                          Expanded(child: Text('Devuel.', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.grey), textAlign: TextAlign.center)),
                        ],
                      ),
                    ),
                    ...productosVendidos.map((p) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        border: Border(top: BorderSide(color: Colors.grey.shade100)),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            flex: 3,
                            child: Text(
                              p['name'],
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              '${p['cantidadPedida']}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 13),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              '${p['cantidadEntregada']}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 13, color: Colors.green, fontWeight: FontWeight.bold),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              '${p['cantidadDevuelta']}',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: (p['cantidadDevuelta'] as num) > 0 ? Colors.orange : Colors.grey,
                              ),
                            ),
                          ),
                        ],
                      ),
                    )),
                  ],
                ),
              ),

            const SizedBox(height: 24),

            // Stock en camioneta
            const Text(
              'Stock en Camioneta',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87),
            ),
            const SizedBox(height: 4),
            Text(
              'Productos pendientes + devueltos por clientes',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 12),
            if (stockEnCamioneta.isEmpty)
              _emptyState('Camioneta vacía — todo entregado 🎉')
            else
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: const [
                    BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2)),
                  ],
                ),
                child: ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: stockEnCamioneta.length,
                  separatorBuilder: (_, _) => const Divider(height: 1, indent: 16),
                  itemBuilder: (_, i) {
                    final s = stockEnCamioneta[i];
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: Colors.orange.shade50,
                        child: const Icon(Icons.inventory_2, color: Colors.orange, size: 18),
                      ),
                      title: Text(
                        s['name'],
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      trailing: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.orange.shade50,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          'x${s['cantidad']}',
                          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.orange),
                        ),
                      ),
                    );
                  },
                ),
              ),

            const SizedBox(height: 32),

            // ── Detalle de pedidos desplegable ──────────────────────────────
            if (pedidos.isNotEmpty) ...[
              _PedidosExpandable(pedidos: pedidos),
              const SizedBox(height: 32),
            ],
          ],
        ),
      ),
    );
  }

  Widget _emptyState(String msg) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(Icons.inventory_2_outlined, size: 36, color: Colors.grey.shade300),
          const SizedBox(height: 8),
          Text(msg, style: TextStyle(color: Colors.grey.shade400, fontSize: 13)),
        ],
      ),
    );
  }

  String _formatDate(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    return '${d.day}/${d.month}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }
}

class _PedidosExpandable extends StatefulWidget {
  final List<dynamic> pedidos;
  const _PedidosExpandable({required this.pedidos});

  @override
  State<_PedidosExpandable> createState() => _PedidosExpandableState();
}

class _PedidosExpandableState extends State<_PedidosExpandable> {
  bool _expanded = false;
  final Set<int> _openedOrders = {};

  Color _statusColor(String status) {
    switch (status) {
      case 'entregado':       return Colors.green;
      case 'entrega_parcial': return Colors.orange;
      case 'rechazado':       return Colors.red;
      case 'asignado':        return Colors.blue;
      default:                return Colors.grey;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'entregado':       return '✅ Entregado';
      case 'entrega_parcial': return '⚠️ Parcial';
      case 'rechazado':       return '🚫 Rechazado';
      case 'asignado':        return '🕐 Pendiente';
      default:                return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final entregados = widget.pedidos.where((p) => p['status'] == 'entregado').length;
    final parciales  = widget.pedidos.where((p) => p['status'] == 'entrega_parcial').length;
    final rechazados = widget.pedidos.where((p) => p['status'] == 'rechazado').length;
    final pendientes = widget.pedidos.where((p) => p['status'] == 'asignado').length;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2)),
        ],
      ),
      child: Column(
        children: [
          // Cabecera desplegable
          InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(Icons.receipt_long, color: Color(0xFF3B82F6), size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Detalle de Pedidos',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        const SizedBox(height: 4),
                        Wrap(
                          spacing: 6,
                          children: [
                            if (entregados > 0) _badge('$entregados entregados', Colors.green),
                            if (parciales  > 0) _badge('$parciales parciales',  Colors.orange),
                            if (rechazados > 0) _badge('$rechazados rechazados', Colors.red),
                            if (pendientes > 0) _badge('$pendientes pendientes', Colors.blue),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Icon(_expanded ? Icons.expand_less : Icons.expand_more, color: Colors.grey),
                ],
              ),
            ),
          ),

          // Lista de pedidos (si está expandido)
          if (_expanded) ...[
            const Divider(height: 1),
            ...widget.pedidos.map((pedido) {
              final orderId  = pedido['id'] as int? ?? 0;
              final status   = pedido['status'] as String? ?? '';
              final client   = pedido['client'] as Map<String, dynamic>? ?? {};
              final items    = (pedido['items'] as List<dynamic>?) ?? [];
              final isOpen   = _openedOrders.contains(orderId);

              double totalPedido = 0;
              for (final item in items) {
                if (item['isBonification'] == true) continue;
                final delivered = (item['deliveredQuantity'] as num?)?.toInt()
                    ?? (item['quantity'] as num?)?.toInt() ?? 0;
                final price = (item['unitPrice'] as num?)?.toDouble() ?? 0.0;
                totalPedido += delivered * price;
              }

              return Column(
                children: [
                  // Fila del pedido
                  InkWell(
                    onTap: () => setState(() => isOpen
                        ? _openedOrders.remove(orderId)
                        : _openedOrders.add(orderId)),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 16,
                            backgroundColor: _statusColor(status).withValues(alpha: 0.1),
                            child: Icon(
                              status == 'entregado'
                                  ? Icons.check_circle
                                  : status == 'entrega_parcial'
                                      ? Icons.warning_amber
                                      : status == 'rechazado'
                                          ? Icons.block
                                          : Icons.pending,
                              color: _statusColor(status),
                              size: 16,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  client['name'] ?? 'Cliente',
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  _statusLabel(status),
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: _statusColor(status),
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            'Bs. ${totalPedido.toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                              color: Color(0xFF059669),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Icon(
                            isOpen ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                            size: 18,
                            color: Colors.grey,
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Items del pedido
                  if (isOpen)
                    Container(
                      color: Colors.grey.shade50,
                      padding: const EdgeInsets.fromLTRB(52, 4, 16, 10),
                      child: Column(
                        children: items.map<Widget>((item) {
                          final isBoni    = item['isBonification'] == true;
                          final qty       = (item['quantity'] as num?)?.toInt() ?? 0;
                          final delivered = (item['deliveredQuantity'] as num?)?.toInt() ?? qty;
                          final devuelto  = qty - delivered;
                          final price     = (item['unitPrice'] as num?)?.toDouble() ?? 0.0;

                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 3),
                            child: Row(
                              children: [
                                if (isBoni)
                                  Container(
                                    margin: const EdgeInsets.only(right: 6),
                                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: Colors.green.shade50,
                                      borderRadius: BorderRadius.circular(4),
                                      border: Border.all(color: Colors.green.shade200),
                                    ),
                                    child: const Text('🎁', style: TextStyle(fontSize: 10)),
                                  ),
                                Expanded(
                                  child: Text(
                                    item['productName'] ?? '',
                                    style: const TextStyle(fontSize: 12, color: Colors.black87),
                                  ),
                                ),
                                Text(
                                  isBoni
                                      ? '${delivered}/${qty} ${item['unit'] ?? ''}'
                                      : '${delivered}/${qty} · Bs.${(delivered * price).toStringAsFixed(2)}',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: devuelto > 0
                                        ? Colors.orange.shade700
                                        : Colors.green.shade700,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                    ),

                  const Divider(height: 1, indent: 16),
                ],
              );
            }),
          ],
        ],
      ),
    );
  }

  Widget _badge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.bold),
      ),
    );
  }
}


class _StatMiniCard extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String value;
  final String label;

  const _StatMiniCard({
    required this.icon,
    required this.color,
    required this.value,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.1),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 11, color: Colors.grey),
          ),
        ],
      ),
    );
  }
}
