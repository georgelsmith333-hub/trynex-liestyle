import { pgTable, serial, text, integer, boolean, numeric, timestamp, jsonb, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const adminTable = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminSessionsTable = pgTable("admin_sessions", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  adminId: integer("admin_id").references(() => adminTable.id, { onDelete: "set null" }),
  role: text("role").notNull().default("admin"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  userAgent: text("user_agent"),
  ip: text("ip"),
}, (table) => ({
  adminIdIdx: index("admin_sessions_admin_id_idx").on(table.adminId),
  expiresAtIdx: index("admin_sessions_expires_at_idx").on(table.expiresAt),
  roleCheck: check("admin_sessions_role_check", sql`${table.role} IN ('admin')`),
}));

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
}, (table) => ({
  slugIdx: index("categories_slug_idx").on(table.slug),
}));

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  discountPrice: numeric("discount_price", { precision: 10, scale: 2 }),
  categoryId: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
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
  colorVariants: jsonb("color_variants").default([]),
  // Structured sellable variants: mug handle/rim or apparel fit/color/size.
  // Kept separate from colorVariants for backward compatibility.
  variants: jsonb("variants").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  categoryIdIdx: index("products_category_id_idx").on(table.categoryId),
  featuredIdx: index("products_featured_idx").on(table.featured),
  createdAtIdx: index("products_created_at_idx").on(table.createdAt),
  priceCheck: check("products_price_check", sql`${table.price} >= 0`),
  discountPriceCheck: check("products_discount_price_check", sql`${table.discountPrice} IS NULL OR ${table.discountPrice} >= 0`),
  stockCheck: check("products_stock_check", sql`${table.stock} >= 0`),
  ratingCheck: check("products_rating_check", sql`${table.rating} >= 0 AND ${table.rating} <= 5`),
  reviewCountCheck: check("products_review_count_check", sql`${table.reviewCount} >= 0`),
}));

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
  customerId: integer("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
  // Set when one or more customer-uploaded design files failed to copy from
  // the temp staging area into the order's permanent folder. Order is still
  // created, but admin must follow up to recover the source artwork.
  studioAssetsMissing: boolean("studio_assets_missing").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  customerIdIdx: index("orders_customer_id_idx").on(table.customerId),
  statusIdx: index("orders_status_idx").on(table.status),
  createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
  subtotalCheck: check("orders_subtotal_check", sql`${table.subtotal} >= 0`),
  shippingCostCheck: check("orders_shipping_cost_check", sql`${table.shippingCost} >= 0`),
  totalCheck: check("orders_total_check", sql`${table.total} >= 0`),
  statusCheck: check("orders_status_check", sql`${table.status} IN ('pending', 'processing', 'ongoing', 'shipped', 'delivered', 'cancelled')`),
  paymentStatusCheck: check("orders_payment_status_check", sql`${table.paymentStatus} IN ('pending', 'submitted', 'verified', 'paid', 'not_paid', 'wrong', 'refunded')`),
}));

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
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  publishedIdx: index("blog_posts_published_idx").on(table.published),
  featuredIdx: index("blog_posts_featured_idx").on(table.featured),
  createdAtIdx: index("blog_posts_created_at_idx").on(table.createdAt),
  viewCountCheck: check("blog_posts_view_count_check", sql`${table.viewCount} >= 0`),
}));

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
  guestSequence: integer("guest_sequence").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("customers_email_idx").on(table.email),
  guestSequenceIdx: index("customers_guest_sequence_idx").on(table.guestSequence),
}));

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
}, (table) => ({
  starsCheck: check("testimonials_stars_check", sql`${table.stars} >= 1 AND ${table.stars} <= 5`),
  sortOrderCheck: check("testimonials_sort_order_check", sql`${table.sortOrder} >= 0`),
}));

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
}, (table) => ({
  discountTypeCheck: check("promo_codes_discount_type_check", sql`${table.discountType} IN ('percentage', 'fixed', 'free_shipping', 'combo')`),
  discountValueCheck: check("promo_codes_discount_value_check", sql`${table.discountValue} >= 0`),
  minOrderAmountCheck: check("promo_codes_min_order_amount_check", sql`${table.minOrderAmount} >= 0`),
  maxUsesCheck: check("promo_codes_max_uses_check", sql`${table.maxUses} >= 0`),
  usedCountCheck: check("promo_codes_used_count_check", sql`${table.usedCount} >= 0`),
}));

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  rating: integer("rating").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  approved: boolean("approved").default(false),
  orderId: integer("order_id").references(() => ordersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index("reviews_product_id_idx").on(table.productId),
  customerIdIdx: index("reviews_customer_id_idx").on(table.customerId),
  orderIdIdx: index("reviews_order_id_idx").on(table.orderId),
  ratingCheck: check("reviews_rating_check", sql`${table.rating} >= 1 AND ${table.rating} <= 5`),
}));

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
}, (table) => ({
  basePriceCheck: check("hamper_packages_base_price_check", sql`${table.basePrice} >= 0`),
  discountPriceCheck: check("hamper_packages_discount_price_check", sql`${table.discountPrice} IS NULL OR ${table.discountPrice} >= 0`),
  stockCheck: check("hamper_packages_stock_check", sql`${table.stock} >= 0`),
  sortOrderCheck: check("hamper_packages_sort_order_check", sql`${table.sortOrder} >= 0`),
}));

