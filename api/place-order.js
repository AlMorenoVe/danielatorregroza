import { createClient } from '@supabase/supabase-js';

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const supabaseUrl = process.env.SB_URL;
  const supabaseServiceRoleKey = process.env.SB_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return res.status(500).json({ error: 'Error de configuración del servidor. Faltan claves.' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { orderDetails, products: currentProducts } = req.body;

    if (!orderDetails || !orderDetails.items || orderDetails.items.length === 0) {
      return res.status(400).json({ error: 'Datos de la orden inválidos o vacíos.' });
    }

    // 1. Validar y actualizar stock de forma segura
    // Intentamos realizar updates en paralelo, pero validamos primero la disponibilidad
    for (const item of orderDetails.items) {
        const product = currentProducts.find(p => p.id === item.id);
        if (!product) {
            return res.status(400).json({ error: `Producto con ID ${item.id} no encontrado.` });
        }
        // Si hay stock por variante, la app debería enviar stock correcto.
        // Aquí mantenemos la validación por producto general.
        if ((product.stock || 0) < item.qty) {
            return res.status(400).json({ error: `No hay suficiente stock para ${product.name}. Stock disponible: ${product.stock || 0}` });
        }
    }

    // Realizar las actualizaciones
    const updates = orderDetails.items.map(item => {
        const product = currentProducts.find(p => p.id === item.id);
        const newStock = (product.stock || 0) - item.qty;
        return supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', item.id)
            .select();
    });

    const updateResults = await Promise.all(updates);

    for (const result of updateResults) {
        if (result.error) {
            throw new Error('Error al actualizar el stock: ' + result.error.message);
        }
    }

    // 2. Guardar el pedido en la tabla 'orders'
    // Aseguramos que los items incluyan size y color por cada unidad tal como lo envía el front
    const orderData = {
        customer_name: orderDetails.name,
        customer_address: orderDetails.address,
        payment_method: orderDetails.payment,
        total_amount: orderDetails.total,
        order_items: orderDetails.items,
        order_status: 'Pendiente',
        created_at: new Date().toISOString()
    };

    const { data: insertedOrder, error: orderError } = await supabase.from('orders').insert([orderData]).select();

    if (orderError) {
        throw new Error('Error al guardar el pedido: ' + orderError.message);
    }

    // 3. También registramos una fila inicial en orders_confirmed para facilitar flujos que lo requieran
    // (puede usarse para integraciones externas que consulten orders_confirmed)
    const confirmedData = {
        order_id: insertedOrder && insertedOrder[0] && insertedOrder[0].id ? insertedOrder[0].id : null,
        customer_name: orderDetails.name,
        total_amount: orderDetails.total,
        order_items: orderDetails.items,
        confirmed_at: null,
        created_at: new Date().toISOString()
    };

    const { error: confirmedError } = await supabase.from('orders_confirmed').insert([confirmedData]);

    if (confirmedError) {
        // no bloqueamos el flujo por este insert, solo logueamos (pero devolvemos warning)
        console.warn('Advertencia: no se pudo insertar en orders_confirmed:', confirmedError.message);
    }

    res.status(200).json({ success: true, message: 'Orden procesada con éxito.' });

  } catch (error) {
    console.error('Error en la API de orden:', error.message || error);
    res.status(500).json({ error: error.message || String(error) });
  }
};