import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/app/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Discover Supply",
  description: "Multi-tenant inventory, orders, invoicing & dispatching.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Discover Supply" },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeInitScript = `(() => {
  try {
    const stored = localStorage.getItem('ds-theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored === 'dark' || stored === 'light' ? stored : (prefersDark ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (_) {}
})();`;

const criticalFallbackStyles = `
  :root {
    --background: 220 14% 96%;
    --foreground: 222 47% 11%;
    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;
    --primary: 221 83% 53%;
    --primary-foreground: 0 0% 100%;
    --secondary: 220 14% 96%;
    --secondary-foreground: 222 47% 11%;
    --muted: 220 14% 96%;
    --muted-foreground: 220 9% 46%;
    --accent: 217 91% 96%;
    --accent-foreground: 221 83% 33%;
    --border: 220 13% 91%;
    --input: 220 13% 91%;
    --sidebar: 0 0% 100%;
    --sidebar-foreground: 222 47% 11%;
    --sidebar-active: 217 91% 96%;
    --sidebar-muted: 220 9% 46%;
  }
  .dark {
    --background: 222 47% 6%;
    --foreground: 210 40% 98%;
    --card: 222 47% 9%;
    --card-foreground: 210 40% 98%;
    --primary: 221 83% 60%;
    --primary-foreground: 0 0% 100%;
    --secondary: 217 33% 17%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217 33% 17%;
    --muted-foreground: 215 20% 65%;
    --accent: 217 33% 22%;
    --accent-foreground: 210 40% 98%;
    --border: 217 33% 17%;
    --input: 217 33% 17%;
    --sidebar: 222 47% 11%;
    --sidebar-foreground: 210 40% 98%;
    --sidebar-active: 221 83% 53%;
    --sidebar-muted: 215 20% 65%;
  }
  html, body { min-height: 100%; }
  body {
    margin: 0;
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: 'DM Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  a { color: inherit; text-decoration: none; }
  .min-h-screen { min-height: 100vh; }
  .bg-slate-50, .bg-background { background: hsl(var(--background)); }
  .bg-white, .bg-card { background: hsl(var(--card)); }
  .bg-secondary { background: hsl(var(--secondary)); }
  .bg-primary { background: hsl(var(--primary)); }
  .bg-sidebar { background: hsl(var(--sidebar)); }
  .text-foreground { color: hsl(var(--foreground)); }
  .text-card-foreground { color: hsl(var(--card-foreground)); }
  .text-muted-foreground { color: hsl(var(--muted-foreground)); }
  .text-primary { color: hsl(var(--primary)); }
  .text-sidebar-foreground { color: hsl(var(--sidebar-foreground)); }
  .text-sidebar-muted { color: hsl(var(--sidebar-muted)); }
  .text-primary-foreground, .text-white { color: hsl(var(--primary-foreground)); }
  .border, .border-b, .border-t { border-color: hsl(var(--border)); }
  .border { border-width: 1px; border-style: solid; }
  .border-b { border-bottom-width: 1px; border-bottom-style: solid; }
  .border-t { border-top-width: 1px; border-top-style: solid; }
  .rounded-md { border-radius: 0.375rem; }
  .rounded-lg { border-radius: 0.5rem; }
  .rounded-full { border-radius: 9999px; }
  .shadow-sm, .shadow-card { box-shadow: 0 1px 3px rgb(15 23 42 / 0.08); }
  .mx-auto { margin-left: auto; margin-right: auto; }
  .mt-2 { margin-top: 0.5rem; }
  .mt-3 { margin-top: 0.75rem; }
  .mt-4 { margin-top: 1rem; }
  .mr-1 { margin-right: 0.25rem; }
  .mr-2 { margin-right: 0.5rem; }
  .ml-1 { margin-left: 0.25rem; }
  .max-w-3xl { max-width: 48rem; }
  .max-w-6xl { max-width: 72rem; }
  .max-w-xs { max-width: 20rem; }
  .w-full { width: 100%; }
  .w-16 { width: 4rem; }
  .w-24 { width: 6rem; }
  .w-28 { width: 7rem; }
  .h-3 { height: 0.75rem; }
  .w-3 { width: 0.75rem; }
  .h-4 { height: 1rem; }
  .w-4 { width: 1rem; }
  .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
  .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
  .px-4 { padding-left: 1rem; padding-right: 1rem; }
  .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
  .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
  .py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
  .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
  .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
  .py-6 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
  .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
  .py-12 { padding-top: 3rem; padding-bottom: 3rem; }
  .p-2 { padding: 0.5rem; }
  .p-3 { padding: 0.75rem; }
  .p-4 { padding: 1rem; }
  .p-6 { padding: 1.5rem; }
  .pt-0 { padding-top: 0; }
  .flex { display: flex; }
  .inline-flex { display: inline-flex; }
  .grid { display: grid; }
  .hidden { display: none; }
  .flex-1 { flex: 1 1 0%; }
  .flex-col { flex-direction: column; }
  .flex-wrap { flex-wrap: wrap; }
  .items-center { align-items: center; }
  .items-start { align-items: flex-start; }
  .justify-center { justify-content: center; }
  .justify-between { justify-content: space-between; }
  .justify-end { justify-content: flex-end; }
  .gap-1 { gap: 0.25rem; }
  .gap-2 { gap: 0.5rem; }
  .gap-3 { gap: 0.75rem; }
  .gap-4 { gap: 1rem; }
  .space-y-1 > * + * { margin-top: 0.25rem; }
  .space-y-2 > * + * { margin-top: 0.5rem; }
  .space-y-3 > * + * { margin-top: 0.75rem; }
  .space-y-4 > * + * { margin-top: 1rem; }
  .space-y-6 > * + * { margin-top: 1.5rem; }
  .divide-y > * + * { border-top: 1px solid hsl(var(--border)); }
  .overflow-hidden { overflow: hidden; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .text-xs { font-size: 0.75rem; line-height: 1rem; }
  .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
  .text-base { font-size: 1rem; line-height: 1.5rem; }
  .text-2xl { font-size: 1.5rem; line-height: 2rem; }
  .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
  .font-medium { font-weight: 500; }
  .font-semibold { font-weight: 600; }
  .font-bold { font-weight: 700; }
  .tracking-tight { letter-spacing: 0; }
  .uppercase { text-transform: uppercase; }
  .whitespace-nowrap { white-space: nowrap; }
  .hover\\:underline:hover { text-decoration: underline; }
  .hover\\:bg-secondary:hover { background: hsl(var(--secondary)); }
  .h-9 { height: 2.25rem; }
  .h-10 { height: 2.5rem; }
  .h-11 { height: 2.75rem; }
  button, .inline-flex[role='button'], a.inline-flex {
    font: inherit;
  }
  .inline-flex.items-center.justify-center,
  button.inline-flex {
    border: 0;
    cursor: pointer;
  }
  .bg-primary.text-primary-foreground,
  button.bg-primary {
    color: #fff;
  }
  .border-input { border-color: hsl(var(--input)); }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 0.75rem; border-bottom: 1px solid hsl(var(--border)); }
  th { text-align: left; color: hsl(var(--muted-foreground)); font-weight: 500; }
  @media (min-width: 768px) {
    .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .md\\:grid-cols-\\[1fr_320px\\] { grid-template-columns: 1fr 320px; }
  }
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <style dangerouslySetInnerHTML={{ __html: criticalFallbackStyles }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
