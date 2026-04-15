import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' as ll;
import 'package:geolocator/geolocator.dart';
import '../models/order.dart';
import '../services/order_service.dart';
import '../config/api.dart';
import '../widgets/client_details_sheet.dart';

class MapScreen extends StatefulWidget {
  final List<Order> orders;
  final Order? focusOrder;

  const MapScreen({super.key, required this.orders, this.focusOrder});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final MapController _mapController = MapController();
  Position? _myPosition;
  Order? _selectedOrder;

  @override
  void initState() {
    super.initState();
    _selectedOrder = widget.focusOrder;
    _getLocation();
  }

  Future<void> _getLocation() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return;

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return;
    }

    final pos = await Geolocator.getCurrentPosition();
    if (mounted) setState(() => _myPosition = pos);
  }

  ll.LatLng get _center {
    if (widget.focusOrder != null) {
      return ll.LatLng(
        widget.focusOrder!.client.latitude,
        widget.focusOrder!.client.longitude,
      );
    }
    if (widget.orders.isNotEmpty) {
      return ll.LatLng(
        widget.orders.first.client.latitude,
        widget.orders.first.client.longitude,
      );
    }
    return const ll.LatLng(-17.3895, -66.1568);
  }

  Future<void> _deliver(int orderId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Confirmar entrega'),
        content: const Text('¿Marcar este pedido como entregado?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
            child: const Text(
              'Entregar',
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    final ok = await OrderService.deliverOrder(orderId);
    if (ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✅ Pedido entregado'),
          backgroundColor: Colors.green,
        ),
      );
      setState(() {
        widget.orders.removeWhere((o) => o.id == orderId);
        _selectedOrder = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Mapa de entregas',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(initialCenter: _center, initialZoom: 14),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.example.distribuidor_app',
              ),

              // Mi ubicación
              if (_myPosition != null)
                MarkerLayer(
                  markers: [
                    Marker(
                      point: ll.LatLng(
                        _myPosition!.latitude,
                        _myPosition!.longitude,
                      ),
                      width: 40,
                      height: 40,
                      child: const Icon(
                        Icons.my_location,
                        color: Colors.blue,
                        size: 32,
                      ),
                    ),
                  ],
                ),

              // Marcadores de pedidos
              MarkerLayer(
                markers: widget.orders.map((order) {
                  final isSelected = _selectedOrder?.id == order.id;
                  return Marker(
                    point: ll.LatLng(
                      order.client.latitude,
                      order.client.longitude,
                    ),
                    width: 40,
                    height: 40,
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedOrder = order),
                      child: Icon(
                        Icons.location_pin,
                        color: isSelected
                            ? Colors.red
                            : const Color(0xFF8B5CF6),
                        size: isSelected ? 42 : 34,
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),

          // Panel inferior con detalle del pedido seleccionado
          if (_selectedOrder != null)
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                  boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 10)],
                ),
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'Pedido #${_selectedOrder!.id}',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        const Spacer(),
                        GestureDetector(
                          onTap: () => setState(() => _selectedOrder = null),
                          child: const Icon(Icons.close, color: Colors.grey),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),

                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        if (_selectedOrder!.client.photoUrl != null &&
                            _selectedOrder!.client.photoUrl!.isNotEmpty)
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.network(
                              Api.getImageUrl(_selectedOrder!.client.photoUrl!),
                              height: 44,
                              width: 44,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) => Container(
                                height: 44,
                                width: 44,
                                color: Colors.grey.shade100,
                                child: const Icon(Icons.store, size: 20, color: Colors.grey),
                              ),
                            ),
                          ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _selectedOrder!.client.name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 15,
                                ),
                              ),
                              Text(
                                _selectedOrder!.client.ownerName,
                                style: const TextStyle(
                                  color: Colors.grey,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                        OutlinedButton.icon(
                          onPressed: () {
                            ClientDetailsSheet.show(
                              context,
                              id: _selectedOrder!.client.id,
                              name: _selectedOrder!.client.name,
                              ownerName: _selectedOrder!.client.ownerName,
                              phone: _selectedOrder!.client.phone,
                              address: _selectedOrder!.client.address,
                              latitude: _selectedOrder!.client.latitude,
                              longitude: _selectedOrder!.client.longitude,
                              photoUrl: _selectedOrder!.client.photoUrl,
                            );
                          },
                          icon: const Icon(Icons.person_search, size: 16),
                          label: const Text('Ver Perfil'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(
                          Icons.location_on,
                          size: 14,
                          color: Colors.grey,
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            _selectedOrder!.client.address,
                            style: const TextStyle(
                              fontSize: 13,
                              color: Colors.grey,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.phone, size: 14, color: Colors.grey),
                        const SizedBox(width: 4),
                        Text(
                          _selectedOrder!.client.phone,
                          style: const TextStyle(
                            fontSize: 13,
                            color: Colors.grey,
                          ),
                        ),
                      ],
                    ),

                    const Divider(height: 20),
                    const Text(
                      'Detalle del Pedido:',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 4),
                    // Lista de productos
                    ..._selectedOrder!.items.map(
                      (item) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '${item.productName} x${item.quantity}',
                              style: const TextStyle(
                                fontSize: 13,
                                color: Colors.black87,
                              ),
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
                    ),

                    const Divider(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Total: Bs. ${_selectedOrder!.total.toStringAsFixed(2)}',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF3B82F6),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () {
                              _mapController.move(
                                ll.LatLng(
                                  _selectedOrder!.client.latitude,
                                  _selectedOrder!.client.longitude,
                                ),
                                16,
                              );
                            },
                            icon: const Icon(
                              Icons.center_focus_strong,
                              size: 16,
                            ),
                            label: const Text('Centrar'),
                            style: OutlinedButton.styleFrom(
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                            ),
                          ),
                        ),
                        if (_selectedOrder!.status == 'asignado') ...[
                          const SizedBox(width: 10),
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: () => _deliver(_selectedOrder!.id),
                              icon: const Icon(
                                Icons.check_circle_outline,
                                size: 16,
                              ),
                              label: const Text('Entregar'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.green,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                padding: const EdgeInsets.symmetric(
                                  vertical: 10,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),

          // Botón mi ubicación
          Positioned(
            top: 16,
            right: 16,
            child: FloatingActionButton.small(
              heroTag: 'myLocation',
              onPressed: () {
                if (_myPosition != null) {
                  _mapController.move(
                    ll.LatLng(_myPosition!.latitude, _myPosition!.longitude),
                    15,
                  );
                }
              },
              child: const Icon(Icons.my_location),
            ),
          ),
        ],
      ),
    );
  }
}
