# SQL para Sistema de Promociones

Ejecuta este SQL en tu Supabase (SQL Editor):

```sql
-- Crear tabla de promociones
CREATE TABLE promotions (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL, -- precio especial del combo
  cost DECIMAL(10, 2) DEFAULT 0, -- costo total del combo
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de items de promoción (relación many-to-many)
CREATE TABLE promotion_items (
  id BIGSERIAL PRIMARY KEY,
  promotion_id BIGINT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(promotion_id, product_id) -- un producto solo puede aparecer una vez por promoción
);

-- Crear tabla de ventas de promociones
CREATE TABLE promotion_sales (
  id BIGSERIAL PRIMARY KEY,
  promotion_id BIGINT NOT NULL REFERENCES promotions(id),
  promotion_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total DECIMAL(10, 2) NOT NULL,
  date TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para mejor performance
CREATE INDEX idx_promotions_active ON promotions(is_active);
CREATE INDEX idx_promotion_items_promotion_id ON promotion_items(promotion_id);
CREATE INDEX idx_promotion_items_product_id ON promotion_items(product_id);
CREATE INDEX idx_promotion_sales_promotion_id ON promotion_sales(promotion_id);
CREATE INDEX idx_promotion_sales_created ON promotion_sales(created_at);

-- Función para verificar stock disponible para una promoción
CREATE OR REPLACE FUNCTION check_promotion_stock(promotion_id_param BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  item_record RECORD;
  available_stock INTEGER;
BEGIN
  -- Verificar cada item de la promoción
  FOR item_record IN
    SELECT pi.product_id, pi.quantity, p.stock
    FROM promotion_items pi
    JOIN products p ON pi.product_id = p.id
    WHERE pi.promotion_id = promotion_id_param
  LOOP
    -- Calcular stock disponible para este producto
    available_stock := item_record.stock / item_record.quantity;
    
    -- Si no hay suficiente stock para este item, retornar false
    IF available_stock < 1 THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  
  -- Si todos los items tienen stock suficiente, retornar true
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Función para decrementar stock cuando se vende una promoción
CREATE OR REPLACE FUNCTION decrement_promotion_stock(promotion_id_param BIGINT, quantity_param INTEGER DEFAULT 1)
RETURNS VOID AS $$
DECLARE
  item_record RECORD;
BEGIN
  -- Decrementar stock de cada producto en la promoción
  FOR item_record IN
    SELECT pi.product_id, pi.quantity
    FROM promotion_items pi
    WHERE pi.promotion_id = promotion_id_param
  LOOP
    -- Decrementar stock del producto
    UPDATE products 
    SET stock = stock - (item_record.quantity * quantity_param)
    WHERE id = item_record.product_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### Ejemplo de uso:

```sql
-- Crear una promoción "Laptop + Mouse"
INSERT INTO promotions (name, description, price, cost) 
VALUES ('Combo Laptop + Mouse', 'Ahorra 10% con este combo', 550.00, 510.00);

-- Agregar items a la promoción (suponiendo IDs de productos)
INSERT INTO promotion_items (promotion_id, product_id, quantity) VALUES
(1, 1, 1), -- 1 Laptop
(1, 2, 1); -- 1 Mouse

-- Verificar si hay stock para vender la promoción
SELECT check_promotion_stock(1); -- retorna true/false

-- Vender la promoción (decrementa stock automáticamente)
SELECT decrement_promotion_stock(1, 1);
```