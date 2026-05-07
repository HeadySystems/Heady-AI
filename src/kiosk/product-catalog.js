/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * HeadyKiosk Cannabis Product Catalog
 * ══════════════════════════════════════════════════════════════
 *
 * Product database for cannabis dispensary kiosks. Manages SKUs,
 * THC/CBD content, pricing, inventory, and category-specific
 * purchase limit tracking per state regulation.
 *
 * Product Categories:
 *   - Flower (by strain: indica, sativa, hybrid)
 *   - Concentrates (wax, shatter, live resin, rosin)
 *   - Edibles (gummies, chocolates, beverages, baked)
 *   - Vaporizers (cartridges, disposables)
 *   - Topicals (creams, balms, patches)
 *   - Tinctures (sublingual drops)
 *   - Pre-rolls (joints, blunts, infused)
 *
 * @module src/kiosk/product-catalog
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PHI = 1.618033988749895;
const CATALOG_PATH = path.resolve(__dirname, '../../data/kiosk-catalog.json');

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORIES = {
  FLOWER:      { id: 'flower',      label: 'Flower',       unit: 'oz',  icon: '🌿', limitField: 'flower_oz' },
  CONCENTRATE: { id: 'concentrate', label: 'Concentrates', unit: 'g',   icon: '💎', limitField: 'concentrate_g' },
  EDIBLE:      { id: 'edible',      label: 'Edibles',      unit: 'mg',  icon: '🍬', limitField: 'edible_mg_thc' },
  VAPE:        { id: 'vape',        label: 'Vaporizers',   unit: 'g',   icon: '💨', limitField: 'concentrate_g' },
  TOPICAL:     { id: 'topical',     label: 'Topicals',     unit: 'mg',  icon: '🧴', limitField: null },
  TINCTURE:    { id: 'tincture',    label: 'Tinctures',    unit: 'ml',  icon: '💧', limitField: 'edible_mg_thc' },
  PREROLL:     { id: 'preroll',     label: 'Pre-Rolls',    unit: 'oz',  icon: '🚬', limitField: 'flower_oz' },
};

const STRAIN_TYPES = ['indica', 'sativa', 'hybrid', 'cbd-dominant'];

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT CATALOG
// ═══════════════════════════════════════════════════════════════════════════

class ProductCatalog {
  constructor(opts = {}) {
    this.catalogPath = opts.catalogPath || CATALOG_PATH;
    this.products = new Map();
    this.dispensaryId = opts.dispensaryId || 'default';
    this._load();
  }

  // ─── Product Management ────────────────────────────────────────────────

  /**
   * Add a product to the catalog.
   *
   * @param {Product} product
   * @returns {Product}
   */
  addProduct(product) {
    const sku = product.sku || `SKU-${Date.now().toString(36).toUpperCase()}`;
    const entry = {
      sku,
      name: product.name,
      brand: product.brand || null,
      category: product.category,
      strainType: product.strainType || null,
      strainName: product.strainName || null,
      thcPercent: product.thcPercent || 0,
      cbdPercent: product.cbdPercent || 0,
      thcMg: product.thcMg || null,          // For edibles
      weight: product.weight || 0,            // In category units
      weightUnit: CATEGORIES[product.category]?.unit || 'unit',
      price: product.price,
      taxRate: product.taxRate || 0.15,        // Default cannabis tax
      inventory: product.inventory || 0,
      minAge: product.minAge || 21,
      imageUrl: product.imageUrl || null,
      description: product.description || '',
      tags: product.tags || [],
      seedToSaleTag: product.seedToSaleTag || null,  // METRC/BioTrack tag
      active: product.active !== false,
      addedAt: new Date().toISOString(),
    };

    this.products.set(sku, entry);
    this._persist();
    return entry;
  }

  /**
   * Get a product by SKU.
   */
  getProduct(sku) {
    return this.products.get(sku) || null;
  }

