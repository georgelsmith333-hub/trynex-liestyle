import { Router, type IRouter } from "express";
import { db, ordersTable, productsTable, categoriesTable, settingsTable, blogPostsTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth";

const router: IRouter = Router();

router.get("/admin/export/orders-csv", requireAdmin, async (req, res) => {
  try {
    const orders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
    const headers = [
      "Order Number", "Date", "Customer Name", "Email", "Phone",
      "Address", "City", "District", "Payment Method", "Payment Status",
      "Order Status", "Items", "Subtotal", "Shipping", "Total", "Notes"
    ];
    const sanitizeCsv = (val: string) => {
      let s = String(val || '');
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = orders.map(o => {
      const items = (o.items as any[] || [])
        .map((i: any) => `${i.productName} x${i.quantity}${i.size ? ` (${i.size})` : ''}${i.color ? ` [${i.color}]` : ''}`)
        .join('; ');
      return [
        sanitizeCsv(o.orderNumber),
        sanitizeCsv(o.createdAt?.toISOString().split('T')[0] || ''),
        sanitizeCsv(o.customerName || ''),
        sanitizeCsv(o.customerEmail),
        sanitizeCsv(o.customerPhone),
        sanitizeCsv(o.shippingAddress || ''),
        sanitizeCsv(o.shippingCity || ''),
        sanitizeCsv(o.shippingDistrict || ''),
        sanitizeCsv(o.paymentMethod),
        sanitizeCsv(o.paymentStatus || ''),
        sanitizeCsv(o.status),
        sanitizeCsv(items),
        sanitizeCsv(String(o.subtotal)),
        sanitizeCsv(String(o.shippingCost || '0')),
        sanitizeCsv(String(o.total)),
        sanitizeCsv(o.notes || ''),
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="trynex-orders-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) {
    req.log.error({ err }, "Failed to export orders CSV");
    res.status(500).json({ error: "internal_error", message: "Export failed" });
  }
});

router.get("/admin/backup/export", requireAdmin, async (req, res) => {
  try {
    const [orders, products, categories, settings, blogPosts] = await Promise.all([
      db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)),
      db.select().from(productsTable).orderBy(desc(productsTable.createdAt)),
      db.select().from(categoriesTable),
      db.select().from(settingsTable),
      db.select().from(blogPostsTable).catch(() => []),
    ]);

    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { orders, products, categories, settings, blogPosts },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="trynex-backup-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(backup);
  } catch (err) {
    req.log.error({ err }, "Failed to export backup");
    res.status(500).json({ error: "internal_error", message: "Backup export failed" });
  }
});

router.post("/admin/backup/import", requireAdmin, async (req, res) => {
  try {
    const { data, version } = req.body;
    if (!data || !version) {
      res.status(400).json({ error: "validation_error", message: "Invalid backup file format" });
      return;
    }

    const results: Record<string, number> = {};

    if (data.categories?.length) {
      for (const cat of data.categories) {
        await db.insert(categoriesTable).values({
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          imageUrl: cat.imageUrl,
          productCount: cat.productCount || 0,
        }).onConflictDoNothing();
      }
      results.categories = data.categories.length;
    }

    if (data.products?.length) {
      for (const p of data.products) {
        await db.insert(productsTable).values({
          name: p.name,
          slug: p.slug,
          description: p.description,
          price: p.price?.toString(),
          discountPrice: p.discountPrice?.toString() || null,
          categoryId: p.categoryId,
          imageUrl: p.imageUrl,
          images: p.images || [],
          sizes: p.sizes || [],
          colors: p.colors || [],
          stock: p.stock || 0,
          featured: p.featured || false,
          customizable: p.customizable || false,
          tags: p.tags || [],
        }).onConflictDoNothing();
      }
      results.products = data.products.length;
    }

    if (data.orders?.length) {
      for (const o of data.orders) {
        await db.insert(ordersTable).values({
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          customerEmail: o.customerEmail,
          customerPhone: o.customerPhone,
          shippingAddress: o.shippingAddress,
          shippingCity: o.shippingCity,
          shippingDistrict: o.shippingDistrict,
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus,
          status: o.status,
          items: o.items,
          subtotal: o.subtotal?.toString(),
          shippingCost: o.shippingCost?.toString(),
          total: o.total?.toString(),
          notes: o.notes,
        }).onConflictDoNothing();
      }
      results.orders = data.orders.length;
    }

    if (data.settings?.length) {
      for (const s of data.settings) {
        await db.insert(settingsTable).values({
          key: s.key,
          value: s.value,
        }).onConflictDoUpdate({
          target: settingsTable.key,
          set: { value: s.value, updatedAt: new Date() },
        });
      }
      results.settings = data.settings.length;
    }

    if (data.blogPosts?.length) {
      for (const b of data.blogPosts) {
        await db.insert(blogPostsTable).values({
          title: b.title,
          slug: b.slug,
          excerpt: b.excerpt,
          content: b.content,
          imageUrl: b.imageUrl,
          author: b.author || 'TryNex Team',
          tags: b.tags || [],
          published: b.published || false,
        }).onConflictDoNothing();
      }
      results.blogPosts = data.blogPosts.length;
    }

    res.json({ success: true, imported: results });
  } catch (err) {
    req.log.error({ err }, "Failed to import backup");
    res.status(500).json({ error: "internal_error", message: "Backup import failed" });
  }
});

export default router;
