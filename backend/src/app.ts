import express from 'express'
import dotenv from 'dotenv'
import path from 'path'
import authRouter from './modules/auth/auth.router'
import usersRouter from './modules/users/users.router'
import clientsRouter from './modules/clients/clients.router'
import productsRouter from './modules/products/products.router'
import ordersRouter from './modules/orders/orders.router'
import regionsRouter from './modules/regions/regions.router'

dotenv.config()

const app = express()
app.use(express.json())

// Servir archivos estáticos (fotos de clientes)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/products', productsRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/regions', regionsRouter)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`))

export default app