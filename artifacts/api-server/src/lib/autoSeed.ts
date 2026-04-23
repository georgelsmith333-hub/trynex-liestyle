import { db, categoriesTable, productsTable, settingsTable, adminTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import * as crypto from "crypto";
import { logger } from "./logger";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "trynex_salt_2024").digest("hex");
}

// Re-export the migration runner under its historical name so callers
// (artifacts/api-server/src/index.ts) keep working unchanged.
export { runMigrations } from "./migrationRunner";

async function seedHampersIfEmpty(): Promise<void> {
  try {
    const existing = await db.execute(sql`SELECT COUNT(*)::int AS c FROM hamper_packages`);
    const count = (existing as any).rows?.[0]?.c ?? 0;
    if (count > 0) return;

    await db.execute(sql`
      INSERT INTO hamper_packages (slug, name, name_bn, description, category, occasion, image_url, base_price, discount_price, items, featured, sort_order, stock) VALUES
      ('birthday-classic', 'Birthday Classic Hamper', 'জন্মদিনের ক্লাসিক হ্যাম্পার',
       'Curated birthday surprise — premium mug, custom t-shirt, and a handwritten card.',
       'celebration', 'Birthday',
       'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=800&q=80',
       1799, 1499,
       '[{"name":"Premium Ceramic Mug","quantity":1},{"name":"Custom Birthday T-Shirt","quantity":1},{"name":"Handwritten Birthday Card","quantity":1},{"name":"Chocolate Bar","quantity":2}]'::jsonb,
       true, 1, 50),
      ('anniversary-romance', 'Anniversary Romance Hamper', 'বিবাহবার্ষিকীর রোমান্স হ্যাম্পার',
       'Celebrate love with a curated keepsake bundle — engraved mug, photo frame, and roses.',
       'celebration', 'Anniversary',
       'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&q=80',
       2499, 1999,
       '[{"name":"Engraved Couple Mug Set","quantity":1},{"name":"Wooden Photo Frame","quantity":1},{"name":"Velvet Rose Bouquet","quantity":1},{"name":"Personalized Card","quantity":1}]'::jsonb,
       true, 2, 40),
      ('corporate-premium', 'Corporate Premium Hamper', 'কর্পোরেট প্রিমিয়াম হ্যাম্পার',
       'Impress clients and team — branded notebook, premium pen, mug, and gourmet snacks.',
       'corporate', 'Corporate',
       'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=800&q=80',
       3499, 2999,
       '[{"name":"Branded Leather Notebook","quantity":1},{"name":"Premium Metal Pen","quantity":1},{"name":"Corporate Logo Mug","quantity":1},{"name":"Gourmet Snack Box","quantity":1},{"name":"Thank-You Card","quantity":1}]'::jsonb,
       true, 3, 100)
      ON CONFLICT (slug) DO NOTHING
    `);
    logger.info("Seeded 3 demo gift hampers");
  } catch (err) {
    logger.error({ err }, "Hamper seed failed — continuing startup anyway");
  }
}

