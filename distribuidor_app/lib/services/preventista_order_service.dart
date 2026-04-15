import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api.dart';
import '../models/order.dart';
import '../models/product.dart';
import 'auth_service.dart';

class PreventistaOrderService {
  static Future<Map<String, String>> _headers() async {
    final token = await AuthService.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  static Future<List<Order>> getMyOrders({int page = 1, int limit = 30}) async {
    final res = await http.get(
      Uri.parse('${Api.baseUrl}/orders?page=$page&limit=$limit'),
      headers: await _headers(),
    );
    if (res.statusCode == 200) {
      final List data = jsonDecode(res.body);
      return data.map((o) => Order.fromJson(o)).toList();
    }
    throw Exception('Error al cargar pedidos');
  }

  static Future<List<Product>> getProducts() async {
    final res = await http.get(
      Uri.parse('${Api.baseUrl}/products'),
      headers: await _headers(),
    );
    if (res.statusCode == 200) {
      final List data = jsonDecode(res.body);
      return data.map((p) => Product.fromJson(p)).toList();
    }
    throw Exception('Error al cargar productos');
  }

  static Future<Order> createOrder({
    required int clientId,
    String? notes,
    required List<Map<String, dynamic>> items,
  }) async {
    final res = await http.post(
      Uri.parse('${Api.baseUrl}/orders'),
      headers: await _headers(),
      body: jsonEncode({'clientId': clientId, 'notes': notes, 'items': items}),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode == 201) return Order.fromJson(data);
    throw Exception(data['message'] ?? 'Error al crear pedido');
  }
}
