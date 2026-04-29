// ─── THEME ────────────────────────────────────────────────────────────────────
const LIGHT = {
  primary:       'hsl(221 83% 53%)',
  primaryDark:   'hsl(221 83% 45%)',
  primaryLight:  'hsl(217 91% 96%)',
  primaryMuted:  'hsl(215 90% 75%)',
  bg:            'hsl(220 14% 96%)',
  card:          '#ffffff',
  border:        'hsl(220 13% 91%)',
  fg:            'hsl(222 47% 11%)',
  mutedFg:       'hsl(220 9% 46%)',
  success:       'hsl(142 71% 45%)',
  successBg:     'hsl(142 71% 45% / 0.10)',
  successText:   'hsl(142 71% 28%)',
  warning:       'hsl(38 92% 50%)',
  warningBg:     'hsl(38 92% 50% / 0.10)',
  warningText:   'hsl(38 92% 28%)',
  destructive:   'hsl(0 84% 60%)',
  destructiveBg: 'hsl(0 84% 60% / 0.10)',
  destructiveText:'hsl(0 84% 40%)',
  sidebar:       'hsl(221 83% 53%)',
  sidebarFg:     '#fff',
  sidebarActive: '#fff',
  sidebarActiveFg:'hsl(221 83% 53%)',
  sidebarMuted:  'hsl(215 90% 75%)',
  sidebarHover:  'rgba(255,255,255,0.10)',
  tableHead:     'hsl(220 14% 97%)',
  iconBg:        (color) => color + '18',
  categoryBg:    'hsl(217 91% 96%)',
  categoryText:  'hsl(221 83% 40%)',
};

const DARK = {
  primary:       'hsl(221 83% 60%)',
  primaryDark:   'hsl(221 83% 53%)',
  primaryLight:  'hsl(217 33% 22%)',
  primaryMuted:  'hsl(215 20% 65%)',
  bg:            'hsl(222 47% 6%)',
  card:          'hsl(222 47% 9%)',
  border:        'hsl(217 33% 17%)',
  fg:            'hsl(210 40% 98%)',
  mutedFg:       'hsl(215 20% 65%)',
  success:       'hsl(142 71% 45%)',
  successBg:     'hsl(142 71% 45% / 0.15)',
  successText:   'hsl(142 71% 65%)',
  warning:       'hsl(38 92% 55%)',
  warningBg:     'hsl(38 92% 55% / 0.15)',
  warningText:   'hsl(38 92% 70%)',
  destructive:   'hsl(0 63% 50%)',
  destructiveBg: 'hsl(0 63% 50% / 0.15)',
  destructiveText:'hsl(0 84% 72%)',
  sidebar:       'hsl(222 47% 11%)',
  sidebarFg:     'hsl(210 40% 98%)',
  sidebarActive: 'hsl(221 83% 60%)',
  sidebarActiveFg:'#fff',
  sidebarMuted:  'hsl(215 20% 65%)',
  sidebarHover:  'rgba(255,255,255,0.07)',
  tableHead:     'hsl(222 47% 7%)',
  iconBg:        (color) => color.replace('hsl(', 'hsl(').replace(')', ' / 0.18)'),
  categoryBg:    'hsl(217 33% 22%)',
  categoryText:  'hsl(221 83% 75%)',
};

const cardShadow      = '0 1px 2px rgba(0,0,0,0.04),0 1px 3px rgba(0,0,0,0.06)';
const cardShadowDark  = '0 1px 2px rgba(0,0,0,0.3),0 1px 3px rgba(0,0,0,0.4)';
const cardHoverShadow = '0 4px 6px -1px rgba(0,0,0,0.06),0 2px 4px -2px rgba(0,0,0,0.06)';
const cardHoverShadowDark = '0 4px 6px -1px rgba(0,0,0,0.4),0 2px 4px -2px rgba(0,0,0,0.3)';

// ─── CONTEXT ──────────────────────────────────────────────────────────────────
const ThemeContext = React.createContext({ C: LIGHT, dark: false, toggle: () => {} });