export async function autoSeedIfEmpty(): Promise<void> {
  try {
    await seedHampersIfEmpty();

    const existingProducts = await db.select().from(productsTable).limit(1);
    if (existingProducts.length > 0) {
      return;
    }

    logger.info("Database is empty — running auto-seed for production...");

    const adminExists = await db.select().from(adminTable).limit(1);
    if (adminExists.length === 0) {
      await db.insert(adminTable).values({
        username: "admin",
        passwordHash: hashPassword("admin123"),
      });
    }

    const settingsData = [
      { key: "siteName", value: "TryNex Lifestyle" },
      { key: "tagline", value: "You imagine, we craft" },
      { key: "phone", value: "01903426915" },
      { key: "email", value: "hello@trynexlifestyle.com" },
      { key: "address", value: "Mirpur, Dhaka, Bangladesh" },
      { key: "facebookUrl", value: "https://facebook.com/trynexlifestyle" },
      { key: "instagramUrl", value: "https://instagram.com/trynexlifestyle" },
      { key: "heroTitle", value: "Premium Custom Apparel" },
      { key: "heroSubtitle", value: "T-Shirts, Mugs, Caps & More – Made Just For You" },
      { key: "announcementBar", value: "🎉 Free delivery on orders above ৳1500! | COD available | WhatsApp: 01903426915" },
      { key: "freeShippingThreshold", value: "1500" },
    ];

    for (const s of settingsData) {
      await db.insert(settingsTable).values(s).onConflictDoUpdate({
        target: settingsTable.key,
        set: { value: s.value, updatedAt: new Date() },
      });
    }

    const categories = [
      { name: "T-Shirts", slug: "t-shirts", description: "Custom printed t-shirts for all occasions", imageUrl: "/images/cat-tshirt.png" },
      { name: "Hoodies", slug: "hoodies", description: "Premium quality hoodies with custom designs", imageUrl: "/images/cat-hoodie.png" },
      { name: "Mugs", slug: "mugs", description: "Personalized mugs perfect for gifts", imageUrl: "/images/cat-mug.png" },
      { name: "Caps", slug: "caps", description: "Stylish caps with custom embroidery", imageUrl: "/images/cat-cap.png" },
      { name: "Custom Orders", slug: "custom-orders", description: "Special custom orders tailored to your needs", imageUrl: "/images/cat-tshirt.png" },
    ];

    const insertedCategories: { id: number; name: string; slug: string }[] = [];
    for (const cat of categories) {
      const existing = await db.select().from(categoriesTable).where(eq(categoriesTable.slug, cat.slug));
      if (existing.length > 0) {
        insertedCategories.push({ id: existing[0].id, name: existing[0].name, slug: existing[0].slug });
      } else {
        const [inserted] = await db.insert(categoriesTable).values(cat).returning();
        insertedCategories.push({ id: inserted.id, name: inserted.name, slug: inserted.slug });
      }
    }

    const catMap = Object.fromEntries(insertedCategories.map(c => [c.slug, c.id]));

    const products = [
      {
        name: "Classic White Tee",
        slug: "classic-white-tee",
        description: "Premium 100% cotton white t-shirt with custom print. Perfect for everyday wear. Comfortable fit with durable print quality.",
        price: "599",
        discountPrice: "499",
        categoryId: catMap["t-shirts"],
        imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80",
        images: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80"],
        sizes: ["S", "M", "L", "XL", "XXL"],
        colors: ["White", "Black", "Navy", "Red"],
        stock: 50,
        featured: true,
        rating: "4.8",
        reviewCount: 124,
        customizable: true,
        tags: ["bestseller", "cotton", "custom"],
      },
      {
        name: "Graphic Print Tee",
        slug: "graphic-print-tee",
        description: "Bold graphic print t-shirt with vibrant colors. Premium quality fabric with full-color printing.",
        price: "750",
        discountPrice: "649",
        categoryId: catMap["t-shirts"],
        imageUrl: "https://images.unsplash.com/photo-1503341338985-95e740a8ee8a?w=600&q=80",
        images: ["https://images.unsplash.com/photo-1503341338985-95e740a8ee8a?w=600&q=80"],
        sizes: ["S", "M", "L", "XL"],
        colors: ["Black", "White", "Grey"],
        stock: 35,
        featured: true,
        rating: "4.6",
        reviewCount: 87,
        customizable: true,
        tags: ["graphic", "trendy"],
      },
      {
        name: "Premium Pullover Hoodie",
        slug: "premium-pullover-hoodie",
        description: "Warm and cozy pullover hoodie with custom print. Made from high-quality fleece material. Perfect for winter.",
        price: "1499",
        discountPrice: "1299",
        categoryId: catMap["hoodies"],
        imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600&q=80",
        images: ["https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600&q=80"],
        sizes: ["S", "M", "L", "XL", "XXL"],
        colors: ["Black", "Grey", "Navy", "Maroon"],
        stock: 25,
        featured: true,
        rating: "4.9",
        reviewCount: 56,
        customizable: true,
        tags: ["hoodie", "premium", "winter"],
      },
      {
        name: "Zip-Up Hoodie",
        slug: "zip-up-hoodie",
        description: "Stylish zip-up hoodie with custom embroidery option. Features kangaroo pocket and adjustable hood.",
        price: "1699",
        categoryId: catMap["hoodies"],
        imageUrl: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&q=80",
        images: ["https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&q=80"],
        sizes: ["M", "L", "XL", "XXL"],
        colors: ["Black", "White"],
        stock: 20,
        featured: false,
        rating: "4.7",
        reviewCount: 34,
        customizable: false,
        tags: ["hoodie", "zipper"],
      },
      {
        name: "Personalized Photo Mug",
        slug: "personalized-photo-mug",
        description: "High-quality ceramic mug with your custom photo or text. 330ml capacity, microwave and dishwasher safe.",
        price: "449",
        discountPrice: "399",
        categoryId: catMap["mugs"],
        imageUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&q=80",
        images: ["https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&q=80"],
        sizes: [],
        colors: ["White", "Black"],
        stock: 100,
        featured: true,
        rating: "4.9",
        reviewCount: 203,
        customizable: true,
        tags: ["gift", "mug", "personalized"],
      },
      {
        name: "Magic Color-Changing Mug",
        slug: "magic-color-changing-mug",
        description: "Reveals your custom design when filled with hot liquid! Perfect surprise gift for loved ones.",
        price: "599",
        categoryId: catMap["mugs"],
        imageUrl: "https://images.unsplash.com/photo-1497515114629-f71d768fd07c?w=600&q=80",
        images: ["https://images.unsplash.com/photo-1497515114629-f71d768fd07c?w=600&q=80"],
        sizes: [],
        colors: ["Black"],
        stock: 60,
        featured: false,
        rating: "4.8",
        reviewCount: 89,
        customizable: true,
        tags: ["gift", "magic", "surprise"],
      },
      {
        name: "Custom Snapback Cap",
        slug: "custom-snapback-cap",
        description: "Trendy snapback cap with custom embroidery. Adjustable strap fits all head sizes. Premium material.",
        price: "799",
        discountPrice: "699",
        categoryId: catMap["caps"],
        imageUrl: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&q=80",
        images: ["https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&q=80"],
        sizes: ["One Size"],
        colors: ["Black", "Navy", "Red", "White"],
        stock: 40,
        featured: true,
        rating: "4.7",
        reviewCount: 67,
        customizable: true,
        tags: ["cap", "snapback", "custom"],
      },
      {
        name: "Classic Dad Hat",
        slug: "classic-dad-hat",
        description: "Comfortable dad hat with custom text embroidery. Soft and lightweight with adjustable strap.",
        price: "649",
        categoryId: catMap["caps"],
        imageUrl: "https://images.unsplash.com/photo-1533827432537-70133748f5c8?w=600&q=80",
        images: ["https://images.unsplash.com/photo-1533827432537-70133748f5c8?w=600&q=80"],
        sizes: ["One Size"],
        colors: ["Beige", "Black", "White", "Pink"],
        stock: 45,
        featured: false,
        rating: "4.5",
        reviewCount: 42,
        customizable: true,
        tags: ["cap", "dad-hat", "casual"],
      },
      {
        name: "Couple T-Shirt Set",
        slug: "couple-tshirt-set",
        description: "Matching couple t-shirt set with custom designs. Perfect for anniversaries and special occasions.",
        price: "999",
        discountPrice: "849",
        categoryId: catMap["custom-orders"],
        imageUrl: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&q=80",
        images: ["https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&q=80"],
        sizes: ["S", "M", "L", "XL"],
        colors: ["White", "Black"],
        stock: 30,
        featured: true,
        rating: "5.0",
        reviewCount: 28,
        customizable: true,
        tags: ["couple", "gift", "special"],
      },
    ];

    for (const product of products) {
      const existing = await db.select().from(productsTable).where(eq(productsTable.slug, product.slug));
      if (existing.length === 0) {
        await db.insert(productsTable).values(product as any);
      }
    }

    await db.execute(sql`
      UPDATE categories SET product_count = (
        SELECT COUNT(*) FROM products WHERE products.category_id = categories.id
      )
    `);

    logger.info({ count: products.length }, "Auto-seed complete");
  } catch (err) {
    logger.error({ err }, "Auto-seed failed — continuing startup anyway");
  }
}
