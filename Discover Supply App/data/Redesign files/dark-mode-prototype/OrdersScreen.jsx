// Orders Screen — list + detail view

const STAGES = [
  { id: 'draft',     name: 'Draft',     color: '#94a3b8', isTerminal: false },
  { id: 'confirmed', name: 'Confirmed', color: '#3b82f6', isTerminal: false },
  { id: 'packed',    name: 'Packed',    color: '#f59e0b', isTerminal: false },
  { id: 'delivered', name: 'Delivered', color: '#10b981', isTerminal: false },
  { id: 'paid',      name: 'Paid',      color: '#8b5cf6', isTerminal: true  },
  { id: 'cancelled', name: 'Cancelled', color: '#ef4444', isTerminal: true  },
];

const ORDERS = [
  { id: 'ORD-0042', store: 'Metro Mart',   code: 'MM-01', stageId: 'confirmed', date: 'Apr 28, 2026', total: '$1,240.00',
    lines: [
      { name: 'Sparkling Water 500ml ×24', sku: 'SW-500', qty: 4,  price: '$48.00', lineTotal: '$192.00',  available: 24 },
      { name: 'Orange Juice 1L',           sku: 'OJ-1L',  qty: 20, price: '$4.50',  lineTotal: '$900.00',  available: 52 },
      { name: 'Apple Cider 750ml',         sku: 'AC-750', qty: 8,  price: '$18.50', lineTotal: '$148.00',  available: 3  },
    ], subtotal: '$1,240.00', tax: '$0.00', discount: '$0.00', notes: 'Deliver before noon.' },
  { id: 'ORD-0041', store: 'Corner Store', code: null,    stageId: 'packed',    date: 'Apr 27, 2026', total: '$385.50',
    lines: [
      { name: 'Chips Variety Pack', sku: 'CV-12',  qty: 10, price: '$12.50', lineTotal: '$125.00', available: 18 },
      { name: 'Soda 2L Assorted',   sku: 'S2L-A',  qty: 15, price: '$7.25',  lineTotal: '$108.75', available: 0  },
      { name: 'Cookies Box 500g',   sku: 'CB-500',  qty: 6,  price: '$25.29', lineTotal: '$151.75', available: 9  },
    ], subtotal: '$385.50', tax: '$0.00', discount: '$0.00', notes: '' },
  { id: 'ORD-0040', store: null,           code: null,    stageId: 'draft',    date: 'Apr 27, 2026', total: '$72.00',
    lines: [{ name: 'Custom item', sku: null, qty: 3, price: '$24.00', lineTotal: '$72.00', available: 99 }],
    subtotal: '$72.00', tax: '$0.00', discount: '$0.00', notes: '' },
  { id: 'ORD-0039', store: 'Sunrise Deli', code: 'SD-04', stageId: 'delivered', date: 'Apr 26, 2026', total: '$2,108.75',
    lines: [
      { name: 'Mixed Nuts 1kg',     sku: 'MN-1K',  qty: 25, price: '$32.75', lineTotal: '$818.75',  available: 11 },
      { name: 'Premium Coffee 250g',sku: 'PC-250',  qty: 40, price: '$18.00', lineTotal: '$720.00',  available: 6  },
      { name: 'Tea Bags ×100',      sku: 'TB-100',  qty: 15, price: '$38.00', lineTotal: '$570.00',  available: 22 },
    ], subtotal: '$2,108.75', tax: '$0.00', discount: '$0.00', notes: 'Regular weekly order.' },
];

