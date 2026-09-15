"use server";
import { revalidatePath } from "next/cache";
import { requireAdminPage } from "../../admin-access";
import { isAdminResourceId, parseProductStatus } from "../../admin-query";
import { changeProductStatus } from "@/modules/administration/infrastructure/change-product-status";

export async function updateProductStatus(formData: FormData) {
  const id = formData.get("id");
  const status = parseProductStatus(formData.get("status"));
  if (typeof id !== "string" || !isAdminResourceId(id) || !status)
    throw new Error("INVALID_CATALOG_INPUT");
  const { database, subject } = await requireAdminPage("catalog.write");
  await changeProductStatus({
    database,
    subject,
    productId: id,
    status,
  });
  revalidatePath("/admin/catalog");
}
