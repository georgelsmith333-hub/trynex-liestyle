import { AdminLayout } from "@/components/layout/AdminLayout";
import { Code2, Server, Database, Globe, Palette, Shield, Package, Layers, Cpu, Monitor } from "lucide-react";

const STACK_SECTIONS = [
  {
    title: "Frontend",
    icon: Monitor,
    color: "bg-blue-50 text-blue-600",
    items: [
      { name: "React 18", desc: "UI library with hooks, context, and suspense" },
      { name: "Vite 6", desc: "Lightning-fast build tool with HMR" },
      { name: "TypeScript 5", desc: "Type-safe JavaScript" },
      { name: "Tailwind CSS 4", desc: "Utility-first CSS framework" },
      { name: "Framer Motion", desc: "Production-ready animations" },
      { name: "Wouter", desc: "Lightweight client-side routing" },
      { name: "TanStack Query", desc: "Data fetching, caching & synchronization" },
      { name: "React Helmet Async", desc: "SEO meta tag management" },
      { name: "Lucide React", desc: "Beautiful icon library" },
      { name: "Radix UI", desc: "Accessible headless UI primitives" },
    ],
  },
  {
    title: "Backend",
    icon: Server,
    color: "bg-green-50 text-green-600",
    items: [
      { name: "Node.js", desc: "JavaScript runtime" },
      { name: "Express 5", desc: "Minimal web framework" },
      { name: "TypeScript", desc: "Type-safe server code" },
      { name: "Pino", desc: "High-performance JSON logger" },
      { name: "JWT (jsonwebtoken)", desc: "Authentication tokens" },
      { name: "Cookie Parser", desc: "HTTP cookie handling" },
      { name: "CORS", desc: "Cross-origin resource sharing" },
    ],
  },
  {
    title: "Database",
    icon: Database,
    color: "bg-purple-50 text-purple-600",
    items: [
      { name: "PostgreSQL", desc: "Relational database (Neon/Replit hosted)" },
      { name: "Drizzle ORM", desc: "Type-safe SQL ORM with zero overhead" },
      { name: "Drizzle Zod", desc: "Schema validation from DB types" },
    ],
  },
  {
    title: "Design System",
    icon: Palette,
    color: "bg-orange-50 text-orange-600",
    items: [
      { name: "Primary Color", desc: "#E85D04 (Orange)" },
      { name: "Accent Color", desc: "#FB8500 (Light Orange)" },
      { name: "Display Font", desc: "Outfit (700-900 weight)" },
      { name: "Body Font", desc: "Plus Jakarta Sans (300-800)" },
      { name: "Currency", desc: "BDT (৳)" },
      { name: "Theme", desc: "Light/Warm — no dark mode" },
    ],
  },
  {
    title: "SEO & Marketing",
    icon: Globe,
    color: "bg-teal-50 text-teal-600",
    items: [
      { name: "Open Graph Tags", desc: "WhatsApp/Facebook/Twitter link previews" },
      { name: "Schema.org JSON-LD", desc: "Structured data for Google" },
      { name: "Dynamic Sitemap", desc: "/api/sitemap.xml — auto-generated" },
      { name: "robots.txt", desc: "Search engine crawl directives" },
      { name: "Meta Tags", desc: "Per-page title, description, keywords" },
      { name: "Canonical URLs", desc: "Duplicate content prevention" },
    ],
  },
  {
    title: "Auth & Security",
    icon: Shield,
    color: "bg-red-50 text-red-600",
    items: [
      { name: "Admin Auth", desc: "JWT + httpOnly cookies, SHA-256 hashed passwords" },
      { name: "Customer Auth", desc: "Email/password, Google OAuth, Facebook Login" },
      { name: "CORS Protection", desc: "Credential-based origin whitelisting" },
      { name: "Input Validation", desc: "Zod schemas on API inputs" },
    ],
  },
  {
    title: "Infrastructure",
    icon: Layers,
    color: "bg-indigo-50 text-indigo-600",
    items: [
      { name: "pnpm Monorepo", desc: "Workspace with shared packages" },
      { name: "Replit", desc: "Development environment" },
      { name: "Render", desc: "API server hosting (free tier)" },
      { name: "Cloudflare Pages", desc: "Frontend static hosting (free tier)" },
      { name: "GitHub", desc: "Source code repository" },
    ],
  },
  {
    title: "API Architecture",
    icon: Cpu,
    color: "bg-amber-50 text-amber-600",
    items: [
      { name: "RESTful API", desc: "All endpoints under /api/*" },
      { name: "OpenAPI Spec", desc: "Auto-generated API documentation" },
      { name: "Auto-migration", desc: "Tables created on startup" },
      { name: "Auto-seed", desc: "Sample data seeded if DB is empty" },
    ],
  },
];

