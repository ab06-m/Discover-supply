import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <nav className="flex items-center justify-between border-b px-6 py-4">
        <span className="text-lg font-bold tracking-tight">Discover Supply</span>
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link href="/login">Log in</Link></Button>
          <Button asChild><Link href="/signup">Get started</Link></Button>
        </div>
      </nav>

      <section className="mx-auto flex max-w-4xl flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Run your entire business from one app.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Inventory, orders, invoicing, and dispatching — built for small businesses that move fast.
          Multi-user, multi-device, and offline-ready.
        </p>
        <div className="mt-10 flex gap-3">
          <Button asChild size="lg"><Link href="/signup">Start free</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/login">Sign in</Link></Button>
        </div>
      </section>

      <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Discover Supply
      </footer>
    </main>
  );
}