  /**
   * List products with optional filters.
   *
   * @param {object} [filters]
   * @param {string} filters.category — Filter by category
   * @param {string} filters.strainType — Filter by strain type
   * @param {number} filters.maxPrice — Max price
   * @param {boolean} filters.inStock — Only in-stock items
   * @param {string} filters.search — Text search
   * @returns {Product[]}
   */
  listProducts(filters = {}) {
    let results = Array.from(this.products.values()).filter(p => p.active);

    if (filters.category) {
      results = results.filter(p => p.category === filters.category);
    }
    if (filters.strainType) {
      results = results.filter(p => p.strainType === filters.strainType);
    }
    if (filters.maxPrice !== undefined) {
      results = results.filter(p => p.price <= filters.maxPrice);
    }
    if (filters.inStock) {
      results = results.filter(p => p.inventory > 0);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.strainName || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    return results;
  }

  /**
   * Calculate purchase totals, converting quantities to limit-check units.
   *
   * @param {Array<{sku: string, quantity: number}>} cartItems
   * @returns {CartTotals}
   */
  calculateCartTotals(cartItems) {
    let subtotal = 0;
    let totalTax = 0;
    const limitAccumulator = { flower_oz: 0, concentrate_g: 0, edible_mg_thc: 0 };
    const lineItems = [];

    for (const item of cartItems) {
      const product = this.products.get(item.sku);
      if (!product) continue;

      const lineTotal = product.price * item.quantity;
      const lineTax = lineTotal * product.taxRate;
      subtotal += lineTotal;
      totalTax += lineTax;

      // Accumulate for purchase limit checking
      const cat = CATEGORIES[product.category];
      if (cat?.limitField) {
        limitAccumulator[cat.limitField] = (limitAccumulator[cat.limitField] || 0) +
          (product.category === 'EDIBLE' || product.category === 'TINCTURE'
            ? (product.thcMg || 0) * item.quantity
            : product.weight * item.quantity);
      }

      lineItems.push({
        sku: product.sku,
        name: product.name,
        category: product.category,
        quantity: item.quantity,
        unitPrice: product.price,
        lineTotal,
        tax: Math.round(lineTax * 100) / 100,
        seedToSaleTag: product.seedToSaleTag,
      });
    }

    return {
      lineItems,
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(totalTax * 100) / 100,
      total: Math.round((subtotal + totalTax) * 100) / 100,
      itemCount: lineItems.length,
      limitAccumulator,
    };
  }

  /**
   * Decrement inventory after a sale.
   *
   * @param {Array<{sku: string, quantity: number}>} cartItems
   */
  decrementInventory(cartItems) {
    for (const item of cartItems) {
      const product = this.products.get(item.sku);
      if (product) {
        product.inventory = Math.max(0, product.inventory - item.quantity);
      }
    }
    this._persist();
  }

  /**
   * Get low-stock products (below threshold).
   */
  getLowStock(threshold = 5) {
    return Array.from(this.products.values())
      .filter(p => p.active && p.inventory <= threshold && p.inventory >= 0)
      .sort((a, b) => a.inventory - b.inventory);
  }

  /**
   * Get catalog summary stats.
   */
  getSummary() {
    const all = Array.from(this.products.values());
    const active = all.filter(p => p.active);
    const byCategory = {};
    for (const p of active) {
      byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    }
    return {
      totalProducts: all.length,
      activeProducts: active.length,
      byCategory,
      lowStock: this.getLowStock().length,
      dispensaryId: this.dispensaryId,
    };
  }

  // ─── Persistence ───────────────────────────────────────────────────────

  _load() {
    try {
      if (fs.existsSync(this.catalogPath)) {
        const data = JSON.parse(fs.readFileSync(this.catalogPath, 'utf-8'));
        for (const [sku, product] of Object.entries(data.products || {})) {
          this.products.set(sku, product);
        }
      }
    } catch { /* start fresh */ }
  }

  _persist() {
    try {
      const dir = path.dirname(this.catalogPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = {
        version: '1.0.0',
        dispensaryId: this.dispensaryId,
        updatedAt: new Date().toISOString(),
        products: Object.fromEntries(this.products),
      };
      fs.writeFileSync(this.catalogPath, JSON.stringify(data, null, 2));
    } catch { /* non-fatal */ }
  }

  /**
   * Seed the catalog with sample cannabis products for demo/testing.
   */
  seedDemoProducts() {
    const demos = [
      { name: 'Blue Dream', category: 'FLOWER', strainType: 'hybrid', strainName: 'Blue Dream', thcPercent: 21, cbdPercent: 0.5, weight: 0.125, price: 40, inventory: 50, tags: ['popular','daytime'] },
      { name: 'OG Kush', category: 'FLOWER', strainType: 'indica', strainName: 'OG Kush', thcPercent: 24, cbdPercent: 0.3, weight: 0.125, price: 45, inventory: 35, tags: ['classic','evening'] },
      { name: 'Sour Diesel', category: 'FLOWER', strainType: 'sativa', strainName: 'Sour Diesel', thcPercent: 22, cbdPercent: 0.2, weight: 0.125, price: 42, inventory: 28, tags: ['energizing','creative'] },
      { name: 'Harlequin CBD', category: 'FLOWER', strainType: 'cbd-dominant', strainName: 'Harlequin', thcPercent: 5, cbdPercent: 15, weight: 0.125, price: 35, inventory: 20, tags: ['cbd','therapeutic'] },
      { name: 'Live Resin - GG#4', category: 'CONCENTRATE', strainType: 'hybrid', strainName: 'Gorilla Glue #4', thcPercent: 78, weight: 1, price: 55, inventory: 15, tags: ['live-resin','potent'] },
      { name: 'Shatter - GSC', category: 'CONCENTRATE', strainType: 'hybrid', strainName: 'Girl Scout Cookies', thcPercent: 82, weight: 1, price: 45, inventory: 22, tags: ['shatter','value'] },
      { name: 'Watermelon Gummies 10pk', category: 'EDIBLE', thcMg: 100, weight: 100, price: 25, inventory: 60, tags: ['gummies','watermelon','10mg-each'] },
      { name: 'Dark Chocolate Bar', category: 'EDIBLE', thcMg: 100, weight: 100, price: 22, inventory: 40, tags: ['chocolate','microdose-squares'] },
      { name: 'Lemonade Beverage 100mg', category: 'EDIBLE', thcMg: 100, weight: 100, price: 18, inventory: 30, tags: ['beverage','lemonade','fast-acting'] },
      { name: 'Vape Cart - Gelato 1g', category: 'VAPE', strainType: 'hybrid', strainName: 'Gelato', thcPercent: 88, weight: 1, price: 50, inventory: 45, tags: ['cartridge','510-thread'] },
      { name: 'Disposable Pen - Zkittlez', category: 'VAPE', strainType: 'indica', strainName: 'Zkittlez', thcPercent: 85, weight: 0.5, price: 35, inventory: 55, tags: ['disposable','beginner-friendly'] },
      { name: 'Pain Relief Balm 500mg', category: 'TOPICAL', thcMg: 200, cbdPercent: 8, weight: 500, price: 40, inventory: 18, tags: ['topical','pain-relief'] },
      { name: 'Full Spectrum Tincture 1000mg', category: 'TINCTURE', thcMg: 500, cbdPercent: 5, weight: 30, price: 55, inventory: 25, tags: ['tincture','full-spectrum','dropper'] },
      { name: 'Pre-Roll 5-Pack Sativa', category: 'PREROLL', strainType: 'sativa', thcPercent: 20, weight: 0.175, price: 30, inventory: 40, tags: ['pre-roll','5-pack','convenient'] },
      { name: 'Infused Blunt - Indica', category: 'PREROLL', strainType: 'indica', thcPercent: 35, weight: 0.07, price: 18, inventory: 30, tags: ['infused','blunt','single'] },
    ];

    for (const d of demos) {
      this.addProduct(d);
    }

    return { seeded: demos.length };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STANDALONE TEST
// ═══════════════════════════════════════════════════════════════════════════

if (require.main === module) {
  const catalog = new ProductCatalog({ catalogPath: '/tmp/heady-kiosk-demo-catalog.json', dispensaryId: 'demo-dispensary-001' });

  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  HEADY KIOSK — Cannabis Product Catalog              ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // Seed demo products
  const seeded = catalog.seedDemoProducts();
  console.log(`Seeded ${seeded.seeded} demo products\n`);

  // Summary
  const summary = catalog.getSummary();
  console.log('Catalog Summary:');
  console.log(`  Total: ${summary.activeProducts} active products`);
  for (const [cat, count] of Object.entries(summary.byCategory)) {
    const info = CATEGORIES[cat];
    console.log(`  ${info?.icon || '📦'} ${info?.label || cat}: ${count}`);
  }

  // List flower
  console.log('\n─── Flower Menu ───');
  const flowers = catalog.listProducts({ category: 'FLOWER' });
  for (const f of flowers) {
    console.log(`  ${f.name} (${f.strainType}) — THC: ${f.thcPercent}% | $${f.price} | Stock: ${f.inventory}`);
  }

  // Search
  console.log('\n─── Search: "gummies" ───');
  const gummies = catalog.listProducts({ search: 'gummies' });
  for (const g of gummies) {
    console.log(`  ${g.name} — ${g.thcMg}mg THC | $${g.price}`);
  }

  // Cart totals
  console.log('\n─── Cart Calculation ───');
  const skus = Array.from(catalog.products.keys());
  const cart = [
    { sku: skus[0], quantity: 1 },  // Blue Dream
    { sku: skus[6], quantity: 2 },  // Gummies x2
  ];
  const totals = catalog.calculateCartTotals(cart);
  console.log(`  Items: ${totals.itemCount}`);
  console.log(`  Subtotal: $${totals.subtotal}`);
  console.log(`  Tax: $${totals.tax}`);
  console.log(`  Total: $${totals.total}`);
  console.log(`  Limit check: flower=${totals.limitAccumulator.flower_oz}oz, edible=${totals.limitAccumulator.edible_mg_thc}mg THC`);

  // Cleanup
  try { require('fs').unlinkSync('/tmp/heady-kiosk-demo-catalog.json'); } catch {}
}

module.exports = { ProductCatalog, CATEGORIES, STRAIN_TYPES };