const DB_TABLES = [
  { name: "products", desc: "Product catalog with variants, images, pricing" },
  { name: "categories", desc: "Product categories with slugs" },
  { name: "orders", desc: "Customer orders with items, payment, shipping" },
  { name: "customers", desc: "Registered customer accounts" },
  { name: "admins", desc: "Admin user credentials" },
  { name: "blog_posts", desc: "Blog content with SEO fields" },
  { name: "reviews", desc: "Product reviews with ratings" },
  { name: "promo_codes", desc: "Discount and promotional codes" },
  { name: "referrals", desc: "Referral program tracking" },
  { name: "settings", desc: "Key-value site configuration" },
];

export default function AdminTechStack() {
  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Code2 className="w-7 h-7 text-orange-500" />
            Site Tech Stack & Configuration
          </h1>
          <p className="text-gray-500 mt-1">Complete technical overview of the TryNex Lifestyle platform</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {STACK_SECTIONS.map((section) => (
            <div key={section.title} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${section.color}`}>
                  <section.icon className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-gray-900">{section.title}</h2>
              </div>
              <div className="p-4 space-y-2">
                {section.items.map((item) => (
                  <div key={item.name} className="flex items-start gap-2">
                    <span className="text-xs font-bold text-gray-900 bg-gray-100 rounded px-2 py-0.5 mt-0.5 whitespace-nowrap">{item.name}</span>
                    <span className="text-sm text-gray-500">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-purple-50 text-purple-600">
              <Database className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-gray-900">Database Tables</h2>
          </div>
          <div className="p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {DB_TABLES.map((table) => (
                <div key={table.name} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50">
                  <code className="text-xs font-mono font-bold text-purple-600 bg-purple-50 rounded px-2 py-0.5 mt-0.5">{table.name}</code>
                  <span className="text-sm text-gray-500">{table.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-50 text-green-600">
              <Package className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-gray-900">API Endpoints</h2>
          </div>
          <div className="p-4 text-sm">
            <div className="grid gap-1.5 font-mono text-xs">
              {[
                { method: "GET", path: "/api/products", desc: "List products" },
                { method: "GET", path: "/api/products/:id", desc: "Get product (ID or slug)" },
                { method: "GET", path: "/api/categories", desc: "List categories" },
                { method: "POST", path: "/api/orders", desc: "Create order" },
                { method: "GET", path: "/api/orders/track/:orderNumber", desc: "Track order" },
                { method: "GET", path: "/api/blog", desc: "List blog posts" },
                { method: "POST", path: "/api/auth/register", desc: "Customer signup" },
                { method: "POST", path: "/api/auth/login", desc: "Customer login" },
                { method: "POST", path: "/api/auth/google", desc: "Google OAuth" },
                { method: "POST", path: "/api/auth/facebook", desc: "Facebook login" },
                { method: "GET", path: "/api/auth/me", desc: "Current customer" },
                { method: "POST", path: "/api/admin/login", desc: "Admin login" },
                { method: "GET", path: "/api/sitemap.xml", desc: "Dynamic sitemap" },
              ].map((endpoint) => (
                <div key={endpoint.path + endpoint.method} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${endpoint.method === "GET" ? "bg-green-500" : "bg-blue-500"}`}>
                    {endpoint.method}
                  </span>
                  <span className="text-gray-800">{endpoint.path}</span>
                  <span className="text-gray-400 ml-auto">{endpoint.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
