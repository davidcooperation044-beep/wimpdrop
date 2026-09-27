import { cjRequest, db, handleOptions, json, requireAdmin } from '../_shared/cj.ts';

const LOW_STOCK_THRESHOLD = Number(Deno.env.get('LOW_STOCK_THRESHOLD') || '10');

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseJsonList(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getOrderItemLines(order: any): any[] {
  const lines: any[] = [];
  for (const candidate of [order?.items, order?.order_items]) {
    lines.push(...parseJsonList(candidate));
  }
  return lines;
}

function makeChartSeries(days: number): { date: string; value: number }[] {
  const end = new Date();
  const series: { date: string; value: number }[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const day = new Date(end);
    day.setDate(day.getDate() - index);
    const iso = day.toISOString().slice(0, 10);
    series.push({ date: iso, value: 0 });
  }
  return series;
}

function formatProductName(item: any): string {
  return String(item?.product_name || item?.name || item?.title || item?.productTitle || 'Unnamed product');
}

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;

  try {
    await requireAdmin(request);

    const body = await request.json().catch(() => ({}));
    const days = Math.max(1, Number(body?.days ?? 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [ordersResult, productsResult, syncResult, balanceResult] = await Promise.all([
      db
        .from('orders')
        .select('id, created_at, status, total_amount, fulfillment_status, items, order_items')
        .gte('created_at', since)
        .in('status', ['paid', 'fulfilled', 'shipped', 'delivered', 'processing']),
      db
        .from('products')
        .select('id, name, title, stock_quantity, supplier, sync_status')
        .order('stock_quantity', { ascending: true })
        .limit(200),
      db
        .from('supplier_sync_runs')
        .select('finished_at')
        .eq('supplier', 'cj')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      cjRequest('/shopping/pay/getBalance')
    ]);

    if (ordersResult.error) throw ordersResult.error;
    if (productsResult.error) throw productsResult.error;
    if (syncResult.error) throw syncResult.error;
    if (balanceResult?.error) throw balanceResult.error;

    const orders = ordersResult.data || [];
    const products = productsResult.data || [];
    const series = makeChartSeries(days);
    const chartMap = new Map<string, number>();
    const productRevenue = new Map<string, { revenue: number; units: number }>();
    const totalRevenue = orders.reduce((sum, order) => {
      const amount = asNumber(order?.total_amount);
      return sum + amount;
    }, 0);

    let orderCount = 0;
    let shippedOrDelivered = 0;
    let fulfillmentFailed = 0;
    const statusBreakdown: Record<string, number> = { paid: 0, fulfilled: 0, shipped: 0, delivered: 0, processing: 0, fulfillment_failed: 0 };

    for (const order of orders) {
      const status = String(order?.status || '').toLowerCase();
      const fulfillmentStatus = String(order?.fulfillment_status || '').toLowerCase();

      if (['paid', 'fulfilled', 'shipped', 'delivered'].includes(status)) {
        orderCount += 1;
        const key = new Date(order.created_at).toISOString().slice(0, 10);
        const currentValue = chartMap.get(key) || 0;
        chartMap.set(key, currentValue + asNumber(order.total_amount));

        if (status === 'fulfilled' || status === 'shipped' || status === 'delivered') {
          shippedOrDelivered += 1;
        }

        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      }

      if (fulfillmentStatus === 'fulfillment_failed') {
        fulfillmentFailed += 1;
        statusBreakdown.fulfillment_failed = (statusBreakdown.fulfillment_failed || 0) + 1;
      }

      for (const item of getOrderItemLines(order)) {
        const name = formatProductName(item);
        const units = Math.max(1, Number(item?.quantity || item?.qty || 1));
        const revenue = asNumber(item?.total_amount ?? item?.price ?? item?.amount) * units;
        const entry = productRevenue.get(name) || { revenue: 0, units: 0 };
        entry.revenue += revenue;
        entry.units += units;
        productRevenue.set(name, entry);
      }
    }

    series.forEach((point) => {
      const normalized = chartMap.get(point.date) || 0;
      point.value = normalized;
    });

    const topProducts = [...productRevenue.entries()]
      .map(([name, detail]) => ({ name, revenue: detail.revenue, units: detail.units }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const lowStock = (products || [])
      .filter((product) => Number(product?.stock_quantity ?? 0) <= LOW_STOCK_THRESHOLD)
      .slice(0, 5)
      .map((product) => ({
        name: String(product?.name || product?.title || 'Unnamed product'),
        stock: Number(product?.stock_quantity ?? 0)
      }));

    const cjBalance = Number(balanceResult?.data?.amount ?? 0);
    const outOfSync = (products || []).filter((product) => product?.supplier === 'cj' && String(product?.sync_status || '').toLowerCase() !== 'success').length;
    const lastSync = syncResult?.data?.finished_at || null;

    return json({
      success: true,
      revenue: totalRevenue,
      orderCount,
      averageOrderValue: orderCount ? totalRevenue / orderCount : 0,
      shippedOrDelivered,
      chart: series,
      topProducts,
      lowStock,
      cjBalance,
      failureCount: fulfillmentFailed,
      outOfSync,
      lastSync,
      statusBreakdown
    }, 200);
  } catch (error) {
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
