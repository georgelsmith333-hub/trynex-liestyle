import { pgTable, serial, text, integer, boolean, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";

export const adminTable = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  imageUrl: text("image_url"),
  productCount: integer("product_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  discountPrice: numeric("discount_price", { precision: 10, scale: 2 }),
  categoryId: integer("category_id"),
  imageUrl: text("image_url"),
  images: jsonb("images").default([]),
  sizes: jsonb("sizes").default([]),
  colors: jsonb("colors").default([]),
  stock: integer("stock").notNull().default(0),
  featured: boolean("featured").default(false),
  rating: numeric("rating", { precision: 3, scale: 2 }).default("0"),
  reviewCount: integer("review_count").default(0),
  customizable: boolean("customizable").default(false),
  tags: jsonb("tags").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  shippingAddress: text("shipping_address").notNull(),
  shippingCity: text("shipping_city"),
  shippingDistrict: text("shipping_district"),
  paymentMethod: text("payment_method").notNull(),
  paymentStatus: text("payment_status").notNull().default("pending"),
  status: text("status").notNull().default("pending"),
  items: jsonb("items").notNull().default([]),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  shippingCost: numeric("shipping_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  promoCode: text("promo_code"),
  promoDiscount: numeric("promo_discount", { precision: 10, scale: 2 }),
  customerId: integer("customer_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const blogPostsTable = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  author: text("author").default("TryNex Team"),
  authorBio: text("author_bio"),
  authorAvatarUrl: text("author_avatar_url"),
  category: text("category").default("General"),
  tags: text("tags").array().default([]),
  published: boolean("published").default(false),
  featured: boolean("featured").default(false),
  readingTimeOverride: integer("reading_time_override"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  facebookId: text("facebook_id").unique(),
  avatar: text("avatar"),
  verified: boolean("verified").default(false),
  isGuest: boolean("is_guest").default(false).notNull(),
  guestSequence: integer("guest_sequence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const testimonialsTable = pgTable("testimonials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull().default(""),
  location: text("location").notNull().default(""),
  stars: integer("stars").notNull().default(5),
  body: text("body").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const promoCodesTable = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull().default("percentage"),
  discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: numeric("min_order_amount", { precision: 10, scale: 2 }).default("0"),
  maxUses: integer("max_uses").default(0),
  usedCount: integer("used_count").default(0),
  expiresAt: timestamp("expires_at"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  rating: integer("rating").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  approved: boolean("approved").default(false),
  orderId: integer("order_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const hamperPackagesTable = pgTable("hamper_packages", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  nameBn: text("name_bn"),
  description: text("description"),
  descriptionBn: text("description_bn"),
  category: text("category").notNull().default("general"),
  occasion: text("occasion"),
  imageUrl: text("image_url"),
  images: jsonb("images").default([]),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  discountPrice: numeric("discount_price", { precision: 10, scale: 2 }),
  items: jsonb("items").notNull().default([]),
  isCustomizable: boolean("is_customizable").default(false),
  active: boolean("active").default(true),
  featured: boolean("featured").default(false),
  sortOrder: integer("sort_order").default(0),
  stock: integer("stock").default(100),
  tags: jsonb("tags").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  ownerName: text("owner_name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  ownerPhone: text("owner_phone"),
  referralCode: text("referral_code").notNull().unique(),
  usedCount: integer("used_count").default(0),
  totalEarnings: numeric("total_earnings", { precision: 10, scale: 2 }).default("0"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Admin = typeof adminTable.$inferSelect;
export type InsertAdmin = typeof adminTable.$inferInsert;
export type Setting = typeof settingsTable.$inferSelect;
export type Category = typeof categoriesTable.$inferSelect;
export type InsertCategory = typeof categoriesTable.$inferInsert;
export type Product = typeof productsTable.$inferSelect;
export type InsertProduct = typeof productsTable.$inferInsert;
export type Order = typeof ordersTable.$inferSelect;
export type InsertOrder = typeof ordersTable.$inferInsert;
export type BlogPost = typeof blogPostsTable.$inferSelect;
export type Customer = typeof customersTable.$inferSelect;
export type InsertCustomer = typeof customersTable.$inferInsert;
export type Testimonial = typeof testimonialsTable.$inferSelect;
export type InsertTestimonial = typeof testimonialsTable.$inferInsert;
export type PromoCode = typeof promoCodesTable.$inferSelect;
export type Review = typeof reviewsTable.$inferSelect;
export type Referral = typeof referralsTable.$inferSelect;
export type HamperPackage = typeof hamperPackagesTable.$inferSelect;
export type InsertHamperPackage = typeof hamperPackagesTable.$inferInsert;