function ThemeProvider({ children }) {
  const saved = (() => { try { return localStorage.getItem('ds-dark') === 'true'; } catch { return false; } })();
  const [dark, setDark] = React.useState(saved);

  const toggle = React.useCallback(() => {
    setDark(d => {
      const next = !d;
      try { localStorage.setItem('ds-dark', String(next)); } catch {}
      return next;
    });
  }, []);

  const C = dark ? DARK : LIGHT;
  const shadow = dark ? cardShadowDark : cardShadow;
  const hoverShadow = dark ? cardHoverShadowDark : cardHoverShadow;

  return (
    <ThemeContext.Provider value={{ C, dark, toggle, shadow, hoverShadow }}>
      <div style={{ background: C.bg, minHeight: '100vh', color: C.fg, transition: 'background 200ms, color 200ms' }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

function useTheme() { return React.useContext(ThemeContext); }

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ children, size = 16, stroke = "currentColor", fill = "none", strokeWidth = 1.75 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {children}
  </svg>
);

const Icons = {
  Dashboard:    () => <Icon><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Icon>,
  Package:      () => <Icon><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></Icon>,
  PackagePlus:  () => <Icon><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><line x1="12" y1="10" x2="12" y2="16"/><line x1="9" y1="13" x2="15" y2="13"/></Icon>,
  Cart:         () => <Icon><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></Icon>,
  FileText:     () => <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></Icon>,
  Truck:        () => <Icon><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></Icon>,
  Store:        () => <Icon><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Icon>,
  BarChart:     () => <Icon><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Icon>,
  Settings:     () => <Icon><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Icon>,
  Upload:       () => <Icon><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></Icon>,
  Plus:         () => <Icon><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Icon>,
  Search:       () => <Icon><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Icon>,
  ChevronRight: () => <Icon><polyline points="9 18 15 12 9 6"/></Icon>,
  ChevronLeft:  () => <Icon><polyline points="15 18 9 12 15 6"/></Icon>,
  Check:        () => <Icon><polyline points="20 6 9 17 4 12"/></Icon>,
  Alert:        () => <Icon><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></Icon>,
  ListChecks:   () => <Icon><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></Icon>,
  Wallet:       () => <Icon><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/></Icon>,
  Image:        () => <Icon><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></Icon>,
  X:            () => <Icon><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Icon>,
  Menu:         () => <Icon><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></Icon>,
  Sun:          () => <Icon><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></Icon>,
  Scan:         () => <Icon><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></Icon>,
  Moon:         () => <Icon fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></Icon>,
};

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function Btn({ children, variant = 'default', size = 'default', onClick, disabled, style: s, type = 'button' }) {
  const { C } = useTheme();
  const base = { fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 150ms', border: 'none', whiteSpace: 'nowrap', opacity: disabled ? 0.5 : 1 };
  const sizes = { default: { height: 40, padding: '0 16px', fontSize: 14 }, sm: { height: 34, padding: '0 12px', fontSize: 13 }, lg: { height: 44, padding: '0 24px', fontSize: 15 }, icon: { height: 40, width: 40, padding: 0, justifyContent: 'center' } };
  const variants = {
    default:     { background: C.primary, color: '#fff' },
    outline:     { background: C.card, color: C.fg, border: `1px solid ${C.border}` },
    ghost:       { background: 'transparent', color: C.fg },
    destructive: { background: C.destructive, color: '#fff' },
    secondary:   { background: C.bg, color: C.fg, border: `1px solid ${C.border}` },
  };
  return <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...sizes[size], ...variants[variant], ...s }}>{children}</button>;
}

function Card({ children, style: s, onClick, hoverable }) {
  const { C, shadow, hoverShadow } = useTheme();
  const [hov, setHov] = React.useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => hoverable && setHov(true)}
      onMouseLeave={() => hoverable && setHov(false)}
      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: hov ? hoverShadow : shadow, cursor: onClick ? 'pointer' : 'default', transition: 'background 200ms, border-color 200ms, box-shadow 150ms', ...s }}>
      {children}
    </div>
  );
}

function Badge({ children, style: s }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 9999, fontSize: 12, fontWeight: 600, padding: '2px 10px', color: '#fff', ...s }}>{children}</span>;
}

