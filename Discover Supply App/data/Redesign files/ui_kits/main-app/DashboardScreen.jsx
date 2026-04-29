// Dashboard Screen
function DashboardScreen() {
  const stats = [
    { label: 'Products', value: '342', icon: Icons.Package, iconColor: C.primary },
    { label: 'Low-stock alerts', value: '7', icon: Icons.Alert, iconColor: C.warning, trend: { value: '+3', positive: false }, hint: 'since yesterday' },
    { label: 'Units committed', value: '1,204', icon: Icons.ListChecks, iconColor: C.primary },
    { label: 'Open orders', value: '24', icon: Icons.Cart, iconColor: C.primary, trend: { value: '+4', positive: true }, hint: 'today' },
    { label: 'Revenue (shipped)', value: '$48,320', icon: Icons.Wallet, iconColor: C.success, trend: { value: '+12.4%', positive: true }, hint: 'vs last month' },
    { label: 'Active deliveries', value: '3', icon: Icons.Truck, iconColor: C.primary },
  ];

  const recentOrders = [
    { id: 'ORD-0042', store: 'Metro Mart', code: 'MM-01', stage: 'Confirmed', stageColor: '#3b82f6', total: '$1,240.00', date: 'Apr 28' },
    { id: 'ORD-0041', store: 'Corner Store', code: null, stage: 'Packed', stageColor: '#f59e0b', total: '$385.50', date: 'Apr 27' },
    { id: 'ORD-0040', store: null, code: null, stage: 'Draft', stageColor: '#94a3b8', total: '$72.00', date: 'Apr 27' },
    { id: 'ORD-0039', store: 'Sunrise Deli', code: 'SD-04', stage: 'Delivered', stageColor: '#10b981', total: '$2,108.75', date: 'Apr 26' },
  ];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      <PageHeader
        title="Dashboard"
        subtitle="Welcome to Acme Distributors."
        style={{ marginBottom: 24 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>
      <Card>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.fg }}>Recent orders</div>
          <Btn variant="ghost" size="sm" style={{ color: C.primary, fontSize: 13 }}>View all</Btn>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'hsl(220 14% 97%)' }}>
              {['Order','Store','Stage','Date','Total'].map((h, i) => (
                <th key={h} style={{ fontSize: 11, fontWeight: 500, color: C.mutedFg, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 16px', textAlign: i === 4 ? 'right' : 'left', borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((o, i) => (
              <tr key={o.id} style={{ borderBottom: i < recentOrders.length - 1 ? `1px solid ${C.border}` : 'none' }}
                onMouseEnter={e => e.currentTarget.style.background = C.primaryLight}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: C.primary, cursor: 'pointer' }}>{o.id}</td>
                <td style={{ padding: '12px 16px', fontSize: 14 }}>
                  {o.store ? <><div>{o.store}</div>{o.code && <div style={{ fontSize: 11, color: C.mutedFg }}>{o.code}</div>}</> : <span style={{ color: C.mutedFg }}>—</span>}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <StageBadge name={o.stage} color={o.stageColor} />
                </td>
                <td style={{ padding: '12px 16px', fontSize: 14, color: C.mutedFg }}>{o.date}</td>
                <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{o.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

Object.assign(window, { DashboardScreen });
