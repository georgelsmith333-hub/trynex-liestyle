import { db, categoriesTable, productsTable, settingsTable, adminTable, blogPostsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import * as crypto from "crypto";
import { logger } from "./logger";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "trynex_salt_2024").digest("hex");
}

// Re-export the migration runner under its historical name so callers
// (artifacts/api-server/src/index.ts) keep working unchanged.
export { runMigrations } from "./migrationRunner";

// Ensures core brand settings (siteName, tagline) always have non-empty values in DB.
// Runs every startup so a wiped/blank value gets re-seeded automatically.
async function seedCoreBrandSettings(): Promise<void> {
  const defaults: Record<string, string> = {
    siteName: "TryNex Lifestyle",
    tagline: "You imagine, we craft",
  };
  try {
    for (const [key, def] of Object.entries(defaults)) {
      const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
      const current = existing[0]?.value?.trim();
      if (!current) {
        await db.insert(settingsTable).values({ key, value: def }).onConflictDoUpdate({
          target: settingsTable.key,
          set: { value: def, updatedAt: new Date() },
        });
        logger.info({ key, value: def }, "Seeded missing brand setting");
      }
    }
  } catch (err) {
    logger.error({ err }, "Brand-setting seed failed — continuing startup anyway");
  }
}

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

/**
 * Spread a set of blog posts across a 6-month window (Nov 2025 – Apr 2026).
 * Returns the Date for the i-th post (0 = oldest, n-1 = newest).
 */
function blogPostDate(i: number, total: number): Date {
  const start = new Date("2025-11-05").getTime();
  const end   = new Date("2026-04-20").getTime();
  const fraction = total > 1 ? i / (total - 1) : 0;
  return new Date(start + Math.round(fraction * (end - start)));
}