export const customerPasswordResetTokensTable = pgTable("customer_password_reset_tokens", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  customerIdIdx: index("customer_password_reset_tokens_customer_id_idx").on(table.customerId),
}));

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
}, (table) => ({
  usedCountCheck: check("referrals_used_count_check", sql`${table.usedCount} >= 0`),
  totalEarningsCheck: check("referrals_total_earnings_check", sql`${table.totalEarnings} >= 0`),
}));

export const adminActivityLogsTable = pgTable("admin_activity_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => adminTable.id, { onDelete: "set null" }),
  action: text("action").notNull(), // create | update | delete | rollback
  entity: text("entity").notNull(), // product | order | blog | category | setting | hamper | promo | review
  entityId: text("entity_id"),
  entityName: text("entity_name"),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  adminIdIdx: index("admin_activity_logs_admin_id_idx").on(table.adminId),
  createdAtIdx: index("admin_activity_logs_created_at_idx").on(table.createdAt),
  actionCheck: check("admin_activity_logs_action_check", sql`${table.action} IN ('create', 'update', 'delete', 'rollback')`),
}));

export const newsletterSubscribersTable = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  source: text("source").notNull().default("footer"),
  ip: text("ip"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("newsletter_subscribers_email_idx").on(table.email),
}));

export const designDraftsTable = pgTable("design_drafts", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  payload: jsonb("payload").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  customerIdIdx: index("design_drafts_customer_id_idx").on(table.customerId),
}));

export const orderMessagesTable = pgTable("order_messages", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  senderType: text("sender_type").notNull(),
  senderName: text("sender_name"),
  message: text("message").notNull(),
  attachmentUrl: text("attachment_url"),
  readByAdmin: boolean("read_by_admin").notNull().default(false),
  readByCustomer: boolean("read_by_customer").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  orderIdIdx: index("order_messages_order_id_idx").on(table.orderId),
  senderTypeCheck: check("order_messages_sender_type_check", sql`${table.senderType} IN ('admin', 'customer', 'system')`),
}));

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("general"),
  link: text("link"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  customerIdIdx: index("notifications_customer_id_idx").on(table.customerId),
  readIdx: index("notifications_read_idx").on(table.read),
  createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
  typeCheck: check("notifications_type_check", sql`${table.type} IN ('general', 'order', 'promo', 'system')`),
}));

export const mockupsTable = pgTable("mockups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  productId: integer("product_id").references(() => productsTable.id, { onDelete: "set null" }),
  productName: text("product_name"),
  imageUrl: text("image_url").notNull(),
  thumbUrl: text("thumb_url"),
  /** Optional editable PSD/PSB master retained for admin round-tripping. */
  masterFileUrl: text("master_file_url"),
  masterFileName: text("master_file_name"),
  masterFileMime: text("master_file_mime"),
  masterFileSize: integer("master_file_size"),
  masterFileSha256: text("master_file_sha256"),
  /** Versioned source-kit binding consumed by preview/export integrations. */
  sourceKitKey: text("source_kit_key"),
  face: text("face"),
  color: text("color"),
  manifestJson: jsonb("manifest_json"),
  ingestionStatus: text("ingestion_status").notNull().default("preview-only"),
  ingestionError: text("ingestion_error"),
  tags: jsonb("tags").default([]),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index("mockups_product_id_idx").on(table.productId),
  sortOrderCheck: check("mockups_sort_order_check", sql`${table.sortOrder} >= 0`),
}));

