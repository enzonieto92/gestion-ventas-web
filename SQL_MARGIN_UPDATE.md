# SQL para agregar margen de ganancias

Copia y ejecuta este SQL en tu Supabase (SQL Editor):

```sql
-- Agregar columna de costo a la tabla products
ALTER TABLE products ADD COLUMN cost DECIMAL(10, 2) DEFAULT 0;

-- Crear una función para calcular el margen de ganancia
CREATE OR REPLACE FUNCTION calculate_margin(price DECIMAL, cost DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
  IF cost = 0 OR cost IS NULL THEN
    RETURN 0;
  END IF;
  RETURN ROUND((((price - cost) / cost) * 100)::numeric, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Si ya tienes productos, actualiza sus costos
-- Ejemplo (cambia los valores según sea necesario):
UPDATE products SET cost = 500 WHERE name = 'Laptop';
UPDATE products SET cost = 10 WHERE name = 'Mouse';
UPDATE products SET cost = 35 WHERE name = 'Teclado';
```

Luego de ejecutar esto, recarga la aplicación.