async function seedBlogPostsIfEmpty(): Promise<void> {
  try {
    const posts: (typeof blogPostsTable.$inferInsert)[] = [
      {
        title: "10 Unique Birthday Gift Ideas with Custom Mugs",
        slug: "birthday-gift-ideas-custom-mugs",
        excerpt: "Struggling to find the perfect birthday gift? Discover how a personalised ceramic mug can become a heartfelt keepsake that lasts a lifetime.",
        imageUrl: "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=1200&q=80",
        author: "Nadia Rahman",
        authorBio: "Gift specialist and lifestyle writer at TryNex Lifestyle.",
        category: "Gift Ideas",
        tags: ["birthday", "custom mugs", "gift ideas", "personalized"],
        published: true,
        featured: true,
        readingTimeOverride: 6,
        content: `<h2>Why a Custom Mug Is the Ultimate Birthday Gift</h2>
<p>Every morning, the birthday person reaches for their mug and is reminded of you. A personalised ceramic mug is not just a vessel for tea or coffee — it is a daily dose of warmth and memory. At TryNex Lifestyle, we print high-resolution designs on 330 ml food-safe ceramic mugs that are microwave and dishwasher safe.</p>
<h2>10 Birthday Mug Ideas That Will Wow Them</h2>
<h3>1. A Photo Collage Mug</h3>
<p>Compile your favourite shared photos into a beautiful grid. Choose a 6-photo or 9-photo layout and add a birthday message beneath each image for maximum sentimentality.</p>
<h3>2. Inside Jokes &amp; Quotes</h3>
<p>That phrase only the two of you understand? Print it large and bold. Inside-joke mugs are 100% personal and impossible to replicate by any generic gift shop.</p>
<h3>3. Star Map of Their Birthday Night</h3>
<p>Generate a custom star map showing the exact constellation visible from their city on the night they were born. Frame it on a mug for a gift that is both beautiful and scientifically accurate.</p>
<h3>4. Career &amp; Hobby Themed Mugs</h3>
<p>A doctor's mug that reads "World's Best Healer," a footballer's mug with their jersey number, or a chef's mug with illustrated kitchen tools — profession-specific mugs show you paid attention to what matters most to them.</p>
<h3>5. Milestone Number Mugs</h3>
<p>Turning 30? 50? 18? Make the number the hero of the design with bold typography and the year they were born on the reverse side.</p>
<h3>6. Watercolour Portrait</h3>
<p>Upload a clear photo and we will artify it into a watercolour-style portrait that prints beautifully on ceramic. A guaranteed conversation-starter in any office.</p>
<h3>7. Family Recipe Mug</h3>
<p>Ask their mum or grandmother for their favourite recipe — biryani, khichuri, or even grandma's tea blend — and print it handwritten-style on the mug. Sentimental and practical.</p>
<h3>8. Bucket List Mug</h3>
<p>Print their bucket list on the outside of the mug. Every sip reminds them of what they are working towards. Pair it with a matching notebook for a truly thoughtful set.</p>
<h3>9. Magic Colour-Changing Mug</h3>
<p>For an extra wow factor, choose our colour-changing mug variant. It appears solid black until hot liquid is poured in — then the design blooms to life. Perfect for morning surprises.</p>
<h3>10. Couple Mug Set</h3>
<p>If the birthday person is in a relationship, gift a coordinated couple mug set with matching designs that only make full sense when placed side by side. A gift for both while honouring one birthday.</p>
<h2>How to Order Custom Mugs from TryNex Lifestyle</h2>
<p>Browse our mug collection, upload your design or photo in the 3D Design Studio, preview your mug in real time, and place your order. We deliver across all 64 districts of Bangladesh with free shipping on orders above ৳1500. Same-week delivery available in Dhaka.</p>
<h2>Frequently Asked Questions</h2>
<h3>How long does custom mug printing take?</h3>
<p>Standard orders are printed within 2–3 business days. Rush orders within Dhaka can be completed in 24 hours.</p>
<h3>Are TryNex mugs microwave safe?</h3>
<p>Yes. All our ceramic mugs are food-safe, microwave-safe, and dishwasher-safe. The print is sealed with a food-grade coating.</p>
<h3>What file format should I upload?</h3>
<p>PNG or JPG at a minimum of 300 DPI is ideal. SVG and PDF files are also accepted. Our studio team reviews every order before printing.</p>`,
      },
      {
        title: "The Ultimate Guide to Corporate Gift Hampers in Bangladesh",
        slug: "corporate-gift-hampers-bangladesh-guide",
        excerpt: "Build stronger business relationships with thoughtfully curated corporate gift hampers. Learn what to include, when to give, and how to brand them for maximum impact.",
        imageUrl: "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=1200&q=80",
        author: "Rafiqul Islam",
        authorBio: "Corporate branding consultant with 8 years of experience in Bangladesh's B2B market.",
        category: "Gift Ideas",
        tags: ["corporate gifts", "hampers", "business", "bangladesh"],
        published: true,
        featured: false,
        readingTimeOverride: 7,
        content: `<h2>Why Corporate Gifting Matters in Bangladesh's Business Culture</h2>
<p>In Bangladesh's relationship-driven business culture, a well-timed gift communicates respect, gratitude, and long-term partnership commitment. Companies that invest in quality corporate gifts see measurably stronger client retention and employee loyalty. The key is combining thoughtful curation with your brand identity.</p>
<h2>What Makes a Corporate Gift Hamper Exceptional</h2>
<p>Generic hampers with unbranded chocolates and pens are forgotten within a week. An exceptional corporate hamper has three qualities: personal relevance, brand visibility, and lasting utility.</p>
<h3>Brand Visibility Without Being Pushy</h3>
<p>A branded ceramic mug used every morning at the office is 250+ brand impressions per year. A branded notebook sits on desks during meetings. These items work harder than any billboard.</p>
<h3>Lasting Utility</h3>
<p>Choose items the recipient will use for months or years. Custom t-shirts, premium mugs, leather notebooks, quality pens, and branded caps all have long product lives that extend your brand's presence.</p>
<h2>Best Occasions for Corporate Gifting in Bangladesh</h2>
<ul>
<li><strong>Eid ul-Fitr and Eid ul-Adha</strong> — The most important gifting season. Order 3–4 weeks ahead.</li>
<li><strong>Bengali New Year (Pohela Boishakh)</strong> — A uniquely Bangladeshi occasion that clients appreciate being remembered on.</li>
<li><strong>Year-end client appreciation</strong> — December or January depending on fiscal year.</li>
<li><strong>Employee milestones</strong> — Work anniversaries, promotions, and project completions.</li>
<li><strong>New client onboarding</strong> — A welcome hamper makes a memorable first impression.</li>
</ul>
<h2>Building the Perfect Corporate Hamper</h2>
<p>The ideal budget range for a corporate gift hamper in Bangladesh is ৳1,500 to ৳5,000 per unit depending on your relationship with the recipient. A client you bill over ৳10 lakh per year deserves a premium hamper; a prospect you are nurturing warrants a thoughtful but modest package.</p>
<h3>Recommended Items to Include</h3>
<ul>
<li>Branded ceramic mug with company logo</li>
<li>Custom t-shirt or polo shirt in company colours</li>
<li>Branded leather or faux-leather notebook</li>
<li>Premium metal pen</li>
<li>Local artisan food items (honey, hilsa pickles, or premium tea from Sylhet)</li>
<li>A handwritten note on branded card</li>
</ul>
<h2>How TryNex Lifestyle Handles Bulk Corporate Orders</h2>
<p>We manage bulk orders of 10 to 10,000 units with consistent print quality, custom packaging, and district-wise delivery. Our dedicated corporate team provides a proofing service — you approve a physical sample before we run the full batch. WhatsApp us at 01903426915 or email hello@trynexlifestyle.com to get a custom quote.</p>`,
      },
      {
        title: "Eid Gift Ideas: Personalised Apparel for Every Budget",
        slug: "eid-gift-ideas-personalised-apparel",
        excerpt: "From budget-friendly custom mugs to luxury hoodie sets, discover the most thoughtful Eid gift ideas using personalised apparel that your loved ones will cherish long after the celebration.",
        imageUrl: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=1200&q=80",
        author: "Nadia Rahman",
        category: "Gift Ideas",
        tags: ["eid gifts", "personalised", "apparel", "budget gifts"],
        published: true,
        featured: true,
        readingTimeOverride: 5,
        content: `<h2>Make This Eid Unforgettable with Personalised Gifts</h2>
<p>Eid is the most joyous gifting occasion in Bangladesh. This year, move beyond generic perfumes and envelopes of taka — choose a personalised gift that tells the story of your relationship with the recipient.</p>
<h2>Budget Gifts Under ৳500</h2>
<h3>Custom Photo Mug</h3>
<p>A ceramic mug printed with a meaningful family photo or an Eid greeting message. Practical, personal, and budget-friendly at ৳399–৳449.</p>
<h3>Personalised Keychain or Fridge Magnet</h3>
<p>A small but memorable token. We print custom designs on metal keychains — perfect for the colleague or distant relative you want to remember without overspending.</p>
<h2>Mid-Range Gifts ৳500–৳1,500</h2>
<h3>Custom Graphic T-Shirt</h3>
<p>Order a family reunion tee with everyone's names, a funny couple slogan, or a traditional motif in contemporary typography. Available in all sizes from kids XS to adult 3XL.</p>
<h3>Couple Mug Set</h3>
<p>A matching set of two mugs — perfect for a newly married couple or parents celebrating their golden Eid together.</p>
<h3>Custom Cap</h3>
<p>A snapback or dad hat with the recipient's name or initials in embroidered-style printing. Stylish year-round.</p>
<h2>Premium Gifts ৳1,500 and Above</h2>
<h3>Custom Hoodie</h3>
<p>A premium fleece hoodie with a personalised design on the chest and their name on the sleeve — cosy, luxurious, and utterly unique.</p>
<h3>Family Hamper Bundle</h3>
<p>Curate a hamper with a custom mug, matching t-shirts for parents and children, and a personalised family portrait print. TryNex bundles start at ৳1,799.</p>
<h2>Ordering Tips for Eid</h2>
<p>Order at least 7–10 days before Eid for standard delivery. Dhaka rush orders can be accommodated within 48 hours. All orders above ৳1,500 qualify for free home delivery across Bangladesh.</p>`,
      },
      {
        title: "5 Reasons Custom T-Shirts Make Perfect Wedding Favours",
        slug: "custom-tshirts-wedding-favours-bangladesh",
        excerpt: "Move beyond conventional wedding favours. Discover why custom matching t-shirts are the keepsake your guests will still wear — and talk about — years later.",
        imageUrl: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1200&q=80",
        author: "Sumaiya Akter",
        authorBio: "Wedding planner and style writer based in Dhaka.",
        category: "Gift Ideas",
        tags: ["wedding", "custom t-shirts", "favours", "bangladesh weddings"],
        published: true,
        featured: false,
        readingTimeOverride: 5,
        content: `<h2>Why Wedding Favours Often Miss the Mark</h2>
<p>The traditional wedding favour — a box of sweets, a branded pen, or a small picture frame — is often forgotten within days of the event. Custom t-shirts solve this problem elegantly: they are wearable, photogenic, and infinitely more personal than a generic token.</p>
<h2>1. They Create Instant Wedding Photography Magic</h2>
<p>Imagine 50 family members in matching "Rahman Family Wedding 2025" t-shirts before the ceremony. The group photos become the most shared images on social media. Custom t-shirts create a visual identity for your wedding weekend that professional photographers love.</p>
<h2>2. They Are Budget-Friendly at Scale</h2>
<p>At TryNex Lifestyle, bulk t-shirt orders of 20+ pieces receive per-unit discounts starting at 15%. For a wedding of 100 guests, the per-unit cost can drop to ৳350–৳450 — less than most sweet boxes or traditional favours.</p>
<h2>3. They Double as Groomsmen and Bridesmaids Gifts</h2>
<p>Print your wedding party's names, roles, and a heartfelt message on the back. "Best Man: Khaled" or "Bridesmaid: Fariha" printed in elegant typography becomes a keepsake each person will treasure.</p>
<h2>4. They Work for Every Wedding Theme</h2>
<p>Whether you are planning a traditional Bengali wedding with kantha-motif prints or a modern destination wedding with minimalist typography, custom t-shirt designs adapt to any aesthetic. Our design team can translate your wedding invitation artwork directly onto fabric.</p>
<h2>5. The Memories Last Decades</h2>
<p>Guests will pull that t-shirt from the wardrobe five years later and relive the wedding weekend. Unlike disposable favours, a quality cotton t-shirt tells a story that only gets better with age.</p>
<h2>How to Order Wedding T-Shirts from TryNex</h2>
<p>Share your wedding date, guest count, design concept, and size distribution. Our team will create a digital proof within 24 hours. Minimum order: 10 pieces. Turnaround: 5–7 business days for orders up to 200 pieces.</p>`,
      },
      {
        title: "How to Choose the Right Custom T-Shirt for Your Brand",
        slug: "choose-right-custom-tshirt-for-brand",
        excerpt: "Not all t-shirts are created equal. Learn how fabric weight, print method, and fit interact to determine whether your branded tee ends up in a drawer or worn proudly every week.",
        imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80",
        author: "Shahriar Hossain",
        authorBio: "Apparel sourcing specialist with 10 years in Bangladesh's garment industry.",
        category: "Custom Apparel",
        tags: ["custom t-shirts", "brand", "fabric", "print quality"],
        published: true,
        featured: true,
        readingTimeOverride: 6,
        content: `<h2>The Problem with Generic Branded T-Shirts</h2>
<p>You have seen them at trade shows and corporate events: stiff, thin t-shirts with logos that crack after three washes. They end up in the bin within a month. A quality branded t-shirt, by contrast, becomes an employee's weekend staple — living brand ambassador for your business at zero ongoing cost.</p>
<h2>Understanding Fabric Weight</h2>
<p>Fabric weight is measured in grams per square metre (GSM). Lower GSM means lighter, sheerer, and more breathable — but also less durable. Higher GSM means heavier, more opaque, and better print retention.</p>
<ul>
<li><strong>120–150 GSM:</strong> Lightweight summer tees. Good for hot Bangladeshi weather, less ideal for heavy-duty printing.</li>
<li><strong>160–180 GSM:</strong> The sweet spot. Comfortable year-round, excellent print quality, durable after repeated washing. TryNex's standard tees fall in this range.</li>
<li><strong>200+ GSM:</strong> Premium structured tees. Best for brands positioning themselves as premium.</li>
</ul>
<h2>Cotton vs Cotton-Polyester Blends</h2>
<p>100% cotton tees feel luxurious and breathe well in heat but wrinkle easily and can shrink 5–8% after the first wash. 60/40 cotton-polyester blends resist shrinkage and wrinkle better, making them ideal for workwear. We pre-wash all tees before printing to prevent post-print shrinkage.</p>
<h2>Choosing Your Print Method</h2>
<h3>Screen Printing</h3>
<p>Best for: Large orders (20+ pieces) with 1–4 solid colours. Extremely durable — prints last the life of the garment with proper care. Most cost-effective for bulk orders.</p>
<h3>Direct-to-Garment (DTG)</h3>
<p>Best for: Full-colour photo prints, complex gradients, or small-batch orders. Prints look and feel like the fabric itself. Slight texture is normal.</p>
<h3>Sublimation</h3>
<p>Best for: Polyester or polyester-blend fabrics. Produces photographic-quality all-over prints. Not suitable for 100% cotton.</p>
<h2>Fit and Sizing for Bangladesh</h2>
<p>International sizing charts often run larger than what Bangladeshi body proportions require. TryNex uses South Asian sizing — our Medium corresponds to a 38–40 inch chest, not a 40–42 inch like some international brands. We recommend ordering size samples before placing a bulk corporate order.</p>
<h2>The TryNex Quality Promise</h2>
<p>Every shirt goes through a quality check before shipping: colorfastness test, seam inspection, and print clarity review. We reject and reprint any piece that does not meet our standards before it leaves our facility.</p>`,
      },
      {
        title: "Cotton vs Polyester: Which Fabric Is Best for Custom Printing?",
        slug: "cotton-vs-polyester-custom-printing-fabric",
        excerpt: "The fabric you choose determines how sharp, vibrant, and long-lasting your custom print will be. Here is a comprehensive breakdown of cotton, polyester, and blends for Bangladeshi conditions.",
        imageUrl: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1200&q=80",
        author: "Shahriar Hossain",
        category: "Custom Apparel",
        tags: ["fabric", "cotton", "polyester", "printing", "custom apparel"],
        published: true,
        featured: false,
        readingTimeOverride: 6,
        content: `<h2>Why Fabric Choice Is a Print Decision</h2>
<p>Most people choose their custom apparel fabric based on feel or price. But the fabric is also a print decision: different fibres absorb dye and ink differently, affecting colour vibrancy, edge sharpness, and wash durability. Getting this wrong means spending money on prints that fade in three months.</p>
<h2>Cotton: The Classic Choice</h2>
<p>Cotton is Bangladesh's native fibre — our entire RMG industry is built on it. For custom printing, cotton offers several advantages:</p>
<ul>
<li><strong>Superior ink absorption:</strong> Cotton fibres are highly absorbent, which means DTG and screen inks bond deeply to the fabric for a rich, matte finish.</li>
<li><strong>Skin comfort:</strong> In Bangladesh's hot, humid climate, cotton's breathability is unmatched.</li>
<li><strong>Print fidelity:</strong> Fine details and thin lines print crisply on tightly woven cotton.</li>
</ul>
<p><strong>Cotton's drawbacks:</strong> It shrinks (pre-shrunk tees mitigate this), wrinkles, and is not suitable for sublimation printing. It also takes longer to dry in monsoon conditions.</p>
<h2>Polyester: The Performance Fabric</h2>
<p>Polyester is the preferred choice for:</p>
<ul>
<li>All-over sublimation printing (polyester is required for sublimation)</li>
<li>Sports and activewear (moisture-wicking, fast-drying)</li>
<li>Flags and banners where colour saturation needs to be extreme</li>
</ul>
<p><strong>Polyester's drawbacks:</strong> It feels synthetic against the skin in hot weather, retains odour more readily than cotton, and DTG inks do not adhere as well — resulting in duller colours on polyester versus cotton for screen/DTG methods.</p>
<h2>Blends: The Pragmatic Middle Ground</h2>
<p>A 60/40 or 65/35 cotton-polyester blend offers a compromise that works well for most Bangladeshi buyers:</p>
<ul>
<li>Better dimensional stability (less shrinkage) than 100% cotton</li>
<li>Softer feel and better moisture management than 100% polyester</li>
<li>Good print quality for screen printing and DTG</li>
<li>Lower cost than premium ring-spun cotton</li>
</ul>
<h2>Our Recommendation for Bangladesh's Climate</h2>
<p>For casual and fashion wear: 100% ring-spun combed cotton (160–180 GSM). For corporate uniforms and sportswear: 60/40 cotton-polyester blend. For event and promotional tees where print impact is paramount: combed cotton for DTG, polyester for all-over sublimation.</p>`,
      },
      {
        title: "Complete Guide to T-Shirt Sizes in Bangladesh",
        slug: "tshirt-size-guide-bangladesh",
        excerpt: "International sizing charts cause confusion for Bangladeshi buyers. Here is TryNex's definitive local size guide, with measurement tips and common mistakes to avoid when ordering custom apparel.",
        imageUrl: "https://images.unsplash.com/photo-1503341338985-95e740a8ee8a?w=1200&q=80",
        author: "Nadia Rahman",
        category: "Custom Apparel",
        tags: ["sizing", "t-shirts", "guide", "custom apparel", "bangladesh"],
        published: true,
        featured: false,
        readingTimeOverride: 5,
        content: `<h2>Why Size Charts Confuse Bangladeshi Buyers</h2>
<p>Most online stores use American or European size charts where a "Medium" fits a 40–42 inch chest. In Bangladesh, the average adult male chest is 36–38 inches. This mismatch leads to enormous amounts of returned merchandise and disappointed customers. TryNex uses a locally calibrated size chart.</p>
<h2>TryNex Men's T-Shirt Size Guide</h2>
<p>All measurements are in inches. Measure the fullest part of your chest with a tape measure.</p>
<ul>
<li><strong>XS:</strong> Chest 34–35 | Length 26</li>
<li><strong>S:</strong> Chest 36–37 | Length 27</li>
<li><strong>M:</strong> Chest 38–39 | Length 28</li>
<li><strong>L:</strong> Chest 40–41 | Length 29</li>
<li><strong>XL:</strong> Chest 42–43 | Length 30</li>
<li><strong>XXL:</strong> Chest 44–45 | Length 31</li>
<li><strong>3XL:</strong> Chest 46–48 | Length 32</li>
</ul>
<h2>TryNex Women's T-Shirt Size Guide</h2>
<ul>
<li><strong>XS:</strong> Chest 30–31 | Length 24</li>
<li><strong>S:</strong> Chest 32–33 | Length 25</li>
<li><strong>M:</strong> Chest 34–35 | Length 26</li>
<li><strong>L:</strong> Chest 36–37 | Length 27</li>
<li><strong>XL:</strong> Chest 38–39 | Length 28</li>
<li><strong>XXL:</strong> Chest 40–41 | Length 29</li>
</ul>
<h2>How to Measure Yourself Correctly</h2>
<p>Use a soft measuring tape. Do not pull tight — leave 1 inch of ease. Measure your chest at the fullest point, usually across the nipples. For length, measure from the highest point of the shoulder seam straight down to the hem.</p>
<h2>Tips for Bulk Orders</h2>
<p>For corporate or event orders, we recommend a size distribution of roughly: 10% S, 30% M, 35% L, 20% XL, 5% XXL for a mixed adult group. For all-male groups, shift one size up. For all-female groups, shift half a size down from the male chart.</p>
<h2>What Happens If I Order the Wrong Size?</h2>
<p>For custom-printed items, exchanges are not available once printing is complete. Contact us via WhatsApp before placing your order if you are unsure — we will guide you through finding the correct size free of charge.</p>`,
      },
      {
        title: "Hoodie Season: Best Custom Hoodies for Bangladesh's Cool Months",
        slug: "custom-hoodies-bangladesh-winter-guide",
        excerpt: "Bangladesh's brief but beautiful winter season calls for cosy custom hoodies. Discover the best styles, fabrics, and print options for the season that runs November through February.",
        imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=1200&q=80",
        author: "Rafiqul Islam",
        category: "Custom Apparel",
        tags: ["hoodies", "winter", "custom", "bangladesh", "seasonal"],
        published: true,
        featured: false,
        readingTimeOverride: 5,
        content: `<h2>Bangladesh's Winter and Why Hoodies Work</h2>
<p>From mid-November to late February, temperatures in Dhaka and northern Bangladesh drop to 8–15°C at night and 18–22°C during the day. It is sweater weather without being harsh winter — the exact climate where a mid-weight hoodie (280–320 GSM fleece) is the most versatile garment in your wardrobe.</p>
<h2>Choosing Your Hoodie Style</h2>
<h3>Pullover Hoodie</h3>
<p>The classic. Full coverage, minimal visual interruption for front prints, and an uncluttered look. Best for bold chest logos, university names, and family slogans. Our fleece pullover starts at ৳1,299.</p>
<h3>Zip-Up Hoodie</h3>
<p>The zip divides any front print, so zip-ups work better with sleeve or back prints. They offer more temperature flexibility — unzip when the afternoon warms up. Our zip-up starts at ৳1,499.</p>
<h2>Best Fleece Weights for Bangladesh</h2>
<ul>
<li><strong>250–280 GSM:</strong> Lightweight fleece. Perfect for Dhaka winters where it rarely drops below 12°C. Good layering piece under a jacket.</li>
<li><strong>300–320 GSM:</strong> Medium-weight fleece. Ideal for north Bangladesh (Rajshahi, Rangpur) where winters are more pronounced. Comfortable on its own in cool evenings.</li>
<li><strong>350+ GSM:</strong> Heavy fleece. Generally too warm for Bangladesh except in the coldest nights in January.</li>
</ul>
<h2>Print Placement Options on Hoodies</h2>
<ul>
<li><strong>Chest front (left):</strong> Logo or monogram. Clean, professional look.</li>
<li><strong>Full chest front:</strong> Graphic print or large text. Statement piece.</li>
<li><strong>Back upper:</strong> University name, brand slogan, or event name.</li>
<li><strong>Sleeve:</strong> Subtle name or number print. Great for sports teams.</li>
<li><strong>Hood interior:</strong> A small print inside the hood for a luxury reveal.</li>
</ul>
<h2>Popular Custom Hoodie Themes in Bangladesh</h2>
<p>University batch hoodies, corporate winter uniforms, family reunion sets, couple matching hoodies, and sports team fleeces are our most ordered styles during the cool season. Order early — demand spikes in November and production queues extend.</p>`,
      },
      {
        title: "How to Build Brand Identity with Custom Corporate Uniforms",
        slug: "brand-identity-custom-corporate-uniforms",
        excerpt: "A well-designed uniform does more than dress your team — it communicates your company's values, builds customer trust, and creates powerful visual consistency across every touchpoint.",
        imageUrl: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&q=80",
        author: "Rafiqul Islam",
        category: "Business",
        tags: ["corporate uniforms", "brand identity", "business", "team apparel"],
        published: true,
        featured: true,
        readingTimeOverride: 7,
        content: `<h2>Uniforms as a Brand Investment, Not a Cost</h2>
<p>Many SMEs in Bangladesh treat uniforms as a compliance expense. Smart companies understand that a well-designed uniform is their cheapest and most consistent advertising medium. Every employee who wears your branded shirt is a walking billboard — in the office, at client meetings, in the street.</p>
<h2>The Psychology of Branded Uniforms</h2>
<p>Research consistently shows that uniformed staff are perceived as more competent, more trustworthy, and more professional than casually dressed counterparts. In service industries — hospitality, retail, delivery, healthcare — this perception directly drives sales and tips.</p>
<p>In Bangladesh's competitive retail landscape, a clearly uniformed staff in a garment shop or restaurant communicates ownership, accountability, and pride. Customers associate it with quality.</p>
<h2>Designing a Uniform That Reinforces Your Brand</h2>
<h3>Colour Consistency</h3>
<p>Use your exact brand colours — specified by Pantone code, CMYK value, or hex code — on every uniform item. Inconsistent colours across different garment batches erode brand perception. At TryNex, we match your colours within a ±2% Delta E tolerance.</p>
<h3>Logo Placement</h3>
<p>The industry standard for business shirts and tees is: primary logo on the left chest (heart side), text name or tagline on the back shoulder or along the collar. For polo shirts, an embroidered logo on the chest gives a premium feel.</p>
<h3>Typography and Hierarchy</h3>
<p>Use no more than two typefaces on a uniform. Your company name should be the largest element, followed by the tagline or department identifier. Avoid decorative fonts — they reduce legibility at a distance.</p>
<h2>Scaling Uniformed Teams in Bangladesh</h2>
<p>Startups often make the mistake of not standardising uniforms until they hire their 20th employee, by which point inconsistent purchases have created a visual mess. Our recommendation: design a uniform system from employee 5 onwards. The cost per unit at scale (50+ pieces) drops to a point where branded uniforms are more affordable than casual wear policies.</p>
<h2>TryNex Corporate Uniform Service</h2>
<p>We offer a dedicated corporate account service for businesses ordering 20+ pieces per season. Benefits include: dedicated account manager, free design consultation, priority production queue, and district-wise delivery nationwide. Contact our corporate team via WhatsApp or email for a no-obligation quote.</p>`,
      },
      {
        title: "Custom Logo Printing for Small Businesses in Dhaka",
        slug: "custom-logo-printing-small-businesses-dhaka",
        excerpt: "Running a small business in Dhaka? Here is how affordable custom logo printing on t-shirts, mugs, and caps can transform your brand visibility without a big marketing budget.",
        imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80",
        author: "Shahriar Hossain",
        category: "Business",
        tags: ["logo printing", "small business", "dhaka", "brand visibility", "custom"],
        published: true,
        featured: false,
        readingTimeOverride: 5,
        content: `<h2>The Small Business Branding Challenge</h2>
<p>Small businesses in Dhaka face a paradox: they need strong brand visibility to grow, but brand visibility campaigns cost money they do not yet have. Custom printed merchandise solves this problem elegantly — it is a one-time cost that generates ongoing impressions for months or years.</p>
<h2>What Can You Print Your Logo On?</h2>
<h3>T-Shirts</h3>
<p>The highest-impression item. A single branded t-shirt worn by an employee or loyal customer generates 500–1,000 impressions per week. At ৳499 per shirt, the cost-per-impression is fractions of a paisa — no digital ad can match that.</p>
<h3>Mugs</h3>
<p>Office mugs sit on desks during every meeting, generating brand impressions among clients and colleagues. A ৳399 mug generates years of daily brand exposure.</p>
<h3>Caps</h3>
<p>Branded caps travel further than any other item. They go to markets, restaurants, and family visits — all genuine out-of-home advertising at ৳699 per unit.</p>
<h2>Minimum Order Quantities for Small Businesses</h2>
<p>TryNex has no minimum order. You can order a single custom mug or t-shirt. For logo-printed items, however, we recommend a minimum batch of 10 pieces to benefit from our standard per-unit pricing. At 20+ pieces, per-unit costs drop 10–15%.</p>
<h2>File Requirements for Logo Printing</h2>
<p>Your logo should ideally be provided as a vector file (.ai, .eps, .svg) for the sharpest results. If you only have a JPG or PNG, ensure it is at least 300 DPI at the intended print size. Our design team reviews every file before printing and will contact you if quality is insufficient.</p>
<h2>Getting Started with TryNex</h2>
<p>Upload your logo in our 3D Design Studio, choose your product, customise the placement, and preview your order in real time before placing it. Orders above ৳1,500 ship free nationwide. Same-day processing in Dhaka available for orders placed before 10 AM.</p>`,
      },
      {
        title: "Why Every Startup Needs Branded Merchandise from Day One",
        slug: "startup-branded-merchandise-from-day-one",
        excerpt: "Building a startup culture and brand identity from the very first week sets a tone that compounds over years. Here is how branded merchandise creates belonging, buzz, and loyalty at minimal cost.",
        imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80",
        author: "Rafiqul Islam",
        category: "Business",
        tags: ["startup", "branded merchandise", "company culture", "brand"],
        published: true,
        featured: false,
        readingTimeOverride: 5,
        content: `<h2>Merchandise Is Not a Luxury — It Is a Foundation</h2>
<p>Many Bangladeshi startups wait until they are "big enough" to invest in branded merchandise. This is backwards. The best time to invest in branded items is when you have 5–10 employees and the culture is still being formed. The shared identity created by matching branded apparel is disproportionately powerful at this stage.</p>
<h2>What Branded Merchandise Does for Startups</h2>
<h3>Creates Instant Team Identity</h3>
<p>On the day a new employee joins, give them a branded t-shirt, a custom mug, and a notebook. It sounds small, but this physical expression of belonging creates an emotional connection to the company that no onboarding PDF can replicate.</p>
<h3>Turns Employees into Brand Ambassadors</h3>
<p>An employee who wears their company hoodie to a coffee shop, a family event, or a university reunion is doing organic brand marketing. At zero ongoing cost to the startup.</p>
<h3>Creates Conversation at Events</h3>
<p>At startup events, tech conferences, and industry meetups in Dhaka, uniformed startup teams stand out. Other attendees notice, approach, and ask questions. The branded item opens a conversation that a business card rarely does.</p>
<h2>The Startup Merchandise Starter Kit</h2>
<ul>
<li>Custom t-shirt for each founding team member (from ৳499)</li>
<li>Branded mug for each desk (from ৳399)</li>
<li>Branded cap for outdoor events and deliveries (from ৳699)</li>
<li>Total for a 5-person founding team: ৳7,985 — less than a single Facebook ad campaign</li>
</ul>
<h2>Ordering Process for Startups</h2>
<p>Share your logo and brand colours with our team. We will create three design concepts within 48 hours for you to approve. Production takes 5–7 days. We also offer a startup discount of 10% on first orders — WhatsApp 01903426915 to claim it.</p>`,
      },
      {
        title: "Employee Appreciation Gifts: Custom Apparel Your Team Will Love",
        slug: "employee-appreciation-gifts-custom-apparel",
        excerpt: "Employee recognition is one of the highest-ROI investments any business can make. Discover how custom apparel gifts create lasting loyalty — and why generic gift cards fall far short.",
        imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&q=80",
        author: "Sumaiya Akter",
        category: "Business",
        tags: ["employee gifts", "appreciation", "team building", "custom apparel"],
        published: true,
        featured: false,
        readingTimeOverride: 5,
        content: `<h2>The Real Cost of Unrecognised Employees</h2>
<p>Research across South Asian markets shows that employees who feel unrecognised are 63% more likely to look for a new job within 12 months. In Bangladesh's competitive job market — especially for skilled workers in tech, finance, and RMG management — losing a trained employee costs 50–200% of their annual salary in recruitment and retraining. A ৳1,500 appreciation gift that prevents one resignation pays for itself many times over.</p>
<h2>Why Custom Apparel Works Better than Gift Cards</h2>
<p>A gift card feels like cash — impersonal and transactional. A custom hoodie with the employee's name embroidered and a message like "3 Years of Excellence | TryNex Team" creates a trophy effect. It is visible, sharable, and says: <em>we thought specifically about you, not just your wallet.</em></p>
<h2>Best Occasions for Employee Apparel Gifts</h2>
<ul>
<li><strong>Work anniversaries (1, 3, 5, 10 years)</strong> — Milestone-specific designs with the employee's name and years of service.</li>
<li><strong>Promotions</strong> — A "Senior Manager" branded polo acknowledges their new role with pride.</li>
<li><strong>Project completions</strong> — "Project X — Done. December 2024" team tees celebrate collective achievement.</li>
<li><strong>Year-end bonuses supplement</strong> — A premium hoodie alongside the year-end bonus communicates both financial and personal appreciation.</li>
</ul>
<h2>Designing the Perfect Appreciation Apparel</h2>
<p>The most effective appreciation gifts are highly personalised. Include the employee's name, the specific milestone being celebrated, and the company logo. Add a handwritten note. This combination — personal detail + brand affiliation + human touch — is unbeatable for creating genuine emotional impact.</p>
<h2>TryNex Corporate Appreciation Programme</h2>
<p>We offer an annual appreciation programme for companies: register your employee data, and we will automatically produce and ship personalised anniversary gifts on each employee's milestone date. No administration burden on HR, consistent quality for every recipient. Contact us to enrol.</p>`,
      },
      {
        title: "How to Design the Perfect Logo for Screen Printing",
        slug: "design-logo-for-screen-printing",
        excerpt: "Not every logo design translates well onto fabric. Learn the design rules that ensure your logo looks crisp, vibrant, and professional when printed on t-shirts, hoodies, and caps.",
        imageUrl: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=1200&q=80",
        author: "Tasnim Haque",
        authorBio: "Graphic designer with 7 years in the custom apparel industry.",
        category: "Design Tips",
        tags: ["logo design", "screen printing", "graphic design", "printing"],
        published: true,
        featured: true,
        readingTimeOverride: 6,
        content: `<h2>Why "Print-Ready" Is Different from "Screen-Ready"</h2>
<p>A logo designed for digital screens uses RGB colours and can include gradients, drop shadows, outer glows, and fine details at 1px or less. Screen printing is a physical process — ink is pushed through a stencil mesh onto fabric — and these digital flourishes cause problems. Understanding what works in print versus what works on screen is the foundation of good apparel design.</p>
<h2>Rule 1: Limit Your Colour Count</h2>
<p>Each colour in a screen print requires its own separate stencil (called a screen) and its own pass through the printing machine. Two-colour jobs cost significantly less than four-colour jobs. As a rule of thumb:</p>
<ul>
<li><strong>1–2 colours:</strong> Lowest cost, cleanest result. Works for logos with strong shapes.</li>
<li><strong>3–4 colours:</strong> Good balance of visual richness and cost.</li>
<li><strong>5+ colours:</strong> Consider DTG printing instead, which handles full colour at no per-colour premium.</li>
</ul>
<h2>Rule 2: Avoid Ultra-Thin Lines</h2>
<p>Screen printing has a minimum line thickness of approximately 0.5mm at print size. Thinner lines may fill in or break. If your logo has fine detail — a thin serif font, hairline borders, or microscopic text — either bold it up or consider a simplified version of the logo for apparel use.</p>
<h2>Rule 3: Use Spot Colours (Pantone), Not CMYK</h2>
<p>Screen printing uses spot colours — premixed inks matched to Pantone codes. This ensures exact, repeatable colour matching across print runs. Always provide Pantone codes if possible, or at least specify your brand's hex code so our technician can match it accurately.</p>
<h2>Rule 4: Test on the Right Fabric Colour</h2>
<p>A white logo on a navy shirt is a different technical challenge than a white logo on a white shirt. For light designs on dark fabrics, an underbase layer of white ink is printed first to make colours pop. This adds cost but is essential for vibrancy. Check your contrast ratio before finalising your colour combination.</p>
<h2>Rule 5: Provide Vector Files</h2>
<p>Vector files (.ai, .eps, .svg) can be scaled to any size without loss of quality. Raster files (JPG, PNG) have a fixed pixel count — enlarging them introduces blur and pixelation. Always provide vector source files for logo printing. If you do not have vectors, our design team can recreate your logo in vector format for a small fee.</p>
<h2>Getting a Design Proof from TryNex</h2>
<p>Upload your logo or design idea in our studio. Our technician reviews every file before production and provides a digital proof for approval. We will flag any technical issues — insufficient resolution, problematic gradients, or non-printable colours — before a single shirt is touched.</p>`,
      },
      {
        title: "Colour Theory for Custom Apparel: What Works and What Does Not",
        slug: "colour-theory-custom-apparel-design",
        excerpt: "Choosing the right colour combination for your custom apparel is both science and art. Learn how contrast, fabric colour, and ink opacity interact to create designs that are bold, clear, and visually satisfying.",
        imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80",
        author: "Tasnim Haque",
        category: "Design Tips",
        tags: ["colour theory", "design", "custom apparel", "print design"],
        published: true,
        featured: false,
        readingTimeOverride: 6,
        content: `<h2>Why Colour Choice Determines Print Success</h2>
<p>Colour errors in apparel design are irreversible. A dark design on a dark shirt disappears. Warm orange on a red shirt becomes muddy. Understanding a few principles of colour theory will save you from expensive reprints and ensure your design makes the visual impact you intended.</p>
<h2>Contrast Is King</h2>
<p>The single most important rule in apparel colour design is contrast. Your design must be legible against the fabric colour from a normal viewing distance (2–3 metres). Test this by squinting at your digital mockup — if the design blurs into the background colour when slightly out of focus, the contrast is insufficient.</p>
<h2>The Fabric Colour Wheel</h2>
<p>Think of the garment colour as your canvas:</p>
<ul>
<li><strong>Dark fabrics (black, navy, forest green):</strong> Light inks pop most. White, yellow, cream, and light pastels are highly legible. Avoid dark blue on black or dark green on navy.</li>
<li><strong>Light fabrics (white, cream, light grey):</strong> Dark inks show best. Black, navy, dark red, and forest green are crisp and clean. Avoid yellow text on white — it nearly disappears.</li>
<li><strong>Mid-tones (medium grey, royal blue, maroon):</strong> Both light and dark inks work. Choose based on your brand palette.</li>
</ul>
<h2>Understanding Ink Opacity</h2>
<p>Plastisol ink (the standard for screen printing) is opaque — it sits on top of the fabric like a layer of paint. This means colour accuracy is high on light and dark fabrics alike. DTG ink is semi-transparent and is absorbed into the fabric — colours appear slightly different depending on the fabric colour underneath. When in doubt, order a colour proof.</p>
<h2>Warm vs Cool: Seasonal Considerations for Bangladesh</h2>
<p>Bangladesh's market responds differently to colours in different seasons. Summer collections (March–October) sell better in cool blues, greens, and whites. Winter collections (November–February) lean into warm maroons, forest greens, mustard yellows, and deep navy. Align your design palette with the seasonal mood for maximum market appeal.</p>
<h2>The Rule of Three</h2>
<p>Limit your design to three colours maximum for screen printing. A one-colour design often looks more sophisticated than a five-colour design, because clarity and intention read as confidence. Add colours only when they serve a functional purpose — not for the sake of variety.</p>`,
      },
      {
        title: "Vector vs Raster: Understanding Print File Formats",
        slug: "vector-vs-raster-print-file-formats",
        excerpt: "Sending the wrong file format to your print shop is the most common cause of blurry, pixelated prints. This guide explains the difference between vector and raster files and which one you need for custom apparel.",
        imageUrl: "https://images.unsplash.com/photo-1614624532983-4ce03382d63d?w=1200&q=80",
        author: "Tasnim Haque",
        category: "Design Tips",
        tags: ["vector", "raster", "file formats", "printing", "design"],
        published: true,
        featured: false,
        readingTimeOverride: 5,
        content: `<h2>The Pixelated Print Problem</h2>
<p>Every print shop in Bangladesh has seen it: a customer sends a logo screenshot they took from their Facebook page. At 72 DPI and 400×400 pixels, it looks fine on screen. When printed at 10 inches wide, it is a blurry, pixelated mess. Understanding why this happens — and how to prevent it — starts with understanding the two fundamental categories of digital image files.</p>
<h2>Raster Files: Pixels on a Grid</h2>
<p>Raster images (JPG, PNG, GIF, BMP, PSD) are made of a fixed grid of individual coloured pixels. They look sharp at the resolution they were created for but degrade when enlarged because the software must invent new pixels to fill the gaps — a process called interpolation that always reduces sharpness.</p>
<p><strong>Minimum raster file requirements for printing:</strong></p>
<ul>
<li>300 DPI minimum at the intended print size</li>
<li>A 4-inch print at 300 DPI requires a 1,200 × 1,200 pixel image minimum</li>
<li>A 10-inch print at 300 DPI requires a 3,000 × 3,000 pixel image minimum</li>
</ul>
<h2>Vector Files: Maths, Not Pixels</h2>
<p>Vector images (AI, EPS, SVG, PDF with embedded vectors) are defined by mathematical paths and curves rather than pixels. They can be scaled to any size — from a business card to a billboard — without any loss of sharpness. This is why professional logos are always created as vector files.</p>
<p><strong>Vector files are ideal for:</strong></p>
<ul>
<li>Logos and wordmarks</li>
<li>Geometric patterns and shapes</li>
<li>Text elements</li>
<li>Icons and pictograms</li>
</ul>
<h2>When Raster Is Acceptable for Printing</h2>
<p>Photographic designs (a person's face, a scenic landscape, detailed illustrations) must use raster files because photographs cannot be represented as vector paths. For these, ensure your PNG or JPG is at least 300 DPI at print size. TryNex accepts files up to 50 MB.</p>
<h2>How to Check If Your File Is Vector</h2>
<p>Open the file in any image viewer and zoom in to 400%. If the edges of text and shapes remain perfectly crisp, it is vector. If you see a staircase pattern of coloured squares, it is raster. When in doubt, email the file to our team at hello@trynexlifestyle.com and we will assess it for free.</p>`,
      },
      {
        title: "Typography Rules for Custom T-Shirt Designs",
        slug: "typography-rules-custom-tshirt-design",
        excerpt: "The text on your custom t-shirt says as much about your brand as the words themselves. Learn how font choice, size hierarchy, spacing, and placement turn typographic designs from amateur to professional.",
        imageUrl: "https://images.unsplash.com/photo-1481349518771-20055b2a7b24?w=1200&q=80",
        author: "Tasnim Haque",
        category: "Design Tips",
        tags: ["typography", "t-shirt design", "fonts", "graphic design"],
        published: true,
        featured: false,
        readingTimeOverride: 6,
        content: `<h2>Typography Is the Voice of Your Design</h2>
<p>When a t-shirt carries only text — a university name, a brand slogan, a personal motto — typography is the entire visual communication. The font you choose signals personality: a bold condensed sans-serif says confidence and modernity; a flowing script says elegance and warmth; a distressed hand-lettered style says authenticity and craft.</p>
<h2>The Three Personality Archetypes of Type</h2>
<h3>Sans-Serif (Clean and Modern)</h3>
<p>Fonts like Futura, Montserrat, and Helvetica. Best for: corporate brands, sports teams, modern event tees. These fonts maintain excellent legibility at a distance and reproduce cleanly at all sizes.</p>
<h3>Serif (Traditional and Authoritative)</h3>
<p>Fonts like Garamond, Georgia, and Playfair Display. Best for: educational institutions, heritage brands, premium products. Serifs add gravitas — use them when you want to convey tradition or expertise.</p>
<h3>Script (Warm and Personal)</h3>
<p>Fonts like Pacifico, Dancing Script, and Great Vibes. Best for: personalized gifts, family reunion tees, couple items. Scripts feel handmade and human — they communicate intimacy and care.</p>
<h2>Size Hierarchy: The 3-Level Rule</h2>
<p>On a well-designed t-shirt with multiple text elements, use three sizes only:</p>
<ul>
<li><strong>Hero text:</strong> The largest element. Often the brand name, team name, or key phrase. Fill 40–60% of the print area width.</li>
<li><strong>Secondary text:</strong> 50–65% the size of the hero. Tagline, year, city, or supporting information.</li>
<li><strong>Tertiary text:</strong> 30–40% of the hero. Fine print, URL, or detailed information.</li>
</ul>
<h2>Letter Spacing: The Secret Weapon</h2>
<p>Tracking (the overall letter spacing of a word) dramatically affects the feel of a text element. Tight tracking feels urgent and modern. Loose tracking (+100 to +300%) feels luxurious and premium. For all-uppercase text, always add at least +50% tracking — compressed uppercase feels aggressive and hard to read.</p>
<h2>Placement Guidelines for T-Shirts</h2>
<ul>
<li><strong>Chest: </strong>3–4 inches below the collar, centred or left-aligned. Standard position for logos and primary text.</li>
<li><strong>Back upper:</strong> 3 inches below the collar seam. Best for longer text, team names, and URLs.</li>
<li><strong>Sleeve:</strong> Horizontal or vertical placement, about 1/3 down from the shoulder seam.</li>
<li><strong>Hem:</strong> A subtle placement for small text elements — great for website URLs or founding year.</li>
</ul>
<h2>Test Your Design at Scale</h2>
<p>Open your design on your computer and step back 2 metres. If you can read it comfortably, the typography is working. If you have to squint or move closer, the font is too small or the contrast is insufficient. Our studio provides a 100% zoom preview at actual print size before every order.</p>`,
      },
      {
        title: "How to Care for Your Custom Printed T-Shirts",
        slug: "care-guide-custom-printed-tshirts",
        excerpt: "Custom prints can last for years — or fade after five washes. The difference is almost entirely in how you launder and store them. Follow this care guide to keep your prints vibrant for the long haul.",
        imageUrl: "https://images.unsplash.com/photo-1517292987719-0369a794ec0f?w=1200&q=80",
        author: "Nadia Rahman",
        category: "Lifestyle",
        tags: ["care guide", "custom t-shirts", "laundry", "print care"],
        published: true,
        featured: false,
        readingTimeOverride: 5,
        content: `<h2>Why Prints Fade — and How to Prevent It</h2>
<p>Custom apparel prints face two enemies: heat and agitation. High-temperature washing breaks down the polymer chains in plastisol and DTG inks. Aggressive spin cycles cause the print to flex repeatedly, eventually cracking. Understanding these two mechanisms helps you extend the life of your custom prints significantly.</p>
<h2>Washing Instructions</h2>
<h3>Turn the Shirt Inside Out</h3>
<p>This is the most important single step. Turning the shirt inside out before washing protects the print surface from direct contact with other fabrics and the drum of the washing machine. Make it a habit every single time.</p>
<h3>Use Cold Water (30°C Maximum)</h3>
<p>Hot water is the fastest way to fade a print. Most detergents work equally well in cold water. For heavily soiled shirts, 30°C is the maximum you should ever use on a printed garment.</p>
<h3>Choose a Gentle Cycle</h3>
<p>The gentle or delicate cycle reduces agitation. If you do not have a gentle cycle option, use a short spin duration. Avoid the heavy-duty cycle entirely for printed garments.</p>
<h3>Mild Detergent Only</h3>
<p>Avoid detergents with bleach, optical brighteners, or aggressive enzymes. These chemicals attack both the cotton fibres and the print inks. Mild liquid detergents (not powder) are ideal for custom prints.</p>
<h2>Drying Instructions</h2>
<h3>Air Dry in Shade</h3>
<p>Direct sunlight causes UV fading — the same process that bleaches fabrics left on a washing line for days. Dry your custom tees in a shaded area with good air circulation. In Bangladesh's humid climate during monsoon season, a fan helps speed drying without UV exposure.</p>
<h3>Avoid Tumble Dryers</h3>
<p>The high heat of a tumble dryer is the second-fastest way to damage a print (after bleach). If you must use a dryer, choose the lowest heat setting and remove the shirt while still slightly damp.</p>
<h2>Ironing Custom Prints</h2>
<p>Never iron directly on the print. If the shirt is wrinkled, turn it inside out and iron on the reverse side with a low-heat setting. For stubborn wrinkles, place a thin cotton cloth between the iron and the print surface.</p>
<h2>Storage</h2>
<p>Fold printed tees print-side in or hang them. Avoid leaving them compressed in a packed drawer for months — sustained pressure can cause the print to crack, especially in cold, dry conditions.</p>`,
      },
      {
        title: "Sustainable Fashion: Why Custom Apparel Is a Better Choice",
        slug: "sustainable-fashion-custom-apparel-bangladesh",
        excerpt: "Bangladesh is the world's second-largest garment exporter. As our industry grows, so does the conversation about sustainability. Here is how choosing custom, made-to-order apparel is an inherently more sustainable fashion decision.",
        imageUrl: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=1200&q=80",
        author: "Sumaiya Akter",
        category: "Lifestyle",
        tags: ["sustainable fashion", "custom apparel", "environment", "bangladesh garments"],
        published: true,
        featured: false,
        readingTimeOverride: 6,
        content: `<h2>Bangladesh and the Global Fashion System</h2>
<p>Bangladesh exports over $45 billion worth of garments annually, making us the second-largest exporter in the world after China. We make clothing for some of the most powerful brands on the planet. Yet much of the global fast fashion model — overproduction, planned obsolescence, throwaway culture — stands in direct tension with sustainable living.</p>
<h2>The Problem with Mass-Produced Fashion</h2>
<p>The fashion industry produces an estimated 100 billion garments per year globally. Approximately 30–40% of those garments are never sold — they are either destroyed, landfilled, or incinerated. The carbon footprint, water usage, and chemical runoff of producing clothes that nobody wears is one of the defining environmental scandals of our era.</p>
<h2>How Custom Apparel Is Different</h2>
<h3>Made to Order = Zero Overproduction</h3>
<p>Every TryNex Lifestyle product is printed after you place your order. We do not maintain a warehouse of pre-printed inventory. This means zero overstock, zero unsold products, and zero wasted resources on items that do not reach a person who wants them.</p>
<h3>Made to Be Kept</h3>
<p>A custom t-shirt with your name, your family's photo, or your company's logo is not throwaway fashion. It is a possession with sentimental value that motivates care and long-term ownership. The average lifespan of a personalised garment is 3–5x longer than a generic fast fashion item.</p>
<h3>Local Production = Lower Transport Emissions</h3>
<p>We manufacture, print, and ship from Dhaka, Bangladesh. If you are a Bangladeshi customer, your garment travels a fraction of the distance that an imported garment covers. This dramatically reduces the transport-related carbon footprint of your purchase.</p>
<h2>Our Sustainability Commitments at TryNex</h2>
<ul>
<li><strong>Water-based inks:</strong> For DTG printing, we use water-based inks with no heavy metals or phthalates.</li>
<li><strong>GOTS-certified cotton options:</strong> Available on request for customers who want certified organic fabric.</li>
<li><strong>Minimal packaging:</strong> We use recycled packaging materials and right-size packaging to reduce waste.</li>
<li><strong>Local suppliers:</strong> We prioritise fabric sourcing from Bangladeshi mills to reduce supply chain distance.</li>
</ul>
<h2>Choosing Sustainably</h2>
<p>The most sustainable garment is one you love, wear often, and keep for years. Custom personalised apparel is, by definition, the fashion item most likely to meet that standard. By choosing TryNex for your custom apparel, you are participating in a fundamentally more responsible model of fashion consumption.</p>`,
      },
      {
        title: "Bangladesh Fashion Trends 2025: What's Hot in Custom Wear",
        slug: "bangladesh-fashion-trends-2025-custom-wear",
        excerpt: "From oversized silhouettes and vintage-inspired prints to Bengali calligraphy tees and nature motifs, here are the custom apparel trends dominating Bangladesh's fashion scene in 2025.",
        imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&q=80",
        author: "Tasnim Haque",
        category: "Lifestyle",
        tags: ["fashion trends", "bangladesh", "2025", "custom wear", "street style"],
        published: true,
        featured: true,
        readingTimeOverride: 6,
        content: `<h2>Bangladesh's Custom Apparel Scene in 2025</h2>
<p>Bangladesh's domestic fashion market has exploded over the last five years. Locally produced custom apparel — once seen as lower quality than imported alternatives — is now the preferred choice among urban millennials and Gen Z consumers who value individuality, local identity, and creative expression over brand logos.</p>
<h2>Trend 1: Oversized Silhouettes with Minimal Design</h2>
<p>The "drop-shoulder, single graphic" look is everywhere in Dhaka's Banani, Dhanmondi, and Gulshan neighbourhoods. An oversized 100% cotton tee in a muted colour (washed sage green, dusty rose, faded black) with a single small graphic or text element on the chest. Clean, effortless, and incredibly versatile.</p>
<h2>Trend 2: Bengali Script and Calligraphy</h2>
<p>There is a powerful movement reclaiming Bengali script as a design element. Bold Bangla typography on tees — slogans, poetry fragments, names — printed in white on black or black on cream. Artists and design collectives are leading this trend, and it is increasingly mainstream.</p>
<h2>Trend 3: Vintage-Inspired Sports Graphics</h2>
<p>Retro number graphics, faded athletic lettering, and 70s-style sports typography are having a moment. Think a faded "DHAKA 87" chest print on a washed grey tee. These designs look lived-in and authentic — a deliberate counterpoint to hyper-designed streetwear.</p>
<h2>Trend 4: Nature and Floral Motifs</h2>
<p>Botanical illustrations, the national flower (Shapla), and wildlife-inspired prints are trending strongly among eco-conscious buyers. These connect national identity with aesthetic sensibility — a distinctly Bangladeshi take on the global nature-motif trend.</p>
<h2>Trend 5: Matching Set Culture</h2>
<p>Couples, friend groups, and families are buying matching custom sets — not just for events, but as everyday wear. Custom couple hoodies, family reunion tees, and best-friend cap sets are our fastest-growing product category in 2025.</p>
<h2>Creating On-Trend Custom Designs with TryNex</h2>
<p>Use our 3D Design Studio to experiment with placement, typography, and colour combinations that align with these trends. Upload custom artwork or use our template library. All designs render in real time on photorealistic 3D garment models. No design experience required — our team assists with every step.</p>`,
      },
      {
        title: "From Idea to Wearable: Behind the Scenes at TryNex Lifestyle",
        slug: "behind-the-scenes-trynex-lifestyle",
        excerpt: "What actually happens between the moment you click 'Order' and the moment your custom t-shirt arrives at your door? TryNex takes you inside the production process that turns digital designs into premium wearable art.",
        imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80",
        author: "Rafiqul Islam",
        category: "Lifestyle",
        tags: ["behind the scenes", "production", "custom printing", "trynex", "how it works"],
        published: true,
        featured: false,
        readingTimeOverride: 7,
        content: `<h2>Step 1: Your Design in the 3D Studio</h2>
<p>It starts the moment you open TryNex's 3D Design Studio. You choose your product, select your garment colour, and begin placing your design. The studio renders your creation onto a photorealistic 3D model in real time — you can orbit the garment, zoom in on the print detail, and preview the front and back simultaneously. When you are satisfied, you click Order.</p>
<h2>Step 2: Order Processing and File Review</h2>
<p>Your order arrives in our production queue within seconds. A human operator reviews your design file before anything is printed. We check: resolution, colour accuracy, bleed margins, and any text that might be truncated by garment seams. If anything needs adjustment, we contact you within 2 hours.</p>
<h2>Step 3: Fabric Preparation</h2>
<p>The correct fabric is pulled from stock, pre-washed (to prevent post-print shrinkage), and inspected for defects. A rejected blank is never used. This step — which many print shops skip — is why TryNex prints hold their shape and size through repeated washing.</p>
<h2>Step 4: Printing</h2>
<p>Depending on your design, your order goes through one of three processes:</p>
<ul>
<li><strong>Screen Printing:</strong> For bold, single-to-four colour designs on bulk orders. Screens are prepared, ink is mixed to Pantone specification, and the garment passes through the press. Each colour is cured under UV before the next is applied.</li>
<li><strong>Direct-to-Garment (DTG):</strong> For photographic prints or complex designs. The garment is loaded into our Epson F2230 DTG printer. Ink is jetted directly into the cotton fibres and heat-cured for washfastness.</li>
<li><strong>Sublimation:</strong> For polyester-based products like sports jerseys. The design is printed on transfer paper and heat-pressed into the fabric at 200°C, permanently fusing the colour into the fibre.</li>
</ul>
<h2>Step 5: Quality Control</h2>
<p>Every finished item passes through a three-point quality check: (1) visual inspection of print clarity and colour accuracy, (2) size confirmation against the order specification, and (3) seam and stitch inspection. Items failing any check are reprinted before shipment.</p>
<h2>Step 6: Packaging and Dispatch</h2>
<p>Your order is folded carefully with print protection tissue, packed in a TryNex-branded poly mailer or box depending on order size, and handed to our courier partner. A tracking number is automatically sent to your phone via SMS. Same-day dispatch for Dhaka orders placed before 10 AM. Nationwide delivery within 2–5 business days.</p>
<h2>The People Behind the Products</h2>
<p>TryNex Lifestyle is a team of passionate Bangladeshis — designers, printers, quality inspectors, and logistics coordinators — who take genuine pride in every item that leaves our facility. When you wear a TryNex product, you wear the craft of people who care about the result as much as you do.</p>`,
      },
    ];

    for (let i = 0; i < posts.length; i++) {
      const createdAt = blogPostDate(i, posts.length);
      const updatedAt = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000);
      const values = { ...posts[i], createdAt, updatedAt };
      await db
        .insert(blogPostsTable)
        .values(values)
        .onConflictDoUpdate({
          target: blogPostsTable.slug,
          set: {
            title: values.title,
            excerpt: values.excerpt,
            content: values.content,
            imageUrl: values.imageUrl,
            author: values.author,
            authorBio: values.authorBio,
            category: values.category,
            tags: values.tags,
            published: values.published,
            featured: values.featured,
            readingTimeOverride: values.readingTimeOverride,
            createdAt,
            updatedAt,
          },
        });
    }
    logger.info({ count: posts.length }, "Seeded blog posts");
  } catch (err) {
    logger.error({ err }, "Blog post seed failed — continuing startup anyway");
  }
}

export async function autoSeedIfEmpty(): Promise<void> {
  try {
    await seedCoreBrandSettings();
    await seedHampersIfEmpty();
    await seedBlogPostsIfEmpty();

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
