class OrderItem {
  final int id;
  final int quantity;
  final int? deliveredQuantity;
  final double unitPrice;
  final String productName;
  final String productUnit;

  OrderItem({
    required this.id,
    required this.quantity,
    this.deliveredQuantity,
    required this.unitPrice,
    required this.productName,
    required this.productUnit,
  });

  /// Cantidad realmente entregada (si es null, se entregó todo)
  int get actualDelivered => deliveredQuantity ?? quantity;

  /// Cantidad devuelta (no vendida)
  int get returnedQuantity => quantity - actualDelivered;

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    return OrderItem(
      id: json['id'] ?? 0,
      quantity: json['quantity'] ?? 0,
      deliveredQuantity: json['deliveredQuantity'],
      unitPrice: (json['unitPrice'] as num? ?? 0.0).toDouble(),
      productName: json['product']?['name'] ?? 'Producto Desconocido',
      productUnit: json['product']?['unit'] ?? 'ud',
    );
  }
}

class OrderClient {
  final int id;
  final String name;
  final String ownerName;
  final String phone;
  final String address;
  final double latitude;
  final double longitude;
  final String? photoUrl;

  OrderClient({
    required this.id,
    required this.name,
    required this.ownerName,
    required this.phone,
    required this.address,
    required this.latitude,
    required this.longitude,
    this.photoUrl,
  });

  factory OrderClient.fromJson(Map<String, dynamic> json) {
    return OrderClient(
      id: json['id'] ?? 0,
      name: json['name'] ?? 'Sin Nombre',
      ownerName: json['ownerName'] ?? '',
      phone: json['phone'] ?? '',
      address: json['address'] ?? 'Sin Dirección',
      latitude: (json['latitude'] as num? ?? 0.0).toDouble(),
      longitude: (json['longitude'] as num? ?? 0.0).toDouble(),
      photoUrl: json['photoUrl'] ?? json['photo_url'],
    );
  }
}

class Order {
  final int id;
  final String status;
  final String? notes;
  final String createdAt;
  final OrderClient client;
  final List<OrderItem> items;

  Order({
    required this.id,
    required this.status,
    this.notes,
    required this.createdAt,
    required this.client,
    required this.items,
  });

  /// Total basado en cantidad PEDIDA
  double get total => items.fold(0.0, (sum, item) => sum + (item.unitPrice * item.quantity));

  /// Total basado en cantidad REALMENTE ENTREGADA
  double get totalEntregado => items.fold(0.0, (sum, item) => sum + (item.unitPrice * item.actualDelivered));

  /// Si es entrega parcial
  bool get isPartial => status == 'entrega_parcial';

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      id: json['id'],
      status: json['status'],
      notes: json['notes'],
      createdAt: json['createdAt'],
      client: OrderClient.fromJson(json['client']),
      items: (json['items'] as List).map((i) => OrderItem.fromJson(i)).toList(),
    );
  }
}
