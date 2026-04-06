class Api {
  // Cambia esta IP por la de tu PC para dispositivos físicos
  // Si usas el emulador de Android de serie, usa 10.0.2.2
  static const String baseUrl = 'http://192.168.100.4:3000/api';

  static String getImageUrl(String photoUrl) {
    if (photoUrl.isEmpty) return '';
    
    final serverBase = baseUrl.replaceAll('/api', ''); // http://192.168.100.4:3000

    // Si ya es una URL completa que contiene localhost
    if (photoUrl.startsWith('http') && photoUrl.contains('localhost')) {
       final uri = Uri.parse(photoUrl);
       // Reemplazamos la parte de http://localhost:PORT por el serverBase
       return '$serverBase${uri.path}${uri.query.isEmpty ? '' : '?${uri.query}'}';
    }
    
    // Si es una URL completa normal (que no sea localhost)
    if (photoUrl.startsWith('http')) return photoUrl;
    
    // Si es una ruta relativa (ej: uploads/clients/...)
    return '$serverBase/${photoUrl.startsWith('/') ? photoUrl.substring(1) : photoUrl}';
  }
}
