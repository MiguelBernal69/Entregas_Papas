import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' as ll;
import 'package:geolocator/geolocator.dart';
import '../models/order.dart';

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
                    Text(
                      _selectedOrder!.client.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    Text(
                      _selectedOrder!.client.ownerName,
                      style: const TextStyle(color: Colors.grey, fontSize: 13),
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
                    const SizedBox(height: 8),
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
                        ElevatedButton.icon(
                          onPressed: () {
                            _mapController.move(
                              ll.LatLng(
                                _selectedOrder!.client.latitude,
                                _selectedOrder!.client.longitude,
                              ),
                              16,
                            );
                          },
                          icon: const Icon(Icons.center_focus_strong, size: 16),
                          label: const Text('Centrar'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF3B82F6),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                          ),
                        ),
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
