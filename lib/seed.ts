import { addDaysISO, toISODate } from './calc'
import { DEFAULT_SETTINGS, type Batch, type Movement, type Persisted, type Product } from './types'

type SeedBatch = [qty: number, expiryInDays: number | null]
type SeedProduct = {
  name: string
  sku: string
  category: string
  unit: string
  reorder: number
  usage: number
  cost: number
  supplier: string
  tracksExpiry?: boolean
  batches: SeedBatch[]
}

const SEED: SeedProduct[] = [
  { name: 'Chicken Sausage', sku: 'CS-1001', category: 'Meat & Poultry', unit: 'packs', reorder: 120, usage: 18, cost: 3.8, supplier: 'Farmhouse Meats', batches: [[40, 9]] },
  { name: 'Strawberry Yogurt', sku: 'YG-2001', category: 'Dairy', unit: 'units', reorder: 60, usage: 12, cost: 0.9, supplier: 'Valley Dairy Co.', batches: [[40, 2], [90, 21]] },
  { name: 'Chocolate Milk', sku: 'MK-2002', category: 'Dairy', unit: 'bottles', reorder: 150, usage: 20, cost: 1.2, supplier: 'Valley Dairy Co.', batches: [[110, 12]] },
  { name: 'Fresh Milk', sku: 'MK-2001', category: 'Dairy', unit: 'L', reorder: 200, usage: 40, cost: 0.95, supplier: 'Valley Dairy Co.', batches: [[180, 8], [220, 14]] },
  { name: 'Butter', sku: 'BT-3001', category: 'Dairy', unit: 'kg', reorder: 40, usage: 6, cost: 7.5, supplier: 'Valley Dairy Co.', batches: [[55, 35], [30, 60]] },
  { name: 'Cheddar Cheese', sku: 'CH-3002', category: 'Dairy', unit: 'kg', reorder: 50, usage: 7, cost: 9.2, supplier: 'Alpine Creamery', batches: [[90, 75]] },
  { name: 'Orange Juice', sku: 'JC-4001', category: 'Beverages', unit: 'L', reorder: 120, usage: 25, cost: 1.75, supplier: 'SunGrove Beverages', batches: [[260, 40]] },
  { name: 'Bread', sku: 'BR-5001', category: 'Bakery', unit: 'units', reorder: 80, usage: 45, cost: 1.1, supplier: 'Daily Loaf Bakery', batches: [[150, 8]] },
  { name: 'Frozen Chicken', sku: 'FC-6001', category: 'Frozen', unit: 'kg', reorder: 150, usage: 30, cost: 5.4, supplier: 'Farmhouse Meats', batches: [[300, 120], [200, 150]] },
  { name: 'Cooking Oil', sku: 'OL-7001', category: 'Pantry', unit: 'L', reorder: 100, usage: 15, cost: 2.6, supplier: 'GoldenPress Oils', tracksExpiry: true, batches: [[130, 200]] },
  { name: 'Mozzarella', sku: 'CH-3003', category: 'Dairy', unit: 'kg', reorder: 40, usage: 8, cost: 8.1, supplier: 'Alpine Creamery', batches: [[30, 28], [60, 45]] },
  { name: 'Greek Yogurt', sku: 'YG-2002', category: 'Dairy', unit: 'units', reorder: 50, usage: 10, cost: 1.3, supplier: 'Valley Dairy Co.', batches: [[20, 9], [100, 22]] },
  { name: 'Eggs', sku: 'EG-8001', category: 'Dairy', unit: 'trays', reorder: 30, usage: 12, cost: 4.2, supplier: 'Sunrise Farms', batches: [[100, 18]] },
  { name: 'Pork Sausage', sku: 'CS-1002', category: 'Meat & Poultry', unit: 'packs', reorder: 80, usage: 14, cost: 3.6, supplier: 'Farmhouse Meats', batches: [[200, 10]] },
  { name: 'Beef Patties', sku: 'BP-1003', category: 'Meat & Poultry', unit: 'packs', reorder: 60, usage: 10, cost: 6.8, supplier: 'Prime Cuts Ltd', batches: [[120, 14]] },
  { name: 'Apple Juice', sku: 'JC-4002', category: 'Beverages', unit: 'L', reorder: 100, usage: 18, cost: 1.6, supplier: 'SunGrove Beverages', batches: [[180, 55]] },
  { name: 'Sparkling Water', sku: 'WT-4003', category: 'Beverages', unit: 'cases', reorder: 40, usage: 6, cost: 8.9, supplier: 'SunGrove Beverages', batches: [[48, 300]] },
  { name: 'Whole Wheat Bread', sku: 'BR-5002', category: 'Bakery', unit: 'units', reorder: 50, usage: 20, cost: 1.6, supplier: 'Daily Loaf Bakery', batches: [[120, 10]] },
  { name: 'Cream Cheese', sku: 'CH-3004', category: 'Dairy', unit: 'kg', reorder: 25, usage: 3, cost: 6.4, supplier: 'Alpine Creamery', batches: [[60, 40]] },
  { name: 'Vanilla Ice Cream', sku: 'IC-6002', category: 'Frozen', unit: 'L', reorder: 80, usage: 10, cost: 4.3, supplier: 'Arctic Treats', batches: [[110, 90]] },
  { name: 'Margarine', sku: 'MG-3005', category: 'Dairy', unit: 'kg', reorder: 30, usage: 4, cost: 3.9, supplier: 'Valley Dairy Co.', batches: [[110, 70]] },
  { name: 'Granulated Sugar', sku: 'SG-7002', category: 'Pantry', unit: 'kg', reorder: 200, usage: 35, cost: 0.85, supplier: 'Harvest Staples', tracksExpiry: false, batches: [[900, null]] },
  { name: 'Wheat Flour', sku: 'FL-7003', category: 'Pantry', unit: 'kg', reorder: 250, usage: 60, cost: 0.7, supplier: 'Harvest Staples', tracksExpiry: true, batches: [[700, 240]] },
  { name: 'Tomato Sauce', sku: 'TS-7004', category: 'Pantry', unit: 'cans', reorder: 120, usage: 22, cost: 1.05, supplier: 'Harvest Staples', tracksExpiry: true, batches: [[400, 300]] },
]