function StagePipeline({ stageId, onTransition }) {
  const { C } = useTheme();
  const nonTerminal = STAGES.filter(s => !s.isTerminal);
  const terminals   = STAGES.filter(s =>  s.isTerminal);
  const curIdx = nonTerminal.findIndex(s => s.id === stageId);
  const isTerminalCurrent = terminals.some(s => s.id === stageId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
        {nonTerminal.map((s, i) => {
          const isCurrent = s.id === stageId;
          const isPast    = !isTerminalCurrent && i < curIdx;
          return (
            <React.Fragment key={s.id}>
              <button onClick={() => onTransition(s.id)}
                style={{ fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 9999, border: `1px solid ${isCurrent ? s.color : C.border}`, padding: '5px 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 150ms',
                  background: isCurrent ? s.color : isPast ? C.bg : C.card,
                  color: isCurrent ? '#fff' : isPast ? C.mutedFg : C.fg,
                  boxShadow: isCurrent ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>
                {isPast && <Icons.Check />}
                {s.name}
              </button>
              {i < nonTerminal.length - 1 && <span style={{ color: C.mutedFg, fontSize: 14 }}>›</span>}
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        {terminals.map(s => (
          <Btn key={s.id} variant="outline" size="sm" onClick={() => onTransition(s.id)}
            style={{ color: s.id === stageId ? s.color : C.mutedFg, borderColor: s.id === stageId ? s.color : C.border }}>
            {s.name}
          </Btn>
        ))}
      </div>
    </div>
  );
}

function OrderDetailView({ order, onBack, onStageChange }) {
  const { C } = useTheme();
  const stage = STAGES.find(s => s.id === order.stageId);
  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      <PageHeader
        title={order.id}
        subtitle={order.store ? `${order.store}${order.code ? ' · ' + order.code : ''}` : 'Walk-in customer'}
        onBack={onBack} backLabel="Back to orders"
        actions={<><Btn variant="outline" size="sm">Print</Btn><Btn variant="outline" size="sm">Create invoice</Btn></>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, marginTop: 24 }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.mutedFg, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Order stage</div>
            <StagePipeline stageId={order.stageId} onTransition={(id) => onStageChange(order.id, id)} />
          </Card>
          <Card style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 15, fontWeight: 600, color: C.fg }}>Items</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.tableHead }}>
                  {['Product', 'SKU', 'Qty', 'Unit price', 'Stock', 'Total'].map((h, i) => (
                    <th key={h} style={{ fontSize: 11, fontWeight: 500, color: C.mutedFg, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '9px 16px', textAlign: i >= 2 ? 'right' : 'left', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.lines.map((l, i) => (
                  <tr key={i} style={{ borderBottom: i < order.lines.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <td style={{ padding: '11px 16px', fontSize: 14, fontWeight: 500, color: C.fg }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.mutedFg, flexShrink: 0 }}>
                          <Icons.Image />
                        </div>
                        {l.name}
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: C.mutedFg }}>{l.sku || '—'}</td>
                    <td style={{ padding: '11px 16px', fontSize: 14, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: C.fg }}>{l.qty}</td>
                    <td style={{ padding: '11px 16px', fontSize: 14, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: C.fg }}>{l.price}</td>
                    <td style={{ padding: '11px 16px', textAlign: 'right' }}><StockBadge available={l.available} /></td>
                    <td style={{ padding: '11px 16px', fontSize: 14, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: C.fg }}>{l.lineTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {order.notes && (
            <Card style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.mutedFg, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Notes</div>
              <div style={{ fontSize: 14, color: C.fg, lineHeight: 1.6 }}>{order.notes}</div>
            </Card>
          )}
        </div>
        {/* Right rail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.mutedFg, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Summary</div>
            {[['Subtotal', order.subtotal], ['Discount', order.discount], ['Tax', order.tax]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: C.mutedFg, marginBottom: 8 }}>
                <span>{k}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: C.fg }}>
              <span>Total</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{order.total}</span>
            </div>
          </Card>
          <Card style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.mutedFg, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Details</div>
            <div style={{ fontSize: 13, color: C.mutedFg, marginBottom: 6 }}>Date: <span style={{ color: C.fg }}>{order.date}</span></div>
            <div style={{ fontSize: 13, color: C.mutedFg, marginBottom: 6 }}>Stage: <StageBadge name={stage?.name} color={stage?.color} /></div>
            <div style={{ fontSize: 13, color: C.mutedFg }}>Warehouse: <span style={{ color: C.fg }}>Main stock</span></div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OrdersScreen({ orders, onSelectOrder, selectedOrderId, onBack, onStageChange }) {
  const { C } = useTheme();
  const [q, setQ] = React.useState('');
  const [stageFilter, setStageFilter] = React.useState('');

  if (selectedOrderId) {
    const order = orders.find(o => o.id === selectedOrderId);
    return <OrderDetailView order={order} onBack={onBack} onStageChange={onStageChange} />;
  }

  const filtered = orders.filter(o => {
    const matchQ     = !q || o.id.toLowerCase().includes(q.toLowerCase()) || (o.store || '').toLowerCase().includes(q.toLowerCase());
    const matchStage = !stageFilter || o.stageId === stageFilter;
    return matchQ && matchStage;
  });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      <PageHeader title="Orders" subtitle={`${filtered.length} order${filtered.length === 1 ? '' : 's'}`}
        actions={<Btn><Icons.Plus /> New order</Btn>} />
      <div style={{ display: 'flex', gap: 8, margin: '20px 0', flexWrap: 'wrap' }}>
        <Input placeholder="Search order # or store…" value={q} onChange={e => setQ(e.target.value)} icon={<Icons.Search />} style={{ width: 260 }} />
        <Select value={stageFilter} onChange={e => setStageFilter(e.target.value)} style={{ width: 180 }}>
          <option value="">All stages</option>
          {STAGES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Btn variant="outline">Filter</Btn>
      </div>
      {filtered.length === 0 ? (
        <Card><EmptyState icon={Icons.Cart} title="No orders match your filters" description="Clear or adjust the search and stage filters to widen the list." /></Card>
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.tableHead }}>
                {['Order', 'Store', 'Stage', 'Date', 'Total'].map((h, i) => (
                  <th key={h} style={{ fontSize: 11, fontWeight: 500, color: C.mutedFg, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 16px', textAlign: i === 4 ? 'right' : 'left', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => {
                const stage = STAGES.find(s => s.id === o.stageId);
                return (
                  <tr key={o.id}
                    style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer', transition: 'background 100ms' }}
                    onMouseEnter={e => e.currentTarget.style.background = C.primaryLight}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => onSelectOrder(o.id)}>
                    <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: C.primary }}>{o.id}</td>
                    <td style={{ padding: '12px 16px', fontSize: 14, color: C.fg }}>
                      {o.store ? <><div>{o.store}</div>{o.code && <div style={{ fontSize: 11, color: C.mutedFg }}>{o.code}</div>}</> : <span style={{ color: C.mutedFg }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}><StageBadge name={stage?.name} color={stage?.color} /></td>
                    <td style={{ padding: '12px 16px', fontSize: 14, color: C.mutedFg }}>{o.date}</td>
                    <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: C.fg }}>{o.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

Object.assign(window, { OrdersScreen, ORDERS, STAGES });
