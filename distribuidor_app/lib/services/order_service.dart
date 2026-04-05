import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api.dart';
import '../models/order.dart';
import 'auth_service.dart';

class OrderService {
  static Future<Map<String, String>> _headers() async {
    final token = await AuthService.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  static Future<List<Order>> getMyOrders() async {
    final res = await http.get(
      Uri.parse('${Api.baseUrl}/distributor/orders'),
      headers: await _headers(),
    );

    if (res.statusCode == 200) {
      final List data = jsonDecode(res.body);
      return data.map((o) => Order.fromJson(o)).toList();
    }
    throw Exception('Error al cargar pedidos');
  }

  static Future<bool> deliverOrder(int orderId) async {
    final res = await http.patch(
      Uri.parse('${Api.baseUrl}/distributor/orders/$orderId/deliver'),
      headers: await _headers(),
    );
    return res.statusCode == 200;
  }
}
