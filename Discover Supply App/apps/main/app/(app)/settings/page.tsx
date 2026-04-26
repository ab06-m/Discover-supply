import { requireActiveOrg } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getInventorySettings } from "@/modules/inventory/lib/stock-rules";

export default async function SettingsPage() {
  const { org } = await requireActiveOrg();
  const { defaultLowStockThreshold } = getInventorySettings(org.settings);

  async function updateOrg(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const currency = formData.get("currency") as string;
    const taxRate = formData.get("taxRate") as string;

    await db
      .update(schema.organizations)
      .set({
        name,
        currency,
        taxRate: taxRate ? (parseFloat(taxRate) / 100).toString() : "0",
        updatedAt: new Date(),
      })
      .where(eq(schema.organizations.id, org.id));

    revalidatePath("/settings");
  }

  async function updateInventoryRules(formData: FormData) {
    "use server";

    const rawThreshold = String(formData.get("defaultLowStockThreshold") ?? "0").trim();
    const defaultThreshold = rawThreshold ? Math.max(0, parseInt(rawThreshold, 10) || 0) : 0;

    const current = await db
      .select({ settings: schema.organizations.settings })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, org.id))
      .limit(1);

    const currentSettings =
      current[0]?.settings && typeof current[0].settings === "object"
        ? (current[0].settings as Record<string, unknown>)
        : {};
    const currentInventory =
      currentSettings.inventory && typeof currentSettings.inventory === "object"
        ? (currentSettings.inventory as Record<string, unknown>)
        : {};

    await db
      .update(schema.organizations)
      .set({
        settings: {
          ...currentSettings,
          inventory: {
            ...currentInventory,
            lowStockThreshold: defaultThreshold,
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(schema.organizations.id, org.id));

    revalidatePath("/settings");
    revalidatePath("/products");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization settings and preferences.
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <form action={updateOrg}>
            <CardHeader>
              <CardTitle>Organization Profile</CardTitle>
              <CardDescription>
                This is your organization's visible information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={org.name}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="currency">Currency Code</Label>
                  <Input
                    id="currency"
                    name="currency"
                    defaultValue={org.currency}
                    placeholder="USD"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="taxRate">Default Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    name="taxRate"
                    type="number"
                    step="0.01"
                    defaultValue={(parseFloat(org.taxRate) * 100).toString()}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit">Save Changes</Button>
              </div>
            </CardContent>
          </form>
        </Card>

        <Card>
          <form action={updateInventoryRules}>
            <CardHeader>
              <CardTitle>Inventory Rules</CardTitle>
              <CardDescription>
                Choose when stock shows a yellow warning instead of the standard box icon.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="defaultLowStockThreshold">Default low-stock threshold</Label>
                <Input
                  id="defaultLowStockThreshold"
                  name="defaultLowStockThreshold"
                  type="number"
                  min={0}
                  defaultValue={defaultLowStockThreshold}
                />
              </div>

              <div className="text-sm text-muted-foreground">
                At 0 or below, products show a red warning. Above 0 and at or below this threshold,
                they show a yellow warning. Higher stock shows the box icon.
              </div>

              <div className="flex justify-end">
                <Button type="submit">Save Inventory Rules</Button>
              </div>
            </CardContent>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions for your organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive">Delete Organization</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
