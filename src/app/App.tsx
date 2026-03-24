import { useState, useEffect } from 'react';
import { Plus, ShoppingCart, Package, Trash2, Edit2, DollarSign, Gift, TrendingUp, BarChart3, LogOut, User as UserIcon, Users } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import {
  fetchProducts,
  addProduct as dbAddProduct,
  updateProduct as dbUpdateProduct,
  deleteProduct as dbDeleteProduct,
  fetchSales,
  addSale as dbAddSale,
  deleteSale as dbDeleteSale,
  deletePromotionSale as dbDeletePromotionSale,
  calculateMargin,
  fetchPromotions,
  addPromotion as dbAddPromotion,
  updatePromotion as dbUpdatePromotion,
  deletePromotion as dbDeletePromotion,
  sellPromotion as dbSellPromotion,
  fetchPromotionSales,
  type Product,
  type Sale,
  type Promotion,
  type PromotionItem,
  type PromotionSale,
  type User as UserModel
} from '../config/database';
import { useTheme } from '../hooks/useTheme';
import { ThemeToggle } from '../components/ThemeToggle';
import { UserManagement } from '../components/UserManagement';

interface AppProps {
  user: UserModel;
  onLogout: () => void;
  onUserUpdated?: (u: UserModel) => void;
}

export default function App({ user, onLogout, onUserUpdated }: AppProps) {
  const { theme } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promotionSales, setPromotionSales] = useState<PromotionSale[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'promotions' | 'sales' | 'summary' | 'users'>('products');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dashboard state
  const [dailyStats, setDailyStats] = useState<{ date: string; revenue: number; profit: number; sales: number }[]>([]);
  const [mostSoldProducts, setMostSoldProducts] = useState<{ name: string; quantity: number; revenue: number }[]>([]);
  const [totalProfit, setTotalProfit] = useState(0);
  const [profitMargin, setProfitMargin] = useState(0);

  // Form states
  const [newProduct, setNewProduct] = useState({ name: '', price: '', cost: '', stock: '' });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saleForm, setSaleForm] = useState({ productId: '', quantity: '' });
  
  // Promotion form states
  const [newPromotion, setNewPromotion] = useState({ 
    name: '', 
    description: '', 
    price: '', 
    cost: '' 
  });
  const [promotionItems, setPromotionItems] = useState<{ productId: string; quantity: string }[]>([]);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [promotionSaleForm, setPromotionSaleForm] = useState({ promotionId: '', quantity: '' });

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (user.role !== 'admin' && activeTab === 'users') {
      setActiveTab('products');
    }
  }, [user.role, activeTab]);

  // Recalcular dashboard cuando cambien ventas o promociones
  useEffect(() => {
    if (sales.length > 0 || promotionSales.length > 0 || promotions.length > 0) {
      calculateDashboardData(products, sales, promotionSales, promotions);
    }
  }, [sales, promotionSales, promotions, products]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [productsData, salesData, promotionsData, promotionSalesData] = await Promise.all([
        fetchProducts(),
        fetchSales(),
        fetchPromotions(),
        fetchPromotionSales()
      ]);
      setProducts(productsData);
      setSales(salesData);
      setPromotions(promotionsData);
      setPromotionSales(promotionSalesData);
      
      // Calculate dashboard data
      calculateDashboardData(productsData, salesData, promotionSalesData, promotionsData);
    } catch (err) {
      setError('Error cargando datos. Verifica tu conexión a Supabase.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const calculateDashboardData = (products: Product[], sales: Sale[], promotionSales: PromotionSale[], promotions: Promotion[]) => {
    // Calculate daily stats
    const dailyMap = new Map<string, { revenue: number; profit: number; sales: number }>();
    
    // Process regular sales
    sales.forEach(sale => {
      if (!sale.total || isNaN(sale.total)) return;
      
      const revenue = Number(sale.total);
      const cost = Number(sale.cost) || 0;
      const profit = revenue - cost;
      
      if (!dailyMap.has(sale.date)) {
        dailyMap.set(sale.date, { revenue: 0, profit: 0, sales: 0 });
      }
      const day = dailyMap.get(sale.date)!;
      day.revenue += revenue;
      day.profit += profit;
      day.sales += Number(sale.quantity);
    });
    
    // Process promotion sales
    promotionSales.forEach(sale => {
      if (!sale.total || isNaN(sale.total)) return;
      
      const revenue = Number(sale.total);
      const cost = sale.cost && !isNaN(sale.cost) ? Number(sale.cost) : 0;
      const profit = revenue - cost;
      
      if (!dailyMap.has(sale.date)) {
        dailyMap.set(sale.date, { revenue: 0, profit: 0, sales: 0 });
      }
      const day = dailyMap.get(sale.date)!;
      day.revenue += revenue;
      day.profit += profit;
      day.sales += Number(sale.quantity);
    });
    
    const dailyStatsArray = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    setDailyStats(dailyStatsArray);
    
    // Calculate most sold products
    const productSalesMap = new Map<string, { quantity: number; revenue: number }>();
    
    sales.forEach(sale => {
      const product = products.find(p => p.id === sale.product_id);
      if (!product || !sale.total || isNaN(sale.total)) return;
      
      if (!productSalesMap.has(product.name)) {
        productSalesMap.set(product.name, { quantity: 0, revenue: 0 });
      }
      const data = productSalesMap.get(product.name)!;
      data.quantity += Number(sale.quantity);
      data.revenue += Number(sale.total);
    });
    
    const mostSoldArray = Array.from(productSalesMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
    
    setMostSoldProducts(mostSoldArray);
    
    // Calculate total profit and margin
    const totalRevenue = sales.reduce((sum, sale) => {
      return sum + (sale.total && !isNaN(sale.total) ? Number(sale.total) : 0);
    }, 0) + promotionSales.reduce((sum, sale) => {
      return sum + (sale.total && !isNaN(sale.total) ? Number(sale.total) : 0);
    }, 0);
    
    const totalCost = sales.reduce((sum, sale) => {
      return sum + (Number(sale.cost) || 0);
    }, 0) + promotionSales.reduce((sum, sale) => {
      return sum + (Number(sale.cost) || 0);
    }, 0);
    
    const profit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
    
    setTotalProfit(isNaN(profit) ? 0 : profit);
    setProfitMargin(isNaN(margin) ? 0 : margin);
  };

  const addProduct = async () => {
    if (!newProduct.name || !newProduct.price || !newProduct.cost || !newProduct.stock) return;

    const product = {
      name: newProduct.name,
      price: parseFloat(newProduct.price),
      cost: parseFloat(newProduct.cost),
      stock: parseInt(newProduct.stock),
    };

    const result = await dbAddProduct(product);
    if (result) {
      setProducts([result, ...products]);
      setNewProduct({ name: '', price: '', cost: '', stock: '' });
    } else {
      setError('Error al agregar el producto');
    }
  };

  const updateProduct = async () => {
    if (!editingProduct) return;

    const result = await dbUpdateProduct(editingProduct.id, {
      name: editingProduct.name,
      price: editingProduct.price,
      cost: editingProduct.cost,
      stock: editingProduct.stock,
    });

    if (result) {
      setProducts(products.map(p => p.id === editingProduct.id ? result : p));
      setEditingProduct(null);
    } else {
      setError('Error al actualizar el producto');
    }
  };

  const deleteProduct = async (id: number) => {
    if (await dbDeleteProduct(id)) {
      setProducts(products.filter(p => p.id !== id));
    } else {
      setError('Error al eliminar el producto');
    }
  };

  const registerSale = async () => {
    if (!saleForm.productId || !saleForm.quantity) return;

    const product = products.find(p => p.id === parseInt(saleForm.productId));
    if (!product) return;

    const quantity = parseInt(saleForm.quantity);
    if (quantity > product.stock) {
      setError('Stock insuficiente');
      return;
    }

    const sale = {
      product_id: product.id,
      product_name: product.name,
      quantity,
      total: product.price * quantity,
      cost: product.cost * quantity,
      date: new Date().toLocaleString('es-ES'),
    };

    const result = await dbAddSale(sale);
    if (result) {
      setSales([result, ...sales]);
      
      // Update product stock
      const updatedProduct = await dbUpdateProduct(product.id, {
        stock: product.stock - quantity
      });
      
      if (updatedProduct) {
        setProducts(products.map(p => p.id === product.id ? updatedProduct : p));
      }
      
      setSaleForm({ productId: '', quantity: '' });
      setError(null);
    } else {
      setError('Error al registrar la venta');
    }
  };

  const handleDeleteSale = async (saleId: number) => {
    if (!window.confirm('¿Estás seguro que quieres eliminar esta venta?')) return;

    const success = await dbDeleteSale(saleId);
    if (success) {
      setSales(sales.filter(s => s.id !== saleId));
      setError(null);
    } else {
      setError('Error al eliminar la venta');
    }
  };

  const handleDeletePromotionSale = async (saleId: number) => {
    if (!window.confirm('¿Estás seguro que quieres eliminar esta venta de promoción?')) return;

    const success = await dbDeletePromotionSale(saleId);
    if (success) {
      setPromotionSales(promotionSales.filter(s => s.id !== saleId));
      setError(null);
    } else {
      setError('Error al eliminar la venta de promoción');
    }
  };

  // Promotion functions
  const addPromotion = async () => {
    if (!newPromotion.name || !newPromotion.price || promotionItems.length === 0) {
      setError('Nombre, precio y al menos un producto son requeridos');
      return;
    }

    const items = promotionItems.map(item => ({
      product_id: parseInt(item.productId),
      quantity: parseInt(item.quantity)
    }));

    // Calcular costo automáticamente basado en los productos
    const calculatedCost = promotionItems.reduce((sum, item) => {
      const product = products.find(p => p.id === parseInt(item.productId));
      return sum + (product ? product.cost * parseInt(item.quantity || 0) : 0);
    }, 0);

    const promotion = {
      name: newPromotion.name,
      description: newPromotion.description,
      price: parseFloat(newPromotion.price),
      cost: calculatedCost,
      is_active: true,
    };

    const result = await dbAddPromotion(promotion, items);
    if (result) {
      setPromotions([result, ...promotions]);
      setNewPromotion({ name: '', description: '', price: '', cost: '' });
      setPromotionItems([]);
    } else {
      setError('Error al crear la promoción');
    }
  };

  const updatePromotion = async () => {
    if (!editingPromotion) return;

    const items = promotionItems.map(item => ({
      product_id: parseInt(item.productId),
      quantity: parseInt(item.quantity)
    }));

    // Calcular costo automáticamente basado en los productos
    const calculatedCost = promotionItems.reduce((sum, item) => {
      const product = products.find(p => p.id === parseInt(item.productId));
      return sum + (product ? product.cost * parseInt(item.quantity || 0) : 0);
    }, 0);

    const result = await dbUpdatePromotion(editingPromotion.id, {
      name: editingPromotion.name,
      description: editingPromotion.description,
      price: editingPromotion.price,
      cost: calculatedCost,
      is_active: editingPromotion.is_active,
    }, items);

    if (result) {
      setPromotions(promotions.map(p => p.id === editingPromotion.id ? result : p));
      setEditingPromotion(null);
      setPromotionItems([]);
    } else {
      setError('Error al actualizar la promoción');
    }
  };

  const deletePromotion = async (id: number) => {
    if (await dbDeletePromotion(id)) {
      setPromotions(promotions.filter(p => p.id !== id));
    } else {
      setError('Error al eliminar la promoción');
    }
  };

  const registerPromotionSale = async () => {
    if (!promotionSaleForm.promotionId || !promotionSaleForm.quantity) return;

    const promotion = promotions.find(p => p.id === parseInt(promotionSaleForm.promotionId));
    if (!promotion) return;

    try {
      const result = await dbSellPromotion(promotion, parseInt(promotionSaleForm.quantity));
      if (result) {
        setPromotionSales([result, ...promotionSales]);
        
        // Reload products to get updated stock
        const updatedProducts = await fetchProducts();
        setProducts(updatedProducts);
        
        setPromotionSaleForm({ promotionId: '', quantity: '' });
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'Error al vender la promoción');
    }
  };

  const addPromotionItem = () => {
    setPromotionItems([...promotionItems, { productId: '', quantity: '1' }]);
  };

  const updatePromotionItem = (index: number, field: 'productId' | 'quantity', value: string) => {
    const updated = [...promotionItems];
    updated[index][field] = value;
    setPromotionItems(updated);
  };

  const removePromotionItem = (index: number) => {
    setPromotionItems(promotionItems.filter((_, i) => i !== index));
  };

  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0) + 
                      promotionSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <ThemeToggle />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header with user info and logout */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl">Gestión de ventas</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm sm:text-base">
              <UserIcon className="w-4 h-4" />
              <span className="text-gray-600 dark:text-gray-400">{user.username}</span>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm sm:text-base"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-6">
            {error}
            <button 
              onClick={() => setError(null)}
              className="float-right text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100"
            >
              ×
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-8">
            <p className="text-gray-600">Cargando datos...</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Tabs */}
            <div className="flex gap-2 sm:gap-4 mb-8 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
              <button
                onClick={() => setActiveTab('products')}
                className={`px-3 sm:px-6 py-3 flex items-center gap-1 sm:gap-2 transition-colors border-b-2 whitespace-nowrap text-sm sm:text-base ${
                  activeTab === 'products'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <Package size={18} className="hidden sm:block" />
                <Package size={16} className="sm:hidden" />
                <span>Productos</span>
              </button>
              <button
                onClick={() => setActiveTab('promotions')}
                className={`px-3 sm:px-6 py-3 flex items-center gap-1 sm:gap-2 transition-colors border-b-2 whitespace-nowrap text-sm sm:text-base ${
                  activeTab === 'promotions'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <Gift size={18} className="hidden sm:block" />
                <Gift size={16} className="sm:hidden" />
                <span>Promos</span>
              </button>
              <button
                onClick={() => setActiveTab('sales')}
                className={`px-3 sm:px-6 py-3 flex items-center gap-1 sm:gap-2 transition-colors border-b-2 whitespace-nowrap text-sm sm:text-base ${
                  activeTab === 'sales'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <ShoppingCart size={18} className="hidden sm:block" />
                <ShoppingCart size={16} className="sm:hidden" />
                <span>Ventas</span>
              </button>
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-3 sm:px-6 py-3 flex items-center gap-1 sm:gap-2 transition-colors border-b-2 whitespace-nowrap text-sm sm:text-base ${
                  activeTab === 'summary'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <DollarSign size={18} className="hidden sm:block" />
                <DollarSign size={16} className="sm:hidden" />
                <span>Resumen</span>
              </button>
              {user.role === 'admin' && (
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-3 sm:px-6 py-3 flex items-center gap-1 sm:gap-2 transition-colors border-b-2 whitespace-nowrap text-sm sm:text-base ${
                    activeTab === 'users'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  <Users size={18} className="hidden sm:block" />
                  <Users size={16} className="sm:hidden" />
                  <span>Usuarios</span>
                </button>
              )}
            </div>

            {/* Products Tab */}
            {activeTab === 'products' && (
              <div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 mb-6">
                  <h2 className="text-xl sm:text-2xl mb-4">
                    {editingProduct ? 'Editar Producto' : 'Agregar Producto'}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                    <input
                      type="text"
                      placeholder="Nombre del producto"
                      value={editingProduct ? editingProduct.name : newProduct.name}
                      onChange={(e) => editingProduct
                        ? setEditingProduct({ ...editingProduct, name: e.target.value })
                        : setNewProduct({ ...newProduct, name: e.target.value })
                      }
                      className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base"
                    />
                    <input
                      type="number"
                      placeholder="Precio"
                      step="0.01"
                      value={editingProduct ? editingProduct.price : newProduct.price}
                      onChange={(e) => editingProduct
                        ? setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })
                        : setNewProduct({ ...newProduct, price: e.target.value })
                      }
                      className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base"
                    />
                    <input
                      type="number"
                      placeholder="Costo"
                      step="0.01"
                      value={editingProduct ? editingProduct.cost : newProduct.cost}
                      onChange={(e) => editingProduct
                        ? setEditingProduct({ ...editingProduct, cost: parseFloat(e.target.value) })
                        : setNewProduct({ ...newProduct, cost: e.target.value })
                      }
                      className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base"
                    />
                    <input
                      type="number"
                      placeholder="Stock"
                      value={editingProduct ? editingProduct.stock : newProduct.stock}
                      onChange={(e) => editingProduct
                        ? setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) })
                        : setNewProduct({ ...newProduct, stock: e.target.value })
                      }
                      className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base"
                    />
                    <button
                      onClick={editingProduct ? updateProduct : addProduct}
                      className="bg-blue-500 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      {editingProduct ? (
                        <>
                          <Edit2 size={18} />
                          <span className="hidden sm:inline">Actualizar</span>
                          <span className="sm:hidden">Editar</span>
                        </>
                      ) : (
                        <>
                          <Plus size={18} />
                          <span className="hidden sm:inline">Agregar</span>
                          <span className="sm:hidden">Añadir</span>
                        </>
                      )}
                    </button>
                  </div>
                  {editingProduct && (
                    <button
                      onClick={() => setEditingProduct(null)}
                      className="mt-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-sm"
                    >
                      Cancelar edición
                    </button>
                  )}
                </div>

                {/* Products Table - Responsive */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                  <table className="w-full text-sm sm:text-base">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold">Producto</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold hidden sm:table-cell">Costo</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold hidden sm:table-cell">Precio</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold hidden lg:table-cell">Margen (%)</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold">Stock</th>
                        <th className="px-3 sm:px-6 py-3 text-center text-gray-900 dark:text-gray-100 font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id} className="border-t border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-3 sm:px-6 py-4 text-gray-900 dark:text-gray-100">
                            <div className="font-medium">{product.name}</div>
                            <div className="text-xs sm:hidden text-gray-600 dark:text-gray-400">
                              ${product.price.toFixed(2)} | Costo: ${product.cost.toFixed(2)}
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-gray-900 dark:text-gray-100 hidden sm:table-cell">${product.cost.toFixed(2)}</td>
                          <td className="px-3 sm:px-6 py-4 text-gray-900 dark:text-gray-100 hidden sm:table-cell">${product.price.toFixed(2)}</td>
                          <td className="px-3 sm:px-6 py-4 hidden lg:table-cell">
                            <span className={`font-semibold text-sm ${
                              calculateMargin(product.price, product.cost) > 0 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {calculateMargin(product.price, product.cost).toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-4">
                            <span className={`font-medium ${product.stock < 10 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                              {product.stock}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-4">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => setEditingProduct(product)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-1"
                              >
                                <Edit2 size={16} className="sm:w-18" />
                              </button>
                              <button
                                onClick={() => deleteProduct(product.id)}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1"
                              >
                                <Trash2 size={16} className="sm:w-18" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Promotions Tab */}
            {activeTab === 'promotions' && (
              <div>
                {/* Promotions List */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto mb-6">
                  <table className="w-full text-sm sm:text-base">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold">Promoción</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold hidden sm:table-cell">Precio</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold hidden md:table-cell">Productos</th>
                        <th className="px-3 sm:px-6 py-3 text-center text-gray-900 dark:text-gray-100 font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promotions.map((promotion) => (
                        <tr
                          key={promotion.id}
                          onClick={() => setPromotionSaleForm({ ...promotionSaleForm, promotionId: promotion.id.toString() })}
                          className="cursor-pointer border-t border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <td className="px-3 sm:px-6 py-4">
                            <div className="text-gray-900 dark:text-gray-100 font-semibold text-sm sm:text-base">{promotion.name}</div>
                            {promotion.description && (
                              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{promotion.description}</div>
                            )}
                            <div className="text-xs sm:hidden text-gray-600 dark:text-gray-400 mt-1">
                              ${promotion.price.toFixed(2)}
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-gray-900 dark:text-gray-100 hidden sm:table-cell">${promotion.price.toFixed(2)}</td>
                          <td className="px-3 sm:px-6 py-4 hidden md:table-cell">
                            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                              {promotion.items?.map((item, index) => (
                                <div key={index}>
                                  {item.quantity}x {item.product?.name}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-4">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPromotion(promotion);
                                  setPromotionItems(
                                    promotion.items?.map(item => ({
                                      productId: item.product_id.toString(),
                                      quantity: item.quantity.toString()
                                    })) || []
                                  );
                                }}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-1"
                              >
                                <Edit2 size={16} className="sm:w-18" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deletePromotion(promotion.id);
                                }}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1"
                              >
                                <Trash2 size={16} className="sm:w-18" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Create/Edit Promotion */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 mb-6">
                  <h2 className="text-xl sm:text-2xl mb-4">
                    {editingPromotion ? 'Editar Promoción' : 'Crear Promoción'}
                  </h2>
                  
                  {/* Promotion Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
                    <input
                      type="text"
                      placeholder="Nombre de la promoción"
                      value={editingPromotion ? editingPromotion.name : newPromotion.name}
                      onChange={(e) => editingPromotion
                        ? setEditingPromotion({ ...editingPromotion, name: e.target.value })
                        : setNewPromotion({ ...newPromotion, name: e.target.value })
                      }
                      className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base"
                    />
                    <input
                      type="number"
                      placeholder="Precio del combo"
                      step="0.01"
                      value={editingPromotion ? editingPromotion.price : newPromotion.price}
                      onChange={(e) => editingPromotion
                        ? setEditingPromotion({ ...editingPromotion, price: parseFloat(e.target.value) })
                        : setNewPromotion({ ...newPromotion, price: e.target.value })
                      }
                      className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base"
                    />
                    <input
                      type="text"
                      placeholder="Descripción (opcional)"
                      value={editingPromotion ? editingPromotion.description : newPromotion.description}
                      onChange={(e) => editingPromotion
                        ? setEditingPromotion({ ...editingPromotion, description: e.target.value })
                        : setNewPromotion({ ...newPromotion, description: e.target.value })
                      }
                      className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base"
                    />
                    <div className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700">
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Costo Total</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                        ${promotionItems.reduce((sum, item) => {
                          const product = products.find(p => p.id === parseInt(item.productId));
                          return sum + (product ? product.cost * parseInt(item.quantity || 0) : 0);
                        }, 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Promotion Items */}
                  <div className="mb-6">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Productos en el combo</h3>
                      <button
                        onClick={addPromotionItem}
                        className="bg-blue-500 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        <Plus size={16} />
                        <span className="hidden sm:inline">Agregar Producto</span>
                        <span className="sm:hidden">Agregar</span>
                      </button>
                    </div>
                    
                    {promotionItems.map((item, index) => (
                      <div key={index} className="flex flex-col sm:flex-row gap-3 sm:gap-2 items-center mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm sm:text-base">
                        <select
                          value={item.productId}
                          onChange={(e) => updatePromotionItem(index, 'productId', e.target.value)}
                          className="w-full sm:flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm sm:text-base"
                        >
                          <option value="">Seleccionar producto</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} (Stock: {product.stock})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Cant."
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updatePromotionItem(index, 'quantity', e.target.value)}
                          className="w-full sm:w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm sm:text-base"
                        />
                        <button
                          onClick={() => removePromotionItem(index)}
                          className="w-full sm:w-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          <Trash2 size={18} className="mx-auto sm:ml-0" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <button
                      onClick={editingPromotion ? updatePromotion : addPromotion}
                      className="bg-green-500 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      {editingPromotion ? (
                        <>
                          <Edit2 size={18} />
                          <span className="hidden sm:inline">Actualizar</span>
                          <span className="sm:hidden">Editar</span>
                        </>
                      ) : (
                        <>
                          <Plus size={18} />
                          <span className="hidden sm:inline">Crear Promoción</span>
                          <span className="sm:hidden">Crear</span>
                        </>
                      )}
                    </button>
                    {editingPromotion && (
                      <button
                        onClick={() => {
                          setEditingPromotion(null);
                          setPromotionItems([]);
                        }}
                        className="bg-gray-500 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors text-sm sm:text-base"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>

                {/* Sell Promotion */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 mb-6">
                  <h2 className="text-xl sm:text-2xl mb-4">Vender Promoción</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <select
                      value={promotionSaleForm.promotionId}
                      onChange={(e) => setPromotionSaleForm({ ...promotionSaleForm, promotionId: e.target.value })}
                      className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base"
                    >
                      <option value="">Seleccionar promoción</option>
                      {promotions.map((promotion) => (
                        <option key={promotion.id} value={promotion.id}>
                          {promotion.name} - ${promotion.price}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Cantidad"
                      min="1"
                      value={promotionSaleForm.quantity}
                      onChange={(e) => setPromotionSaleForm({ ...promotionSaleForm, quantity: e.target.value })}
                      className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base"
                    />
                    <button
                      onClick={registerPromotionSale}
                      className="bg-purple-500 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      <ShoppingCart size={18} />
                      <span className="hidden sm:inline">Vender Promoción</span>
                      <span className="sm:hidden">Vender</span>
                    </button>
                  </div>
                </div>

                {/* Promotion Sales History */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                  <h3 className="text-lg sm:text-xl p-4 sm:p-6 pb-0 text-gray-900 dark:text-gray-100">Historial de Ventas de Promociones</h3>
                  <table className="w-full text-sm sm:text-base">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold">Fecha</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold">Promoción</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold">Cant.</th>
                        <th className="px-3 sm:px-6 py-3 text-right text-gray-900 dark:text-gray-100 font-semibold hidden sm:table-cell">Ingresos</th>
                        <th className="px-3 sm:px-6 py-3 text-right text-gray-900 dark:text-gray-100 font-semibold hidden md:table-cell">Ganancia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promotionSales.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 sm:px-6 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                            No hay ventas de promociones
                          </td>
                        </tr>
                      ) : (
                        promotionSales.map((sale) => {
                          const profit = (Number(sale.total) || 0) - (Number(sale.cost) || 0);
                          return (
                            <tr key={sale.id} className="border-t border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-3 sm:px-6 py-4 text-gray-900 dark:text-gray-100 text-xs sm:text-sm">{sale.date}</td>
                              <td className="px-3 sm:px-6 py-4 text-gray-900 dark:text-gray-100 text-sm">{sale.promotion_name}</td>
                              <td className="px-3 sm:px-6 py-4 text-gray-900 dark:text-gray-100 font-medium">{sale.quantity}</td>
                              <td className="px-3 sm:px-6 py-4 text-right text-gray-900 dark:text-gray-100 hidden sm:table-cell text-sm">${(Number(sale.total) || 0).toFixed(2)}</td>
                              <td className="px-3 sm:px-6 py-4 text-right text-green-600 dark:text-green-400 font-semibold hidden md:table-cell text-sm">${profit.toFixed(2)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sales Tab */}
            {activeTab === 'sales' && (
              <div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 mb-6">
                  <h2 className="text-xl sm:text-2xl mb-4">Registrar Venta</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <select
                      value={saleForm.productId}
                      onChange={(e) => setSaleForm({ ...saleForm, productId: e.target.value })}
                      className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base"
                    >
                      <option value="">Seleccionar producto</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} (Stock: {product.stock})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Cantidad"
                      value={saleForm.quantity}
                      onChange={(e) => setSaleForm({ ...saleForm, quantity: e.target.value })}
                      className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base"
                    />
                    <button
                      onClick={registerSale}
                      className="bg-green-500 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      <ShoppingCart size={18} />
                      <span className="hidden sm:inline">Registrar Venta</span>
                      <span className="sm:hidden">Vender</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                  <table className="w-full text-sm sm:text-base">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold">Fecha</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold hidden sm:table-cell">Tipo</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold">Descripción</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold">Cant.</th>
                        <th className="px-3 sm:px-6 py-3 text-right text-gray-900 dark:text-gray-100 font-semibold hidden sm:table-cell">Ingresos</th>
                        <th className="px-3 sm:px-6 py-3 text-right text-gray-900 dark:text-gray-100 font-semibold hidden md:table-cell">Ganancia</th>
                        <th className="px-3 sm:px-6 py-3 text-center text-gray-900 dark:text-gray-100 font-semibold">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.length === 0 && promotionSales.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 sm:px-6 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                            No hay ventas registradas
                          </td>
                        </tr>
                      ) : (
                        <>
                          {sales.map((sale) => {
                            const profit = (Number(sale.total) || 0) - (Number(sale.cost) || 0);
                            return (
                              <tr key={`product-${sale.id}`} className="border-t border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="px-3 sm:px-6 py-4 text-gray-900 dark:text-gray-100 text-xs sm:text-sm">{sale.date}</td>
                                <td className="px-3 sm:px-6 py-4 hidden sm:table-cell">
                                  <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs font-medium">
                                    Producto
                                  </span>
                                </td>
                                <td className="px-3 sm:px-6 py-4 text-gray-900 dark:text-gray-100 text-sm">{sale.product_name}</td>
                                <td className="px-3 sm:px-6 py-4 text-gray-900 dark:text-gray-100 font-medium">{sale.quantity}</td>
                                <td className="px-3 sm:px-6 py-4 text-right text-gray-900 dark:text-gray-100 hidden sm:table-cell text-sm">${(Number(sale.total) || 0).toFixed(2)}</td>
                                <td className="px-3 sm:px-6 py-4 text-right text-green-600 dark:text-green-400 font-semibold hidden md:table-cell text-sm">${profit.toFixed(2)}</td>
                                <td className="px-3 sm:px-6 py-4 text-center">
                                  <button
                                    onClick={() => handleDeleteSale(sale.id)}
                                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors p-1"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {promotionSales.map((sale) => {
                            const profit = (Number(sale.total) || 0) - (Number(sale.cost) || 0);
                            return (
                              <tr key={`promo-${sale.id}`} className="border-t border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="px-3 sm:px-6 py-4 text-gray-900 dark:text-gray-100 text-xs sm:text-sm">{sale.date}</td>
                                <td className="px-3 sm:px-6 py-4 hidden sm:table-cell">
                                  <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded text-xs font-medium">
                                    Promoción
                                  </span>
                                </td>
                                <td className="px-3 sm:px-6 py-4 text-gray-900 dark:text-gray-100 text-sm">{sale.promotion_name}</td>
                                <td className="px-3 sm:px-6 py-4 text-gray-900 dark:text-gray-100 font-medium">{sale.quantity}</td>
                                <td className="px-3 sm:px-6 py-4 text-right text-gray-900 dark:text-gray-100 hidden sm:table-cell text-sm">${(Number(sale.total) || 0).toFixed(2)}</td>
                                <td className="px-3 sm:px-6 py-4 text-right text-green-600 dark:text-green-400 font-semibold hidden md:table-cell text-sm">${profit.toFixed(2)}</td>
                                <td className="px-3 sm:px-6 py-4 text-center">
                                  <button
                                    onClick={() => handleDeletePromotionSale(sale.id)}
                                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors p-1"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total de Productos</h3>
                      <Package className="text-blue-500" size={20} />
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{totalProducts}</p>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Stock Total</h3>
                      <Package className="text-orange-500" size={20} />
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{totalStock}</p>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Ganancia Total</h3>
                      <TrendingUp className="text-green-500" size={20} />
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">${totalProfit.toFixed(2)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{profitMargin.toFixed(1)}% margen</p>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Ingresos Totales</h3>
                      <DollarSign className="text-green-500" size={20} />
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">${totalRevenue.toFixed(2)}</p>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Daily Revenue Chart */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <BarChart3 size={20} />
                      Ingresos Diarios
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip formatter={(value) => [`$${value}`, 'Ingresos']} />
                        <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Daily Profit Chart */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <TrendingUp size={20} />
                      Ganancias Diarias
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip formatter={(value) => [`$${value}`, 'Ganancia']} />
                        <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Most Sold Products and Low Stock */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Most Sold Products */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg mb-4 text-gray-900 dark:text-gray-100">Productos Más Vendidos</h3>
                    <div className="space-y-2 sm:space-y-3">
                      {mostSoldProducts.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">No hay datos de ventas</p>
                      ) : (
                        mostSoldProducts.map((product, index) => (
                          <div key={product.name} className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded text-sm sm:text-base">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                              <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">#{index + 1}</span>
                              <span className="text-gray-900 dark:text-gray-100 truncate">{product.name}</span>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                              <p className="text-xs sm:text-sm text-gray-900 dark:text-gray-100">{product.quantity} vendidos</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">${product.revenue.toFixed(2)}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Low Stock Alert */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg mb-4 text-gray-900 dark:text-gray-100">Productos con Stock Bajo</h3>
                    <div className="space-y-2">
                      {products.filter(p => p.stock < 10).length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">No hay productos con stock bajo</p>
                      ) : (
                        products
                          .filter(p => p.stock < 10)
                          .map(product => (
                            <div key={product.id} className="flex justify-between items-center p-2 sm:p-3 bg-red-50 dark:bg-red-900/20 rounded text-sm sm:text-base">
                              <span className="text-gray-900 dark:text-gray-100 truncate">{product.name}</span>
                              <span className="text-red-600 dark:text-red-400 font-medium flex-shrink-0 ml-2">Stock: {product.stock}</span>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Sales by Day Table */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg mb-4 text-gray-900 dark:text-gray-100">Estadísticas Diarias</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b dark:border-gray-700">
                          <th className="text-left py-2 px-2 sm:px-3 text-gray-900 dark:text-gray-100 font-semibold">Fecha</th>
                          <th className="text-right py-2 px-2 sm:px-3 text-gray-900 dark:text-gray-100 font-semibold">Ventas</th>
                          <th className="text-right py-2 px-2 sm:px-3 text-gray-900 dark:text-gray-100 font-semibold">Ingresos</th>
                          <th className="text-right py-2 px-2 sm:px-3 text-gray-900 dark:text-gray-100 font-semibold">Ganancia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyStats.slice(-7).reverse().map((day) => (
                          <tr key={day.date} className="border-b dark:border-gray-700">
                            <td className="py-2 px-2 sm:px-3 text-gray-900 dark:text-gray-100">{day.date}</td>
                            <td className="py-2 px-2 sm:px-3 text-right text-gray-900 dark:text-gray-100">{day.sales}</td>
                            <td className="py-2 px-2 sm:px-3 text-right text-gray-900 dark:text-gray-100">${day.revenue.toFixed(2)}</td>
                            <td className="py-2 px-2 sm:px-3 text-right text-gray-900 dark:text-gray-100">${day.profit.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && user.role === 'admin' && (
              <UserManagement currentUserId={user.id} onSessionUserUpdated={onUserUpdated} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
