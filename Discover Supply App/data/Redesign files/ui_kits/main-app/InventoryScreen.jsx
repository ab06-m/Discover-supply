// Inventory Screen
const PRODUCTS = [
  { id: 1, name: 'Sparkling Water 500ml ×24', sku: 'SW-500', category: 'Beverages', onHand: 48, committed: 24, threshold: 10, price: '$48.00' },
  { id: 2, name: 'Orange Juice 1L', sku: 'OJ-1L', category: 'Beverages', onHand: 72, committed: 20, threshold: 15, price: '$4.50' },
  { id: 3, name: 'Apple Cider 750ml', sku: 'AC-750', category: 'Beverages', onHand: 6, committed: 3, threshold: 10, price: '$18.50' },
  { id: 4, name: 'Chips Variety Pack', sku: 'CV-12', category: 'Snacks', onHand: 24, committed: 6, threshold: 8, price: '$12.50' },
  { id: 5, name: 'Soda 2L Assorted', sku: 'S2L-A', category: 'Beverages', onHand: 15, committed: 15, threshold: 12, price: '$7.25' },
  { id: 6, name: 'Cookies Box 500g', sku: 'CB-500', category: 'Snacks', onHand: 18, committed: 9, threshold: 6, price: '$25.29' },
  { id: 7, name: 'Mixed Nuts 1kg', sku: 'MN-1K', category: 'Snacks', onHand: 22, committed: 11, threshold: 8, price: '$32.75' },
  { id: 8, name: 'Premium Coffee 250g', sku: 'PC-250', category: 'Coffee & Tea', onHand: 8, committed: 2, threshold: 10, price: '$18.00' },
  { id: 9, name: 'Tea Bags ×100', sku: 'TB-100', category: 'Coffee & Tea', onHand: 35, committed: 13, threshold: 8, price: '$38.00' },
  { id: 10, name: 'Energy Drink 250ml', sku: 'ED-250', category: 'Beverages', onHand: 0, committed: 0, threshold: 20, price: '$3.80' },
];

function InventoryScreen() {
  const [q, setQ] = React.useState('');
  const [catFilter, setCatFilter] = React.useState('');
  const [tab, setTab] = React.useState('all');

  const categories = [...new Set(PRODUCTS.map(p => p.category))];

  const filtered = PRODUCTS.filter(p => {
    const avail = p.onHand - p.committed;
    const matchQ = !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase());
    const matchCat = !catFilter || p.category === catFilter;
    const matchTab = tab === 'all' || (tab === 'low' && avail <= p.threshold && avail > 0) || (tab === 'out' && avail <= 0);
    return matchQ && matchCat && matchTab;
  });

  const lowCount = PRODUCTS.filter(p => { const a = p.onHand - p.committed; return a <= p.threshold && a > 0; }).length;
  const outCount = PRODUCTS.filter(p => p.onHand - p.committed <= 0).length;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      <PageHeader title="Inventory"
        subtitle={`${PRODUCTS.length} products`}
        actions={
          <>
            <Btn variant="outline" size="sm"><Icons.Upload /> Import</Btn>
            <Btn size="sm"><Icons.Plus /> Add product</Btn>
          </>
        }
      />

      {/* Alert banner */}
      {(lowCount > 0 || outCount > 0) && (
        <div style={{ marginTop: 16, padding: '10px 16px', background: C.warningBg, border: `1px solid ${C.warning}40`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'hsl(38 92% 28%)' }}>
          <span style={{ color: C.warning, display: 'flex' }}><Icons.Alert /></span>
          <span><strong>{lowCount} products</strong> are low on stock and <strong>{outCount} product{outCount !== 1 ? 's are' : ' is'}</strong> out of stock.</span>
          <button onClick={() => setTab('low')} style={{ marginLeft: 'auto', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, color: 'hsl(38 92% 28%)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>View alerts</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ marginTop: 20, marginBottom: 0 }}>
        <TabNav
          tabs={[
            { id: 'all', label: `All (${PRODUCTS.length})` },
            { id: 'low', label: `Low stock (${lowCount})` },
            { id: 'out', label: `Out of stock (${outCount})` },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, margin: '14px 0', flexWrap: 'wrap' }}>
        <Input placeholder="Search by name or SKU…" value={q} onChange={e => setQ(e.target.value)}
          icon={<Icons.Search />} style={{ width: 260 }} />
        <Select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ width: 180 }}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>

      {/* Table */}
      <Card style={{ overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <EmptyState icon={Icons.Package} title="No products match"
            description="Adjust your filters or add a new product." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'hsl(220 14% 97%)' }}>
                {['Product', 'SKU', 'Category', 'On hand', 'Committed', 'Available', 'Price'].map((h, i) => (
                  <th key={h} style={{ fontSize: 11, fontWeight: 500, color: C.mutedFg, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '10px 16px', textAlign: i >= 3 ? 'right' : 'left', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const available = p.onHand - p.committed;
                return (
                  <tr key={p.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer', transition: 'background 100ms' }}
                    onMouseEnter={e => e.currentTarget.style.background = C.primaryLight}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.mutedFg, flexShrink: 0 }}>
                          <Icons.Image />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: C.mutedFg }}>{p.sku}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontSize: 12, background: C.primaryLight, color: 'hsl(221 83% 40%)', fontWeight: 500, borderRadius: 6, padding: '2px 8px' }}>{p.category}</span>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 14, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.onHand}</td>
                    <td style={{ padding: '11px 16px', fontSize: 14, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: C.mutedFg }}>{p.committed}</td>
                    <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                      <StockBadge available={available} threshold={p.threshold} />
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 14, textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{p.price}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

Object.assign(window, { InventoryScreen });
