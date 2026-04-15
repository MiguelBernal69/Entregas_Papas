import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../config/api.dart';
import '../services/client_service.dart';

class ClientDetailsSheet {
  static void show(
    BuildContext context, {
    required int id, // Añadido ID
    required String name,
    required String ownerName,
    required String phone,
    required String address,
    required double latitude,
    required double longitude,
    String? photoUrl,
    VoidCallback? onUpdate,
    VoidCallback? onCreateOrder, // Restaurado
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ClientDetailsSheetWidget(
        id: id,
        name: name,
        ownerName: ownerName,
        phone: phone,
        address: address,
        latitude: latitude,
        longitude: longitude,
        photoUrl: photoUrl,
        onUpdate: onUpdate,
        onCreateOrder: onCreateOrder, // Restaurado
      ),
    );
  }
}

class _ClientDetailsSheetWidget extends StatefulWidget {
  final int id;
  final String name;
  final String ownerName;
  final String phone;
  final String address;
  final double latitude;
  final double longitude;
  final String? photoUrl;
  final VoidCallback? onUpdate;
  final VoidCallback? onCreateOrder; // Restaurado

  const _ClientDetailsSheetWidget({
    required this.id,
    required this.name,
    required this.ownerName,
    required this.phone,
    required this.address,
    required this.latitude,
    required this.longitude,
    this.photoUrl,
    this.onUpdate,
    this.onCreateOrder, // Restaurado
  });

  @override
  State<_ClientDetailsSheetWidget> createState() => _ClientDetailsSheetWidgetState();
}

class _ClientDetailsSheetWidgetState extends State<_ClientDetailsSheetWidget> {
  late TextEditingController _nameCtrl;
  late TextEditingController _ownerCtrl;
  late TextEditingController _phoneCtrl;
  late TextEditingController _addressCtrl;

  File? _selectedImage;
  bool _isEditing = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.name);
    _ownerCtrl = TextEditingController(text: widget.ownerName);
    _phoneCtrl = TextEditingController(text: widget.phone);
    _addressCtrl = TextEditingController(text: widget.address);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _ownerCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final picker = ImagePicker();
      final pickedFile = await picker.pickImage(
        source: source,
        imageQuality: 70,
        maxWidth: 1000,
      );

      if (pickedFile != null) {
        setState(() {
          _selectedImage = File(pickedFile.path);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al acceder a la cámara: $e')),
        );
      }
    }
  }

  Future<void> _saveChanges() async {
    setState(() => _isSaving = true);
    try {
      await ClientService.updateClient(
        id: widget.id,
        name: _nameCtrl.text.trim(),
        ownerName: _ownerCtrl.text.trim(),
        phone: _phoneCtrl.text.trim(),
        address: _addressCtrl.text.trim(),
        latitude: widget.latitude,
        longitude: widget.longitude,
        imageFile: _selectedImage,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ Cliente actualizado correctamente'), backgroundColor: Colors.green),
        );
        widget.onUpdate?.call();
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('❌ Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          _buildHandle(),
          _buildHeader(),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildImageSection(),
                  const SizedBox(height: 24),
                  _buildFormFields(),
                  const SizedBox(height: 32),
                  if (_isEditing || _selectedImage != null) _buildSaveButton(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHandle() {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 12),
      width: 40,
      height: 4,
      decoration: BoxDecoration(
        color: Colors.grey.shade300,
        borderRadius: BorderRadius.circular(2),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          Text(
            _isEditing ? 'Editando Perfil' : 'Perfil del Cliente',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const Spacer(),
          IconButton(
            icon: Icon(_isEditing ? Icons.close : Icons.edit, color: Colors.blue),
            onPressed: () => setState(() => _isEditing = !_isEditing),
          ),
          if (widget.onCreateOrder != null)
            IconButton(
              icon: const Icon(Icons.shopping_cart, color: Colors.green),
              onPressed: () {
                Navigator.pop(context);
                widget.onCreateOrder!();
              },
            ),
          IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => Navigator.pop(context),
          ),
        ],
      ),
    );
  }

  Widget _buildImageSection() {
    return Center(
      child: Stack(
        children: [
          Container(
            height: 220,
            width: double.infinity,
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(20),
              boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 10)],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: _selectedImage != null
                  ? Image.file(_selectedImage!, fit: BoxFit.cover)
                  : (widget.photoUrl != null && widget.photoUrl!.isNotEmpty)
                      ? Image.network(
                          Api.getImageUrl(widget.photoUrl!),
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => const Icon(Icons.store, size: 64, color: Colors.grey),
                        )
                      : const Icon(Icons.store, size: 64, color: Colors.grey),
            ),
          ),
          Positioned(
            bottom: 12,
            right: 12,
            child: FloatingActionButton.small(
              backgroundColor: const Color(0xFF3B82F6),
              onPressed: () => _showPickerOptions(),
              child: const Icon(Icons.camera_alt, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }

  void _showPickerOptions() {
    showModalBottomSheet(
      context: context,
      builder: (_) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Cámara'),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Galería'),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFormFields() {
    return Column(
      children: [
        _buildTextField(_nameCtrl, 'Nombre del Negocio', Icons.store, enabled: _isEditing),
        const SizedBox(height: 16),
        _buildTextField(_ownerCtrl, 'Encargado', Icons.person, enabled: _isEditing),
        const SizedBox(height: 16),
        _buildTextField(_phoneCtrl, 'Teléfono', Icons.phone, enabled: _isEditing, keyboardType: TextInputType.phone),
        const SizedBox(height: 16),
        _buildTextField(_addressCtrl, 'Dirección', Icons.location_on, enabled: _isEditing, maxLines: 2),
      ],
    );
  }

  Widget _buildTextField(
    TextEditingController controller,
    String label,
    IconData icon, {
    bool enabled = true,
    TextInputType keyboardType = TextInputType.text,
    int maxLines = 1,
  }) {
    return TextField(
      controller: controller,
      enabled: enabled && !_isSaving,
      keyboardType: keyboardType,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, size: 20),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        filled: !enabled,
        fillColor: enabled ? Colors.transparent : Colors.grey.shade50,
      ),
      style: const TextStyle(fontSize: 14),
      onChanged: (_) => setState(() {}), // Activa el botón de guardar
    );
  }

  Widget _buildSaveButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: _isSaving ? null : _saveChanges,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF10B981),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          elevation: 0,
        ),
        child: _isSaving
            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
            : const Text('Guardar Cambios', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }
}
