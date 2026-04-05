import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import 'clients_screen.dart';
import 'preventista_orders_screen.dart';

class PreventistaHomeScreen extends StatefulWidget {
  const PreventistaHomeScreen({super.key});

  @override
  State<PreventistaHomeScreen> createState() => _PreventistaHomeScreenState();
}

class _PreventistaHomeScreenState extends State<PreventistaHomeScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = [
    const ClientsScreen(),
    const PreventistaOrdersScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final user = context.read<AuthProvider>().user;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Panel Preventista',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
            Text(
              'Hola, ${user?.name ?? ''}',
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => context.read<AuthProvider>().logout(),
          ),
        ],
      ),
      body: _screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        selectedItemColor: const Color(0xFF3B82F6),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.store), label: 'Clientes'),
          BottomNavigationBarItem(
            icon: Icon(Icons.shopping_bag),
            label: 'Pedidos',
          ),
        ],
      ),
    );
  }
}
