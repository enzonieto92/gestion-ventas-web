import { supabase } from './supabase';

export interface Product {
  id: number;
  name: string;
  price: number;
  cost: number;
  stock: number;
  created_at?: string;
}

export interface ProductMargin {
  productId: number;
  name: string;
  cost: number;
  price: number;
  margin: number; // porcentaje
}

export interface Sale {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  total: number;
  cost: number;
  date: string;
  created_at?: string;
}

export interface Promotion {
  id: number;
  name: string;
  description?: string;
  price: number;
  cost: number;
  is_active: boolean;
  created_at?: string;
  items?: PromotionItem[];
}

export interface PromotionItem {
  id: number;
  promotion_id: number;
  product_id: number;
  quantity: number;
  product?: Product; // para mostrar detalles del producto
}

export interface PromotionSale {
  id: number;
  promotion_id: number;
  promotion_name: string;
  quantity: number;
  total: number;
  cost: number;
  date: string;
  created_at?: string;
}

// PRODUCTS
export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }

  return data || [];
}

export async function addProduct(product: Omit<Product, 'id' | 'created_at'>): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .insert([product])
    .select();

  if (error) {
    console.error('Error adding product:', error);
    return null;
  }

  return data?.[0] || null;
}

export async function updateProduct(id: number, updates: Partial<Omit<Product, 'id' | 'created_at'>>): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating product:', error);
    return null;
  }

  return data?.[0] || null;
}

export function calculateMargin(price: number, cost: number): number {
  if (cost === 0 || !cost) return 0;
  return Math.round(((price - cost) / cost) * 100 * 100) / 100;
}

// PROMOTIONS
export async function fetchPromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select(`
      *,
      items:promotion_items(
        id,
        quantity,
        product:products(id, name, price, stock)
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching promotions:', error);
    return [];
  }

  return data || [];
}

export async function addPromotion(promotion: Omit<Promotion, 'id' | 'created_at' | 'items'>, items: Omit<PromotionItem, 'id' | 'promotion_id' | 'created_at'>[]): Promise<Promotion | null> {
  // Crear la promoción
  const { data: promoData, error: promoError } = await supabase
    .from('promotions')
    .insert([{
      name: promotion.name,
      description: promotion.description,
      price: promotion.price,
      cost: promotion.cost,
      is_active: promotion.is_active
    }])
    .select();

  if (promoError || !promoData?.[0]) {
    console.error('Error creating promotion:', promoError);
    return null;
  }

  const promotionId = promoData[0].id;

  // Agregar los items
  const itemsWithPromotionId = items.map(item => ({
    ...item,
    promotion_id: promotionId
  }));

  const { error: itemsError } = await supabase
    .from('promotion_items')
    .insert(itemsWithPromotionId);

  if (itemsError) {
    console.error('Error adding promotion items:', itemsError);
    // Si falla, intentar eliminar la promoción creada
    await supabase.from('promotions').delete().eq('id', promotionId);
    return null;
  }

  // Retornar la promoción completa
  return await fetchPromotionById(promotionId);
}

export async function fetchPromotionById(id: number): Promise<Promotion | null> {
  const { data, error } = await supabase
    .from('promotions')
    .select(`
      *,
      items:promotion_items(
        id,
        quantity,
        product:products(id, name, price, stock)
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching promotion:', error);
    return null;
  }

  return data;
}

export async function updatePromotion(id: number, updates: Partial<Omit<Promotion, 'id' | 'created_at' | 'items'>>, items?: Omit<PromotionItem, 'id' | 'promotion_id' | 'created_at'>[]): Promise<Promotion | null> {
  // Actualizar la promoción
  const { error: promoError } = await supabase
    .from('promotions')
    .update(updates)
    .eq('id', id);

  if (promoError) {
    console.error('Error updating promotion:', promoError);
    return null;
  }

  // Si se proporcionaron items, actualizarlos
  if (items) {
    // Eliminar items existentes
    await supabase.from('promotion_items').delete().eq('promotion_id', id);

    // Agregar nuevos items
    const itemsWithPromotionId = items.map(item => ({
      ...item,
      promotion_id: id
    }));

    const { error: itemsError } = await supabase
      .from('promotion_items')
      .insert(itemsWithPromotionId);

    if (itemsError) {
      console.error('Error updating promotion items:', itemsError);
      return null;
    }
  }

  return await fetchPromotionById(id);
}

export async function deletePromotion(id: number): Promise<boolean> {
  const { error } = await supabase
    .from('promotions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting promotion:', error);
    return false;
  }

  return true;
}

export async function checkPromotionStock(promotionId: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_promotion_stock', {
    promotion_id_param: promotionId
  });

  if (error) {
    console.error('Error checking promotion stock:', error);
    return false;
  }

  return data;
}

export async function sellPromotion(promotion: Promotion, quantity: number = 1): Promise<PromotionSale | null> {
  // Verificar stock
  const hasStock = await checkPromotionStock(promotion.id);
  if (!hasStock) {
    throw new Error('Stock insuficiente para esta promoción');
  }

  // Calcular total e costo
  const total = promotion.price * quantity;
  const cost = promotion.cost * quantity;

  // Crear registro de venta
  const saleData = {
    promotion_id: promotion.id,
    promotion_name: promotion.name,
    quantity,
    total,
    cost,
    date: new Date().toLocaleString('es-ES'),
  };

  const { data: saleResult, error: saleError } = await supabase
    .from('promotion_sales')
    .insert([saleData])
    .select();

  if (saleError || !saleResult?.[0]) {
    console.error('Error recording promotion sale:', saleError);
    return null;
  }

  // Decrementar stock usando la función de Supabase
  const { error: stockError } = await supabase.rpc('decrement_promotion_stock', {
    promotion_id_param: promotion.id,
    quantity_param: quantity
  });

  if (stockError) {
    console.error('Error decrementing stock:', stockError);
    // Aquí podrías implementar rollback si es necesario
  }

  return saleResult[0];
}

export async function fetchPromotionSales(): Promise<PromotionSale[]> {
  const { data, error } = await supabase
    .from('promotion_sales')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching promotion sales:', error);
    return [];
  }

  return data || [];
}

export async function deleteProduct(id: number): Promise<boolean> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting product:', error);
    return false;
  }

  return true;
}

// SALES
export async function fetchSales(): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching sales:', error);
    return [];
  }

  return data || [];
}

export async function addSale(sale: Omit<Sale, 'id' | 'created_at'>): Promise<Sale | null> {
  const { data, error } = await supabase
    .from('sales')
    .insert([sale])
    .select();

  if (error) {
    console.error('Error adding sale:', error);
    return null;
  }

  return data?.[0] || null;
}

export async function deleteSale(id: number): Promise<boolean> {
  const { error } = await supabase
    .from('sales')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting sale:', error);
    return false;
  }

  return true;
}

export async function deletePromotionSale(id: number): Promise<boolean> {
  const { error } = await supabase
    .from('promotion_sales')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting promotion sale:', error);
    return false;
  }

  return true;
}
