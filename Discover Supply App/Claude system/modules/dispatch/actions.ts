"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireActiveOrg } from "@/lib/auth";
import { assertCan, type Role } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applyStageEffect } from "@/modules/orders/lib/apply-stage-effect";

const createSchema = z.object({
  orderId: z.string().uuid(),
  driverId: z.string().uuid().optional().or(z.literal("")),
  scheduledAt: z.string().optional().or(z.literal("")),
  routeSequence: z.coerce.number().optional(),
});

export async function createDispatch(input: z.input<typeof createSchema>) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "dispatch.assign");
  const parsed = createSchema.parse(input);

  const order = await db
    .select({
      id: schema.orders.id,
      shippingAddress: schema.orders.shippingAddress,
      customerId: schema.orders.customerId,
    })
    .from(schema.orders)
    .where(and(eq(schema.orders.orgId, org.id), eq(schema.orders.id, parsed.orderId)))
    .limit(1);
  if (!order.length) throw new Error("Order not found");

  const [row] = await db
    .insert(schema.dispatches)
    .values({
      orgId: org.id,
      orderId: parsed.orderId,
      driverId: parsed.driverId || null,
      status: parsed.driverId ? "assigned" : "pending",
      deliveryAddress: order[0].shippingAddress,
      scheduledAt: parsed.scheduledAt ? new Date(parsed.scheduledAt) : null,
      routeSequence: parsed.routeSequence != null ? String(parsed.routeSequence) : null,
    })
    .returning({ id: schema.dispatches.id });

  revalidatePath("/delivery");
  revalidatePath(`/orders/${parsed.orderId}`);
  return { id: row.id };
}

const assignSchema = z.object({
  dispatchId: z.string().uuid(),
  driverId: z.string().uuid(),
});

export async function assignDriver(input: z.input<typeof assignSchema>) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "dispatch.assign");
  const parsed = assignSchema.parse(input);

  await db
    .update(schema.dispatches)
    .set({ driverId: parsed.driverId, status: "assigned" })
    .where(and(eq(schema.dispatches.orgId, org.id), eq(schema.dispatches.id, parsed.dispatchId)));
  revalidatePath("/delivery");
}

const statusSchema = z.object({
  dispatchId: z.string().uuid(),
  status: z.enum(["pending", "assigned", "loaded", "in_transit"]),
});

export async function updateDispatchStatus(input: z.input<typeof statusSchema>) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "dispatch.deliver");
  const parsed = statusSchema.parse(input);
  const patch: Record<string, unknown> = { status: parsed.status };
  if (parsed.status === "in_transit") patch.dispatchedAt = new Date();
  await db
    .update(schema.dispatches)
    .set(patch)
    .where(and(eq(schema.dispatches.orgId, org.id), eq(schema.dispatches.id, parsed.dispatchId)));
  revalidatePath("/delivery");
}

const deliverSchema = z.object({
  dispatchId: z.string().uuid(),
  recipientName: z.string().min(1).max(120),
  deliveryNotes: z.string().max(2000).optional().or(z.literal("")),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  // data-url base64 strings — uploaded to Supabase Storage here
  proofImageDataUrl: z.string().optional().or(z.literal("")),
  signatureDataUrl: z.string().optional().or(z.literal("")),
});

async function uploadDataUrl(
  orgId: string,
  dispatchId: string,
  kind: "proof" | "signature",
  dataUrl: string,
): Promise<string | null> {
  if (!dataUrl) return null;
  const match = /^data:(.+?);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const ext = mime.split("/")[1] ?? "png";
  const path = `${orgId}/${dispatchId}/${kind}-${Date.now()}.${ext}`;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage
    .from("dispatch-proofs")
    .upload(path, buffer, { contentType: mime, upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from("dispatch-proofs").getPublicUrl(path);
  return data.publicUrl;
}

export async function markDelivered(input: z.input<typeof deliverSchema>) {
  const { org, user, role } = await requireActiveOrg();
  assertCan(role as Role, "dispatch.deliver");
  const parsed = deliverSchema.parse(input);

  const proofUrl = await uploadDataUrl(
    org.id,
    parsed.dispatchId,
    "proof",
    parsed.proofImageDataUrl ?? "",
  );
  const sigUrl = await uploadDataUrl(
    org.id,
    parsed.dispatchId,
    "signature",
    parsed.signatureDataUrl ?? "",
  );

  const [d] = await db
    .update(schema.dispatches)
    .set({
      status: "delivered",
      deliveredAt: new Date(),
      recipientName: parsed.recipientName,
      deliveryNotes: parsed.deliveryNotes || null,
      latitude: parsed.latitude != null ? String(parsed.latitude) : null,
      longitude: parsed.longitude != null ? String(parsed.longitude) : null,
      proofImageUrl: proofUrl,
      signatureUrl: sigUrl,
    })
    .where(and(eq(schema.dispatches.orgId, org.id), eq(schema.dispatches.id, parsed.dispatchId)))
    .returning({ orderId: schema.dispatches.orderId });
  if (!d) throw new Error("Dispatch not found");

  // Auto-transition order to a stage with effect='consume' if one exists.
  const consumeStage = await db
    .select()
    .from(schema.orderStages)
    .where(and(eq(schema.orderStages.orgId, org.id), eq(schema.orderStages.effect, "consume")))
    .limit(1);
  if (consumeStage.length) {
    const target = consumeStage[0];
    const current = await db
      .select({ stageId: schema.orders.stageId })
      .from(schema.orders)
      .where(eq(schema.orders.id, d.orderId))
      .limit(1);
    if (current[0]?.stageId !== target.id) {
      await db
        .update(schema.orders)
        .set({ stageId: target.id, updatedAt: new Date() })
        .where(eq(schema.orders.id, d.orderId));
      await db.insert(schema.orderStageHistory).values({
        orgId: org.id,
        orderId: d.orderId,
        fromStageId: current[0]?.stageId ?? null,
        toStageId: target.id,
        changedBy: user.id,
        note: `Delivered to ${parsed.recipientName}`,
      });
      await applyStageEffect({
        orgId: org.id,
        orderId: d.orderId,
        effect: "consume",
        userId: user.id,
      });
    }
  }

  revalidatePath("/delivery");
  revalidatePath(`/delivery/${parsed.dispatchId}`);
  revalidatePath(`/orders/${d.orderId}`);
}
