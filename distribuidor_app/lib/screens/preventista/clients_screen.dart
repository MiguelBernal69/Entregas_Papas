import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../models/client.dart';
import '../../services/client_service.dart';

class ClientsScreen extends StatefulWidget {
  const ClientsScreen({super.key});

  @override
  State<ClientsScreen> createState() => _ClientsScreenState();
}

class _ClientsScreenState extends State<ClientsScreen> {
  List<Client> _clients = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchClients();
  }

  Future<void> _fetchClients() async {
    setState(() => _loading = true);
    try {
      final data = await ClientService.getClients();
      setState(() {
        _clients = data;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  void _openForm({Client? client}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ClientFormSheet(
        client: client,
        onSaved: () {
          Navigator.pop(context);
          _fetchClients();
        },
      ),
    );
  }

  Future<void> _delete(int id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Desactivar cliente'),
        content: const Text('¿Estás seguro?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text(
              'Desactivar',
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    await ClientService.deleteClient(id);
    _fetchClients();
  }

  bool _isMapMode = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: const Text('Directorio de Clientes'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: SegmentedButton<bool>(
              segments: const [
                ButtonSegment(
                  value: false,
                  icon: Icon(Icons.list),
                  label: Text('Lista'),
                ),
                ButtonSegment(
                  value: true,
                  icon: Icon(Icons.map_outlined),
                  label: Text('Mapa'),
                ),
              ],
              selected: {_isMapMode},
              onSelectionChanged: (Set<bool> newSelection) {
                setState(() {
                  _isMapMode = newSelection.first;
                });
              },
            ),
          )
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openForm(),
        backgroundColor: const Color(0xFF3B82F6),
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _clients.isEmpty
          ? const Center(
              child: Text(
                'No hay clientes registrados',
                style: TextStyle(color: Colors.grey),
              ),
            )
          : _isMapMode
              ? FlutterMap(
                  options: MapOptions(
                    initialCenter: _clients.isNotEmpty && _clients.first.latitude != 0.0
                        ? LatLng(_clients.first.latitude, _clients.first.longitude)
                        : const LatLng(-17.3895, -66.1568),
                    initialZoom: 13,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.example.distribuidor_app',
                    ),
                    MarkerLayer(
                      markers: _clients.map((client) {
                        return Marker(
                          point: LatLng(client.latitude, client.longitude),
                          width: 40,
                          height: 40,
                          child: GestureDetector(
                            onTap: () => _openForm(client: client), // Optional: Or show a specific detail popup
                            child: const Icon(
                              Icons.location_pin,
                              color: Colors.blue,
                              size: 40,
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                )
              : RefreshIndicator(
                  onRefresh: _fetchClients,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _clients.length,
                    itemBuilder: (context, index) {
                      final client = _clients[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 0,
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 8,
                          ),
                          leading: CircleAvatar(
                            backgroundColor: const Color(
                              0xFF3B82F6,
                            ).withValues(alpha: 0.1),
                            child: const Text('🏪', style: TextStyle(fontSize: 20)),
                          ),
                          title: Text(
                            client.name,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                client.ownerName,
                                style: const TextStyle(fontSize: 13),
                              ),
                              Text(
                                client.address,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey,
                                ),
                              ),
                              Text(
                                client.phone,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey,
                                ),
                              ),
                            ],
                          ),
                          trailing: PopupMenuButton(
                            itemBuilder: (_) => [
                              const PopupMenuItem(
                                value: 'edit',
                                child: Text('Editar'),
                              ),
                              const PopupMenuItem(
                                value: 'delete',
                                child: Text(
                                  'Desactivar',
                                  style: TextStyle(color: Colors.red),
                                ),
                              ),
                            ],
                            onSelected: (val) {
                              if (val == 'edit') _openForm(client: client);
                              if (val == 'delete') _delete(client.id);
                            },
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}

// ── Formulario en bottom sheet con mapa ──────────────────────
class ClientFormSheet extends StatefulWidget {
  final Client? client;
  final VoidCallback onSaved;

  const ClientFormSheet({super.key, this.client, required this.onSaved});

  @override
  State<ClientFormSheet> createState() => _ClientFormSheetState();
}

class _ClientFormSheetState extends State<ClientFormSheet> {
  final _nameCtrl = TextEditingController();
  final _ownerCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  double? _lat;
  double? _lng;
  bool _saving = false;
  String? _error;
  bool _showMap = false;

  @override
  void initState() {
    super.initState();
    if (widget.client != null) {
      final c = widget.client!;
      _nameCtrl.text = c.name;
      _ownerCtrl.text = c.ownerName;
      _phoneCtrl.text = c.phone;
      _addressCtrl.text = c.address;
      _lat = c.latitude;
      _lng = c.longitude;
    }
  }

  Future<void> _useMyLocation() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return;
    LocationPermission perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.denied) return;

    final pos = await Geolocator.getCurrentPosition();
    setState(() {
      _lat = pos.latitude;
      _lng = pos.longitude;
      _showMap = true;
    });
  }

  Future<void> _save() async {
    if (_lat == null || _lng == null) {
      setState(() => _error = 'Debes seleccionar la ubicación en el mapa');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      if (widget.client != null) {
        await ClientService.updateClient(
          id: widget.client!.id,
          name: _nameCtrl.text,
          ownerName: _ownerCtrl.text,
          phone: _phoneCtrl.text,
          address: _addressCtrl.text,
          latitude: _lat!,
          longitude: _lng!,
        );
      } else {
        await ClientService.createClient(
          name: _nameCtrl.text,
          ownerName: _ownerCtrl.text,
          phone: _phoneCtrl.text,
          address: _addressCtrl.text,
          latitude: _lat!,
          longitude: _lng!,
        );
      }
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
      child: Column(
        children: [
          // Handle
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
                Text(
                  widget.client != null ? 'Editar cliente' : 'Nuevo cliente',
                  style: const TextStyle(
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
                children: [
                  _Field(ctrl: _nameCtrl, label: 'Nombre del negocio'),
                  _Field(ctrl: _ownerCtrl, label: 'Nombre del dueño'),
                  _Field(
                    ctrl: _phoneCtrl,
                    label: 'Teléfono',
                    keyboard: TextInputType.phone,
                  ),
                  _Field(ctrl: _addressCtrl, label: 'Dirección'),

                  const SizedBox(height: 12),

                  // Botones de ubicación
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _useMyLocation,
                          icon: const Icon(Icons.my_location, size: 16),
                          label: const Text('Mi ubicación'),
                          style: OutlinedButton.styleFrom(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => setState(() => _showMap = true),
                          icon: const Icon(Icons.map_outlined, size: 16),
                          label: const Text('Elegir en mapa'),
                          style: OutlinedButton.styleFrom(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),

                  // Mapa para elegir ubicación
                  if (_showMap) ...[
                    const SizedBox(height: 12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: SizedBox(
                        height: 220,
                        child: FlutterMap(
                          options: MapOptions(
                            initialCenter: _lat != null
                                ? LatLng(_lat!, _lng!)
                                : const LatLng(-17.3895, -66.1568),
                            initialZoom: 15,
                            onTap: (_, point) => setState(() {
                              _lat = point.latitude;
                              _lng = point.longitude;
                            }),
                          ),
                          children: [
                            TileLayer(
                              urlTemplate:
                                  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                              userAgentPackageName:
                                  'com.example.distribuidor_app',
                            ),
                            if (_lat != null)
                              MarkerLayer(
                                markers: [
                                  Marker(
                                    point: LatLng(_lat!, _lng!),
                                    width: 40,
                                    height: 40,
                                    child: const Icon(
                                      Icons.location_pin,
                                      color: Colors.red,
                                      size: 40,
                                    ),
                                  ),
                                ],
                              ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Toca el mapa para marcar la ubicación',
                      style: TextStyle(fontSize: 12, color: Colors.grey),
                      textAlign: TextAlign.center,
                    ),
                  ],

                  // Coordenadas
                  if (_lat != null) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.green.shade50,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.check_circle,
                            color: Colors.green,
                            size: 16,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'Lat: ${_lat!.toStringAsFixed(5)}, Lng: ${_lng!.toStringAsFixed(5)}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.green,
                            ),
                          ),
                        ],
                      ),
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
                          : Text(
                              widget.client != null
                                  ? 'Guardar cambios'
                                  : 'Crear cliente',
                              style: const TextStyle(
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

class _Field extends StatelessWidget {
  final TextEditingController ctrl;
  final String label;
  final TextInputType keyboard;

  const _Field({
    required this.ctrl,
    required this.label,
    this.keyboard = TextInputType.text,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextField(
        controller: ctrl,
        keyboardType: keyboard,
        decoration: InputDecoration(
          labelText: label,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 14,
            vertical: 12,
          ),
        ),
      ),
    );
  }
}