function StageBadge({ name, color }) {
  return <Badge style={{ background: color || '#94a3b8' }}>{name}</Badge>;
}

function StockBadge({ available, threshold = 5, unit = 'Pcs' }) {
  const { C } = useTheme();
  if (available <= 0) return <span style={{ fontSize: 12, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: C.destructiveBg, color: C.destructiveText }}>Out: 0 {unit}</span>;
  if (available <= threshold) return <span style={{ fontSize: 12, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: C.warningBg, color: C.warningText }}>Low: {available} {unit}</span>;
  return <span style={{ fontSize: 12, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: C.successBg, color: C.successText }}>{available} {unit}</span>;
}

function Input({ placeholder, value, onChange, style: s, icon, type = 'text' }) {
  const { C } = useTheme();
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {icon && <span style={{ position: 'absolute', left: 10, color: C.mutedFg, display: 'flex', pointerEvents: 'none' }}>{icon}</span>}
      <input type={type} placeholder={placeholder} value={value} onChange={onChange}
        style={{ fontFamily: 'inherit', fontSize: 14, color: C.fg, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, height: 40, padding: icon ? '0 12px 0 34px' : '0 12px', width: '100%', outline: 'none', transition: 'background 200ms, border-color 200ms, color 200ms', ...s }}
        onFocus={e => { e.target.style.borderColor = C.primary; e.target.style.boxShadow = '0 0 0 3px hsl(221 83% 53% / 0.15)'; }}
        onBlur={e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; }}
      />
    </div>
  );
}

function Select({ value, onChange, children, style: s }) {
  const { C } = useTheme();
  return (
    <select value={value} onChange={onChange}
      style={{ fontFamily: 'inherit', fontSize: 14, color: C.fg, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, height: 40, padding: '0 12px', outline: 'none', cursor: 'pointer', width: '100%', transition: 'background 200ms, border-color 200ms', ...s }}>
      {children}
    </select>
  );
}

function PageHeader({ title, subtitle, actions, backLabel, onBack }) {
  const { C } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div>
        {onBack && (
          <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: C.mutedFg, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 4, padding: 0 }}>
            <Icons.ChevronLeft /> {backLabel || 'Back'}
          </button>
        )}
        <h1 style={{ fontSize: 20, fontWeight: 600, color: C.fg, lineHeight: 1.25 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 14, color: C.mutedFg, marginTop: 2 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

function EmptyState({ icon: IconComp, title, description, action }) {
  const { C } = useTheme();
  return (
    <div style={{ textAlign: 'center', padding: '56px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4, color: C.primary }}>
        {IconComp && <IconComp />}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: C.fg }}>{title}</div>
      {description && <div style={{ fontSize: 14, color: C.mutedFg, maxWidth: 320, lineHeight: 1.6 }}>{description}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

function StatCard({ label, value, icon: IconComp, trend, hint, iconColor }) {
  const { C } = useTheme();
  return (
    <Card style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.mutedFg }}>{label}</div>
        {IconComp && (
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor || C.primary }}>
            <IconComp />
          </div>
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.fg, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {(trend || hint) && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          {trend && <span style={{ background: trend.positive ? C.successBg : C.destructiveBg, color: trend.positive ? C.successText : C.destructiveText, fontSize: 11, fontWeight: 600, borderRadius: 4, padding: '1px 6px' }}>{trend.value}</span>}
          {hint && <span style={{ fontSize: 11, color: C.mutedFg }}>{hint}</span>}
        </div>
      )}
    </Card>
  );
}

function TabNav({ tabs, active, onChange }) {
  const { C } = useTheme();
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, gap: 0 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          style={{ fontFamily: 'inherit', fontSize: 14, fontWeight: 500, padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', color: active === t.id ? C.primary : C.mutedFg, borderBottom: `2px solid ${active === t.id ? C.primary : 'transparent'}`, transition: 'all 150ms', marginBottom: -1 }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

Object.assign(window, {
  Icons, ThemeProvider, useTheme,
  Btn, Card, Badge, StageBadge, StockBadge, Input, Select,
  PageHeader, EmptyState, StatCard, TabNav,
  LIGHT, DARK,
});
