// App shell — sidebar + routing
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'Dashboard' },
  { id: 'inventory', label: 'Inventory', icon: 'Package'   },
  { id: 'checkin',   label: 'Check in',  icon: 'Scan'       },
  { id: 'orders',    label: 'Orders',    icon: 'Cart'       },
  { id: 'invoices',  label: 'Invoices',  icon: 'FileText'   },
  { id: 'delivery',  label: 'Delivery',  icon: 'Truck'      },
  { id: 'stores',    label: 'Stores',    icon: 'Store'      },
  { id: 'reports',   label: 'Reports',   icon: 'BarChart'   },
  { id: 'settings',  label: 'Settings',  icon: 'Settings'   },
];

function AppSidebar({ active, onNav }) {
  const { C, dark, toggle } = useTheme();

  const navItemStyle = (isActive) => ({
    fontFamily: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    padding: '7px 4px',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 150ms',
    width: '100%',
    fontSize: 10,
    fontWeight: isActive ? 600 : 500,
    lineHeight: 1.2,
    background: isActive ? C.sidebarActive : 'transparent',
    color: isActive ? C.sidebarActiveFg : C.sidebarFg,
    opacity: isActive ? 1 : 0.80,
    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  });

  return (
    <aside style={{ width: 84, flexShrink: 0, background: C.sidebar, display: 'flex', flexDirection: 'column', height: '100%', transition: 'background 200ms', alignItems: 'center' }}>

      {/* Org logo */}
      <div style={{ padding: '16px 0 12px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: dark ? C.primary : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: dark ? '#fff' : C.primary, boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
          A
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', width: '100%', alignItems: 'center' }}>
        {NAV.map((item, idx) => {
          const isActive = item.id === active;
          const IconComp = Icons[item.icon];
          const showDivider = idx === 7;
          return (
            <React.Fragment key={item.id}>
              {showDivider && <div style={{ height: 1, background: 'rgba(255,255,255,0.10)', margin: '4px 8px', width: 'calc(100% - 16px)' }} />}
              <button
                onClick={() => onNav(item.id)}
                style={navItemStyle(isActive)}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = C.sidebarHover; e.currentTarget.style.opacity = '1'; }}}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.80'; }}}>
                {IconComp && <IconComp size={16} />}
                <span style={{ lineHeight: 1.2, textAlign: 'center', whiteSpace: 'nowrap' }}>{item.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Bottom — user avatar + theme toggle */}
      <div style={{ padding: '10px 0 14px', borderTop: '1px solid rgba(255,255,255,0.10)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{ width: 34, height: 34, borderRadius: 9, border: 'none', background: 'rgba(255,255,255,0.10)', color: C.sidebarFg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 150ms' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.20)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.10)'}>
          {dark ? <Icons.Sun size={15} /> : <Icons.Moon size={15} />}
        </button>
        {/* User avatar */}
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: C.sidebarFg, cursor: 'pointer' }}
          title="Jane Smith — Admin">
          J
        </div>
      </div>
    </aside>
  );
}

function PlaceholderScreen({ title }) {
  const { C } = useTheme();
  return (
    <div style={{ padding: '28px 32px' }}>
      <PageHeader title={title} />
      <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
        <div style={{ textAlign: 'center', color: C.mutedFg }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.2 }}>○</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Not in this kit</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Navigate to Dashboard, Inventory, or Orders.</div>
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  const { C } = useTheme();
  const [screen, setScreen]             = React.useState('dashboard');
  const [selectedOrder, setSelectedOrder] = React.useState(null);
  const [orders, setOrders]             = React.useState(ORDERS);
  const [mobileOpen, setMobileOpen]     = React.useState(false);

  function handleStageChange(orderId, newStageId) {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, stageId: newStageId } : o));
  }

  function handleNav(id) { setScreen(id); setSelectedOrder(null); setMobileOpen(false); }

  function renderScreen() {
    switch (screen) {
      case 'dashboard': return <DashboardScreen />;
      case 'inventory': return <InventoryScreen />;
      case 'orders':    return <OrdersScreen orders={orders} onSelectOrder={id => setSelectedOrder(id)} selectedOrderId={selectedOrder} onBack={() => setSelectedOrder(null)} onStageChange={handleStageChange} />;
      default:          return <PlaceholderScreen title={NAV.find(n => n.id === screen)?.label || screen} />;
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Desktop sidebar */}
      <AppSidebar active={selectedOrder ? 'orders' : screen} onNav={handleNav} />

      {/* Mobile overlay */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setMobileOpen(false)} />
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 240 }}>
            <AppSidebar active={selectedOrder ? 'orders' : screen} onNav={handleNav} />
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Mobile top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: C.card, borderBottom: `1px solid ${C.border}` }}>
          <button onClick={() => setMobileOpen(true)} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.fg }}>
            <Icons.Menu />
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.fg }}>Discover Supply</span>
        </div>
        <main style={{ flex: 1, overflowY: 'auto', background: C.bg, transition: 'background 200ms' }}>
          {renderScreen()}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

Object.assign(window, { App });
