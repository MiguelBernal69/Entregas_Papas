class Product {
  final int id;
  final String name;
  final double price;
  final String unit;
  final bool isActive;

  Product({
    required this.id,
    required this.name,
    required this.price,
    required this.unit,
    required this.isActive,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'],
      name: json['name'],
      price: (json['price'] as num).toDouble(),
      unit: json['unit'],
      isActive: json['isActive'] ?? true,
    );
  }
}