export const spinWalletsTable = pgTable("spin_wallets", {
  id: serial("id").primaryKey(),
  subjectKey: text("subject_key").notNull().unique(),
  customerId: integer("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
  guestTokenHash: text("guest_token_hash").unique(),
  freeTickets: integer("free_tickets").notNull().default(0),
  dailySpinClaimedAt: timestamp("daily_spin_claimed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  customerIdIdx: index("spin_wallets_customer_id_idx").on(table.customerId),
  guestTokenHashIdx: index("spin_wallets_guest_token_hash_idx").on(table.guestTokenHash),
  freeTicketsCheck: check("spin_wallets_free_tickets_check", sql`${table.freeTickets} >= 0`),
}));

export const spinEntitlementEventsTable = pgTable("spin_entitlement_events", {
  id: serial("id").primaryKey(),
  subjectKey: text("subject_key").notNull(),
  customerId: integer("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
  orderId: integer("order_id").references(() => ordersTable.id, { onDelete: "set null" }),
  sourceKey: text("source_key").notNull().unique(),
  sourceType: text("source_type").notNull(),
  quantity: integer("quantity").notNull(),
  direction: text("direction").notNull().default("grant"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  subjectKeyIdx: index("spin_entitlement_events_subject_key_idx").on(table.subjectKey),
  orderIdIdx: index("spin_entitlement_events_order_id_idx").on(table.orderId),
  quantityCheck: check("spin_entitlement_events_quantity_check", sql`${table.quantity} > 0`),
  sourceTypeCheck: check("spin_entitlement_events_source_type_check", sql`${table.sourceType} IN ('daily', 'purchase', 'manual')`),
  directionCheck: check("spin_entitlement_events_direction_check", sql`${table.direction} IN ('grant', 'reversal')`),
}));

export const spinPlaysTable = pgTable("spin_plays", {
  id: serial("id").primaryKey(),
  subjectKey: text("subject_key").notNull(),
  customerId: integer("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  entitlementType: text("entitlement_type").notNull(),
  status: text("status").notNull().default("reserved"),
  rewardCode: text("reward_code"),
  rewardPayload: jsonb("reward_payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  settledAt: timestamp("settled_at"),
}, (table) => ({
  subjectKeyIdx: index("spin_plays_subject_key_idx").on(table.subjectKey),
  statusCheck: check("spin_plays_status_check", sql`${table.status} IN ('reserved', 'settled', 'failed', 'cancelled')`),
  entitlementTypeCheck: check("spin_plays_entitlement_type_check", sql`${table.entitlementType} IN ('daily', 'ticket')`),
}));

export type Admin = typeof adminTable.$inferSelect;
export type InsertAdmin = typeof adminTable.$inferInsert;
export type AdminSession = typeof adminSessionsTable.$inferSelect;
export type InsertAdminSession = typeof adminSessionsTable.$inferInsert;
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
export type HamperPackage = typeof hamperPackagesTable.$inferInsert;
export type InsertHamperPackage = typeof hamperPackagesTable.$inferInsert;
export type AdminActivityLog = typeof adminActivityLogsTable.$inferSelect;
export type CustomerPasswordResetToken = typeof customerPasswordResetTokensTable.$inferSelect;
export type DesignDraft = typeof designDraftsTable.$inferSelect;
export type InsertDesignDraft = typeof designDraftsTable.$inferInsert;
export type OrderMessage = typeof orderMessagesTable.$inferSelect;
export type InsertOrderMessage = typeof orderMessagesTable.$inferInsert;
export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = typeof notificationsTable.$inferInsert;
export type Mockup = typeof mockupsTable.$inferSelect;
export type SpinWallet = typeof spinWalletsTable.$inferSelect;
export type InsertSpinWallet = typeof spinWalletsTable.$inferInsert;
export type SpinEntitlementEvent = typeof spinEntitlementEventsTable.$inferSelect;
export type InsertSpinEntitlementEvent = typeof spinEntitlementEventsTable.$inferInsert;
export type SpinPlay = typeof spinPlaysTable.$inferSelect;
export type InsertSpinPlay = typeof spinPlaysTable.$inferInsert;
export type InsertMockup = typeof mockupsTable.$inferInsert;
