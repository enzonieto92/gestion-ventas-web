# 🚀 Guía de Integración Supabase

## Paso 1: Crear una cuenta en Supabase

1. Ve a https://supabase.com
2. Haz clic en "Sign Up" o "Start Your Project"
3. Regístrate con email/GitHub
4. Crea un nuevo proyecto:
   - **Project Name**: Ej: "Sistema Gestión Ventas"
   - **Database Password**: Guárdalo bien (lo necesitarás)
   - **Region**: Elige la más cercana a tu ubicación

## Paso 2: Crear las tablas en Supabase

Una vez en el dashboard de Supabase, ve a **SQL Editor** y ejecuta este SQL:

```sql
-- Crear tabla de productos
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  stock INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de ventas
CREATE TABLE sales (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  date TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para mejor performance
CREATE INDEX idx_products_created ON products(created_at);
CREATE INDEX idx_sales_product_id ON sales(product_id);
CREATE INDEX idx_sales_created ON sales(created_at);
```

## Paso 3: Obtener las credenciales

1. En el dashboard de Supabase, ve a **Settings** → **API**
2. Copia estos valores:
   - **Project URL** (es tu `VITE_SUPABASE_URL`)
   - **anon public** key (es tu `VITE_SUPABASE_ANON_KEY`)

## Paso 4: Configurar variables de entorno en tu proyecto

1. En la raíz del proyecto, crea un archivo `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**⚠️ IMPORTANTE**: 
- Reemplaza `your-project.supabase.co` con tu URL real
- Reemplaza `your-anon-key-here` con tu clave real
- **NUNCA** commits este archivo a git (está en `.gitignore` por defecto)

## Paso 5: Reiniciar el servidor de desarrollo

Si el servidor estaba ejecutándose, detente (Ctrl+C) y ejecuta:

```bash
npm run dev
```

## Paso 6: Importar datos iniciales (OPCIONAL)

Si quieres pre-cargar algunos productos, en el SQL Editor ejecuta:

```sql
INSERT INTO products (name, price, stock) VALUES
('Laptop', 999.00, 10),
('Mouse', 25.00, 50),
('Teclado', 75.00, 30);
```

---

## ✅ Verificar que funciona

1. Abre la app en http://localhost:5173
2. Deberías ver "Cargando datos..." brevemente
3. Si las tablas cargan correctamente, ¡está configurado!
4. Intenta:
   - Agregar un producto
   - Registrar una venta
   - Recargar la página (datos persisten ✅)

## 🐛 Troubleshooting

### Error: "Missing Supabase credentials"
→ Verifica que el archivo `.env.local` exista y tenga las credenciales correctas

### Error: "relation 'products' does not exist"
→ Asegúrate de haber ejecutado el SQL para crear las tablas

### Los datos se cargan pero no puedo agregar productos
→ Ve a Supabase → **Table Editor** → Tabla "products"
→ Haz clic en el icono de engranaje → **RLS (Row Level Security)**
→ Deshabilita RLS o configura las políticas de acceso

### Servidor da error después de instalar
→ Ejecuta: `npm run dev` nuevamente

---

## 📚 Recursos útiles

- [Documentación de Supabase](https://supabase.com/docs)
- [SDK JavaScript](https://supabase.com/docs/reference/javascript)
- [SQL Reference](https://supabase.com/docs/guides/database/overview)

¡Listo! 🎉 Tu aplicación ahora persiste datos en Supabase.