export function buildSeed(now = new Date()): Persisted {
  const products: Product[] = []
  const batches: Batch[] = []
  const movements: Movement[] = []
  const hour = 3_600_000

  SEED.forEach((s, i) => {
    const id = `p-${i + 1}`
    const created = new Date(now.getTime() - (40 + i) * 24 * hour).toISOString()
    products.push({
      id,
      name: s.name,
      sku: s.sku,
      category: s.category,
      unit: s.unit,
      reorderPoint: s.reorder,
      dailyUsage: s.usage,
      unitCost: s.cost,
      supplier: s.supplier,
      tracksExpiry: s.tracksExpiry ?? s.category !== 'Pantry',
      createdAt: created,
      updatedAt: new Date(now.getTime() - (2 + ((i * 7) % 40)) * hour).toISOString(),
    })
    let total = 0
    s.batches.forEach(([qty, exp], j) => {
      total += qty
      batches.push({
        id: `b-${i + 1}-${j + 1}`,
        productId: id,
        batchNumber: `L${toISODate(new Date(now.getTime() - (6 + j * 9) * 24 * hour)).slice(5).replace('-', '')}-${s.sku.replace('-', '')}`,
        quantity: qty,
        receivedQty: qty + Math.round(qty * 0.4),
        expiryDate: exp === null ? null : addDaysISO(exp, now),
        receivedAt: new Date(now.getTime() - (6 + j * 9) * 24 * hour).toISOString(),
        supplier: s.supplier,
        dispatchPriority: false,
      })
    })

    // Walk history backwards so previous/new stock chain is consistent with current stock.
    const first = batches.find((b) => b.productId === id)
    const label = first?.batchNumber ?? ''
    const steps: { type: 'in' | 'out'; qty: number; reason: string; hoursAgo: number }[] = [
      { type: 'out', qty: Math.max(1, Math.round(s.usage * (1 + (i % 3) * 0.3))), reason: i % 2 ? 'Production use' : 'Customer dispatch', hoursAgo: 2 + ((i * 7) % 40) },
      { type: 'in', qty: Math.max(1, Math.round(total * 0.45)), reason: 'Supplier delivery', hoursAgo: 40 + ((i * 11) % 30) },
      { type: 'out', qty: Math.max(1, Math.round(s.usage * 1.5)), reason: 'Customer dispatch', hoursAgo: 80 + ((i * 5) % 30) },
    ]
    let level = total
    steps.forEach((st, k) => {
      const newStock = level
      const previous = st.type === 'out' ? level + st.qty : Math.max(0, level - st.qty)
      const qty = st.type === 'out' ? st.qty : newStock - previous
      movements.push({
        id: `m-${i + 1}-${k + 1}`,
        type: st.type,
        productId: id,
        productName: s.name,
        sku: s.sku,
        unit: s.unit,
        quantity: qty,
        previousStock: previous,
        newStock,
        batchSummary: label,
        reason: st.reason,
        note: '',
        createdAt: new Date(now.getTime() - st.hoursAgo * hour).toISOString(),
      })
      level = previous
    })
  })

  movements.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  return {
    data: { products, batches, movements, reorders: [] },
    trash: [],
    settings: DEFAULT_SETTINGS,
    seededOn: toISODate(now),
    dirty: false,
  }
}
