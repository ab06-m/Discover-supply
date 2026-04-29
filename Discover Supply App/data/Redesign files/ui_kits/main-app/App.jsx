// App shell — sidebar + routing
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'Dashboard' },
  { id: 'inventory', label: 'Inventory', icon: 'Package' },
  { id: 'checkin',   label: 'Check in',  icon: 'PackagePlus' },
  { id: 'orders',    label: 'Orders',    icon: 'Cart' },
  { id: 'invoices',  label: 'Invoices',  icon: 'FileText' },
  { id: 'delivery',  label: 'Delivery',  icon: 'Truck' },
  { id: 'stores',    label: 'Stores',    icon: 'Store' },
  { id: 'reports',   label: 'Reports',   icon: 'BarChart' },
  { id: 'settings',  label: 'Settings',  icon: 'Settings' },
];

function Sidebar({ active, onNav }) {
  return (
    <aside style={{ width: 220, flexShrink: 0, background: C.sidebar, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Org header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 14px 12px' }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: C.primary, boxShadow: '0 1px 3px rgba(0,0,0,0.12)', flexShrink: 0 }}>A</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Acme Dist.</div>
          <div style={{ fontSize: 11, color: 'hsl(215 90% 75%)', marginTop: 1 }}>Inventory</div>
        </div>
      </div>
      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
        {NAV.map((item, idx) => {
          const isActive = item.id === active;
          const IconComp = Icons[item.icon];
          const showDivider = idx === 7; // before Reports
          return (
            <React.Fragment key={item.id}>
              {showDivider && <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', margin: '4px 4px' }} />}
              <button onClick={() => onNav(item.id)}
                style={{ fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 150ms', width: '100%', textAlign: 'left', fontSize: 13, fontWeight: 500,
                  background: isActive ? '#fff' : 'transparent',
                  color: isActive ? C.primary : 'rgba(255,255,255,0.85)',
                  boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}}>
                {IconComp && <IconComp />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>
      {/* User row */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>J</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>Jane Smith</div>
          <div style={{ fontSize: 11, color: 'hsl(215 90% 75%)' }}>Admin</div>
        </div>
      </div>
    </aside>
  );
}

function PlaceholderScreen({ title, subtitle }) {
  return (
    <div style={{ padding: '28px 32px' }}>
      <PageHeader title={title} subtitle={subtitle} />
      <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ textAlign: 'center', color: C.mutedFg }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>○</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Coming soon in this kit</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Navigate to Dashboard, Inventory, or Orders to explore.</div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [screen, setScreen] = React.useState('dashboard');
  const [selectedOrder, setSelectedOrder] = React.useState(null);
  const [orders, setOrders] = React.useState(ORDERS);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  function handleStageChange(orderId, newStageId) {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, stageId: newStageId } : o));
  }

  function renderScreen() {
    switch (screen) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'inventory':
        return <InventoryScreen />;
      case 'orders':
        return (
          <OrdersScreen
            orders={orders}
            onSelectOrder={id => setSelectedOrder(id)}
            selectedOrderId={selectedOrder}
            onBack={() => setSelectedOrder(null)}
            onStageChange={handleStageChange}
          />
        );
      default:
        return <PlaceholderScreen title={NAV.find(n => n.id === screen)?.label || screen} subtitle="This screen is not in the current kit." />;
    }
  }

  function handleNav(id) {
    setScreen(id);
    setSelectedOrder(null);
    setMobileOpen(false);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Desktop sidebar */}
      <div style={{ display: 'flex', height: '100%' }}>
        <Sidebar active={selectedOrder ? 'orders' : screen} onNav={handleNav} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setMobileOpen(false)} />
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 240, display: 'flex', flexDirection: 'column' }}>
            <Sidebar active={selectedOrder ? 'orders' : screen} onNav={handleNav} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Mobile top bar */}
        <div style={{ display: 'none', alignItems: 'center', gap: 12, padding: '12px 16px', background: C.card, borderBottom: `1px solid ${C.border}`, boxShadow: cardShadow }}>
          <button onClick={() => setMobileOpen(true)} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.fg }}>
            <Icons.Menu />
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.fg }}>Discover Supply</span>
        </div>
        {/* Scrollable content */}
        <main style={{ flex: 1, overflowY: 'auto', background: C.bg }}>
          {renderScreen()}
        </main>
      </div>
    </div>
  );
}

Object.assign(window, { App });
