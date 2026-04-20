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

  static Future<List<Order>> getMyOrders({String? status, String? date}) async {
    String url = '${Api.baseUrl}/distributor/orders';
    List<String> params = [];
    if (status != null) params.add('status=$status');
    if (date != null) params.add('date=$date');

    if (params.isNotEmpty) {
      url += '?${params.join('&')}';
    }
    final res = await http.get(
      Uri.parse(url),
      headers: await _headers(),
    );

    if (res.statusCode == 200) {
      final List data = jsonDecode(res.body);
      return data.map((o) => Order.fromJson(o)).toList();
    }
    throw Exception('Error al cargar pedidos');
  }

  /// Entrega un pedido. Si se proporcionan [deliveredItems], es entrega parcial.
  /// Cada item tiene { orderItemId, deliveredQuantity }.
  static Future<bool> deliverOrder(
    int orderId, {
    List<Map<String, int>>? deliveredItems,
  }) async {
    final body = deliveredItems != null
        ? jsonEncode({'deliveredItems': deliveredItems})
        : '{}';

    final res = await http.patch(
      Uri.parse('${Api.baseUrl}/distributor/orders/$orderId/deliver'),
      headers: await _headers(),
      body: body,
    );
    return res.statusCode == 200;
  }
}
