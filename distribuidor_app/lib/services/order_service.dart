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

  static Future<List<Order>> getMyOrders({
    String? status,
    String? date,
    int? page,
    int? limit,
    int? skip,
    int? take,
  }) async {
    String url = '${Api.baseUrl}/distributor/orders';
    List<String> params = [];
    if (status != null) params.add('status=$status');
    if (date != null) params.add('date=$date');
    if (page != null) params.add('page=$page');
    if (limit != null) params.add('limit=$limit');
    if (skip != null) params.add('skip=$skip');
    if (take != null) params.add('take=$take');

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
    String? notes,
  }) async {
    final Map<String, dynamic> payload = {};
    if (deliveredItems != null) payload['deliveredItems'] = deliveredItems;
    if (notes != null) payload['notes'] = notes;

    final body = jsonEncode(payload);

    final res = await http.patch(
      Uri.parse('${Api.baseUrl}/distributor/orders/$orderId/deliver'),
      headers: await _headers(),
      body: body,
    );
    if (res.statusCode == 200) return true;
    
    // Si hay error, intentar extraer el mensaje
    try {
      final data = jsonDecode(res.body);
      throw Exception(data['message'] ?? 'Error desconocido al entregar');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Error HTTP ${res.statusCode}');
    }
  }

  /// Rechaza un pedido (cliente no quiso aceptar).
  /// Pone deliveredQuantity=0 en todos los items y cambia status a 'rechazado'.
  static Future<bool> rejectOrder(int orderId, {String? notes}) async {
    final Map<String, dynamic> payload = {};
    if (notes != null && notes.isNotEmpty) payload['notes'] = notes;

    final uri = Uri.parse('${Api.baseUrl}/distributor/orders/$orderId/reject');
    final headers = await _headers();
    final body = jsonEncode(payload);

    http.Response res;
    try {
      res = await http.patch(uri, headers: headers, body: body);
    } catch (e) {
      throw Exception('No se pudo conectar al servidor: $e');
    }

    if (res.statusCode == 200) return true;

    // Mostrar el mensaje exacto del backend para facilitar el diagnóstico
    String errorMsg = 'Error HTTP ${res.statusCode}';
    try {
      final data = jsonDecode(res.body);
      errorMsg = data['message'] ?? errorMsg;
    } catch (_) {
      final preview = res.body.length > 200 ? res.body.substring(0, 200) : res.body;
      errorMsg = 'Error ${res.statusCode}: $preview';
    }
    throw Exception(errorMsg);
  }
}
