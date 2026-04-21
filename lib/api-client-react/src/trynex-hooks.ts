import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ─── Shared option type used by hooks that pass auth headers ────────────────
interface ReqOpts {
  request?: { headers?: Record<string, string> };
  query?: Record<string, unknown>;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Product {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  price: string;
  discountPrice?: string | null;
  categoryId?: number | null;
  imageUrl?: string | null;
  images: string[];
  sizes: string[];
  colors: string[];
  stock: number;
  featured?: boolean;
  rating?: string;
  reviewCount?: number;
  customizable?: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  productCount?: number;
  createdAt: string;
}

export interface Testimonial {
  id: number;
  name: string;
  role: string;
  location: string;
  stars: number;
  body: string;
  active: boolean;
  sortOrder: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity?: string | null;
  shippingDistrict?: string | null;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  items: OrderItem[];
  subtotal: string;
  shippingCost: string;
  total: string;
  notes?: string | null;
  promoCode?: string | null;
  promoDiscount?: string | null;
  customerId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: number;
  name: string;
  price: string;
  quantity: number;
  size?: string;
  color?: string;
  imageUrl?: string;
}

export enum CreateOrderRequestPaymentMethod {
  cod = "cod",
  bkash = "bkash",
  nagad = "nagad",
  rocket = "rocket",
  card = "card",
}

export enum UpdateOrderStatusRequestStatus {
  pending = "pending",
  processing = "processing",
  shipped = "shipped",
  delivered = "delivered",
  cancelled = "cancelled",
  refunded = "refunded",
}

export interface AdminCustomer {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  verified?: boolean;
  createdAt: string;
  orderCount?: number;
  totalSpent?: string | number;
  totalOrders?: number;
  lastOrder?: string | null;
  firstOrder?: string | null;
  district?: string | null;
  city?: string | null;
  address?: string | null;
  paymentMethods?: string[];
}

export interface AdminStatsWeeklyDataItem {
  date?: string;
  day?: string;
  orders: number;
  revenue: number;
}

export interface AdminStatsPaymentDistributionItem {
  method?: string;
  name?: string;
  count?: number;
  amount?: number;
  value?: number;
  color?: string;
}

export interface CreateOrderRequest {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity?: string;
  shippingDistrict?: string;
  paymentMethod: CreateOrderRequestPaymentMethod;
  items: OrderItem[];
  subtotal: string;
  shippingCost: string;
  total: string;
  notes?: string;
  promoCode?: string;
  promoDiscount?: string;
}

export interface CreateProductRequest {
  name: string;
  slug: string;
  description?: string;
  price: number | string;
  discountPrice?: number | string;
  categoryId?: number;
  imageUrl?: string;
  images?: string[];
  sizes?: string[];
  colors?: string[];
  stock: number;
  featured?: boolean;
  customizable?: boolean;
  tags?: string[];
}

export interface UpdateProductRequest {
  name?: string;
  slug?: string;
  description?: string;
  price?: number | string;
  discountPrice?: number | string | null;
  categoryId?: number | null;
  imageUrl?: string;
  images?: string[];
  sizes?: string[];
  colors?: string[];
  stock?: number;
  featured?: boolean;
  customizable?: boolean;
  tags?: string[];
}

export interface Review {
  id: number;
  productId: number;
  customerName: string;
  customerEmail: string;
  rating: number;
  text?: string | null;
  verified: boolean;
  approved: boolean;
  createdAt: string;
}

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  imageUrl?: string | null;
  author: string;
  authorBio?: string | null;
  authorAvatarUrl?: string | null;
  category: string;
  tags: string[];
  published: boolean;
  featured: boolean;
  readingTime?: number | null;
  readingTimeOverride?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPostInput {
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  imageUrl?: string | null;
  author?: string;
  authorBio?: string | null;
  authorAvatarUrl?: string | null;
  category?: string;
  tags?: string[];
  published?: boolean;
  featured?: boolean;
  readingTimeOverride?: number | null;
}

export interface DesignerSettings {
  primaryColor?: string;
  announcementColor?: string;
  heroImageUrl?: string;
  heroGradient?: string;
  heroCTAText?: string;
  heroCTALink?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  announcementBar?: string;
  promoBannerTitle?: string;
  promoBannerSubtitle?: string;
  promoBannerDiscount?: string;
  promoBannerCTA?: string;
  trustBadge1Title?: string;
  trustBadge1Desc?: string;
  trustBadge1Icon?: string;
  trustBadge2Title?: string;
  trustBadge2Desc?: string;
  trustBadge2Icon?: string;
  trustBadge3Title?: string;
  trustBadge3Desc?: string;
  trustBadge3Icon?: string;
  trustBadge4Title?: string;
  trustBadge4Desc?: string;
  trustBadge4Icon?: string;
  sectionFeaturedEnabled?: boolean | string;
  sectionCategoriesEnabled?: boolean | string;
  sectionFlashSaleEnabled?: boolean | string;
  sectionTestimonialsEnabled?: boolean | string;
  sectionStatsEnabled?: boolean | string;
  categoryTshirtsEnabled?: boolean | string;
  categoryHoodiesEnabled?: boolean | string;
  categoryCapsEnabled?: boolean | string;
  categoryMugsEnabled?: boolean | string;
  categoryCustomEnabled?: boolean | string;
  announcementEnabled?: boolean | string;
  announcementAutoHide?: boolean | string;
  [key: string]: unknown;
}

export interface FacebookPost {
  id: string;
  message: string;
  images: string[];
  hasImages: boolean;
  createdTime?: string;
  permalink?: string;
  suggestedName?: string;
  suggestedPrice?: number;
  suggestedDiscountPrice?: number;
  suggestedCategory?: string;
  suggestedSizes?: string[];
  suggestedColors?: string[];
}

export interface FetchSocialUrl200Post {
  id: string;
  message: string;
  images: string[];
  hasImages?: boolean;
  createdTime?: string;
  permalink?: string;
  suggestedName?: string;
  suggestedPrice?: number;
  suggestedDiscountPrice?: number;
  suggestedCategory?: string;
  suggestedSizes?: string[];
  suggestedColors?: string[];
}

// ─── Settings Hooks ──────────────────────────────────────────────────────────

export interface SiteSettings {
  studioTshirtColors?: string;
  studioMugColors?: string;
  [key: string]: unknown;
}

export const useGetSettings = (_opts?: ReqOpts) => {
  return useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => customFetch<SiteSettings>("/api/settings"),
    staleTime: 30 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
};

export const useUpdateSettings = (opts?: ReqOpts) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { data: Record<string, unknown> }) =>
      customFetch<Record<string, unknown>>("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(opts?.request?.headers ?? {}) },
        body: JSON.stringify(args.data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/designer-settings"] });
    },
  });
};

// ─── Product Hooks ───────────────────────────────────────────────────────────

export const getListProductsQueryKey = (params?: Record<string, unknown>) =>
  ["/api/products", params] as const;

export const useListProducts = (
  params?: {
    category?: string;
    featured?: boolean;
    limit?: number;
    search?: string;
    page?: number;
  },
  opts?: { query?: Partial<UseQueryOptions> } | ReqOpts,
) => {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set("category", params.category);
  if (params?.featured !== undefined) searchParams.set("featured", String(params.featured));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", String(params.page));
  const qs = searchParams.toString();
  const url = `/api/products${qs ? `?${qs}` : ""}`;
  const customKey = (opts as { query?: { queryKey?: unknown } })?.query?.queryKey;
  return useQuery({
    queryKey: customKey ? (customKey as unknown[]) : ["/api/products", params],
    queryFn: () => customFetch<{ products: Product[]; total?: number }>(url),
    staleTime: 60 * 1000,
  });
};

export const useGetProduct = (slugOrId: string | number, _opts?: Record<string, unknown>) => {
  return useQuery({
    queryKey: ["/api/products", slugOrId],
    queryFn: () => customFetch<{ product: Product }>(`/api/products/${slugOrId}`),
    enabled: !!slugOrId,
    staleTime: 60 * 1000,
  });
};

export const useCreateProduct = (opts?: ReqOpts) => {
  return useMutation({
    mutationFn: ({ data }: { data: CreateProductRequest }) =>
      customFetch<{ product: Product }>("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(opts?.request?.headers ?? {}) },
        body: JSON.stringify(data),
      }),
  });
};

export const useUpdateProduct = (opts?: ReqOpts) => {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateProductRequest }) =>
      customFetch<Product>(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(opts?.request?.headers ?? {}) },
        body: JSON.stringify(data),
      }),
  });
};

export const useDeleteProduct = (opts?: ReqOpts) => {
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      customFetch<void>(`/api/products/${id}`, {
        method: "DELETE",
        headers: { ...(opts?.request?.headers ?? {}) },
      }),
  });
};

export const useToggleProductFeatured = (opts?: ReqOpts) => {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { featured: boolean } }) =>
      customFetch<Product>(`/api/admin/products/${id}/featured`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(opts?.request?.headers ?? {}) },
        body: JSON.stringify(data),
      }),
  });
};

// ─── Category Hooks ──────────────────────────────────────────────────────────

export const useListCategories = (_opts?: ReqOpts) => {
  return useQuery({
    queryKey: ["/api/categories"],
    queryFn: () => customFetch<{ categories: Category[] }>("/api/categories"),
    staleTime: 5 * 60 * 1000,
  });
};

// ─── Testimonial Hooks ───────────────────────────────────────────────────────

export const useGetTestimonials = () => {
  return useQuery({
    queryKey: ["/api/testimonials"],
    queryFn: () => customFetch<{ testimonials: Testimonial[] }>("/api/testimonials"),
    staleTime: 5 * 60 * 1000,
  });
};

export const useAdminListTestimonials = (opts?: ReqOpts) => {
  return useQuery({
    queryKey: ["/api/admin/testimonials"],
    queryFn: () =>
      customFetch<{ testimonials: Testimonial[] }>("/api/admin/testimonials", {
        headers: opts?.request?.headers,
      }),
  });
};

export const useCreateTestimonial = (opts?: ReqOpts) => {
  return useMutation({
    mutationFn: ({ data }: { data: Partial<Testimonial> }) =>
      customFetch<Testimonial>("/api/admin/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(opts?.request?.headers ?? {}) },
        body: JSON.stringify(data),
      }),
  });
};

export const useUpdateTestimonial = (opts?: ReqOpts) => {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Testimonial> }) =>
      customFetch<Testimonial>(`/api/admin/testimonials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(opts?.request?.headers ?? {}) },
        body: JSON.stringify(data),
      }),
  });
};

export const useDeleteTestimonial = (opts?: ReqOpts) => {
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      customFetch<{ success: boolean }>(`/api/admin/testimonials/${id}`, {
        method: "DELETE",
        headers: { ...(opts?.request?.headers ?? {}) },
      }),
  });
};

// ─── Order Hooks ─────────────────────────────────────────────────────────────

export const useCreateOrder = () => {
  return useMutation({
    mutationFn: (data: CreateOrderRequest) =>
      customFetch<{ order: Order }>("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  });
};

export const useTrackOrder = (orderNumber: string) => {
  return useQuery({
    queryKey: ["/api/orders/track", orderNumber],
    queryFn: () => customFetch<{ order: Order }>(`/api/orders/track/${orderNumber}`),
    enabled: !!orderNumber,
    retry: false,
  });
};

export const getListOrdersQueryKey = (params?: Record<string, unknown>) =>
  ["/api/orders", params] as const;

export const useListOrders = (params?: {
  status?: string;
  limit?: number;
  page?: number;
  search?: string;
}, _opts?: ReqOpts) => {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.search) searchParams.set("search", params.search);
  const qs = searchParams.toString();
  const url = `/api/orders${qs ? `?${qs}` : ""}`;
  return useQuery({
    queryKey: getListOrdersQueryKey(params),
    queryFn: () => customFetch<{ orders: Order[]; total?: number }>(url),
  });
};

export const useUpdateOrderStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      status,
    }: {
      orderId: number;
      status: UpdateOrderStatusRequestStatus;
    }) =>
      customFetch<{ order: Order }>(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/orders"] }),
  });
};

export const useUpdatePaymentStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      paymentStatus,
    }: {
      orderId: number;
      paymentStatus: string;
    }) =>
      customFetch<{ order: Order }>(`/api/orders/${orderId}/payment-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/orders"] }),
  });
};

// ─── Admin Auth Hooks ─────────────────────────────────────────────────────────

export const useAdminLogin = () => {
  return useMutation({
    mutationFn: ({
      username,
      password,
    }: {
      username: string;
      password: string;
    }) =>
      customFetch<{ token: string }>("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      }),
  });
};

export const useAdminLogout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch<{ message: string }>("/api/admin/logout", {
        method: "POST",
      }),
    onSuccess: () => {
      qc.clear();
    },
  });
};

export const useAdminMe = () => {
  return useQuery({
    queryKey: ["/api/admin/me"],
    queryFn: () =>
      customFetch<{ admin: { id: number; username: string } }>("/api/admin/me"),
    retry: false,
    staleTime: 60 * 1000,
  });
};

// ─── Admin Stats Hooks ────────────────────────────────────────────────────────

export const useGetAdminStats = (_opts?: ReqOpts) => {
  return useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: () =>
      customFetch<{
        totalRevenue: number;
        totalOrders: number;
        totalProducts: number;
        totalCustomers: number;
        pendingOrders: number;
        todayRevenue?: number;
        lowStockProducts?: number;
        topProducts?: { id: number; name: string; imageUrl?: string | null; totalSold: number }[];
        recentOrders?: { id: number; orderNumber: string; customerName: string; status: string; paymentMethod: string; total: number }[];
        weeklyData: AdminStatsWeeklyDataItem[];
        paymentDistribution: AdminStatsPaymentDistributionItem[];
      }>("/api/admin/stats"),
  });
};

export const useListAdminCustomers = () => {
  return useQuery({
    queryKey: ["/api/admin/customers"],
    queryFn: () =>
      customFetch<{
        customers: AdminCustomer[];
        totalCustomers?: number;
        totalOrders?: number;
        topDistricts?: { district: string; count: number }[];
      }>("/api/admin/customers"),
  });
};

export interface AdminGuestCustomer {
  id: number;
  guestSequence: number | null;
  username: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string | null;
  lastOrderNumber: string | null;
  lastOrderStatus: string | null;
  shippingDistrict: string | null;
  shippingCity: string | null;
  shippingAddress: string | null;
}

export const useListAdminGuestCustomers = () => {
  return useQuery({
    queryKey: ["/api/admin/guest-customers"],
    queryFn: () =>
      customFetch<{ totalGuests: number; withOrders: number; guests: AdminGuestCustomer[] }>(
        "/api/admin/guest-customers"
      ),
  });
};

export const useConvertGuestCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, email, password, name }: { id: number; email: string; password: string; name?: string }) =>
      customFetch<{ success: boolean }>(`/api/admin/guest-customers/${id}/convert`, {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/guest-customers"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/customers"] });
    },
  });
};

export const useDeleteGuestCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      customFetch<{ success: boolean }>(`/api/admin/guest-customers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/guest-customers"] });
    },
  });
};

// ─── Backup Hooks ─────────────────────────────────────────────────────────────

export const getExportBackupUrl = () => `/api/backup/export`;
export const getExportOrdersCsvUrl = () => `/api/backup/orders-csv`;

export const useImportBackup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { version: string; data: Record<string, unknown> }) =>
      customFetch<{ success: boolean; imported: Record<string, number> }>("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      qc.invalidateQueries({ queryKey: ["/api/orders"] });
      qc.invalidateQueries({ queryKey: ["/api/categories"] });
    },
  });
};

// ─── Designer Settings Hooks ──────────────────────────────────────────────────

export const useGetDesignerSettings = (opts?: ReqOpts) => {
  return useQuery({
    queryKey: ["/api/admin/designer-settings"],
    queryFn: () =>
      customFetch<DesignerSettings>("/api/admin/designer-settings", {
        headers: opts?.request?.headers,
      }),
    staleTime: 60 * 1000,
  });
};

export const usePatchDesignerSettings = (opts?: ReqOpts) => {
  return useMutation({
    mutationFn: ({ data }: { data: DesignerSettings }) =>
      customFetch<{ success: boolean }>("/api/admin/designer-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(opts?.request?.headers ?? {}) },
        body: JSON.stringify(data),
      }),
  });
};

// ─── Review Hooks ─────────────────────────────────────────────────────────────

export const useListAdminReviews = (opts?: ReqOpts) => {
  return useQuery({
    queryKey: ["/api/admin/reviews"],
    queryFn: () =>
      customFetch<{ reviews: Review[] }>("/api/admin/reviews", {
        headers: opts?.request?.headers,
      }),
  });
};

export const useApproveReview = (_opts?: ReqOpts) => {
  return useMutation({
    mutationFn: ({ id, request }: { id: number; request?: { headers?: Record<string, string> } }) =>
      customFetch<Review>(`/api/admin/reviews/${id}/approve`, {
        method: "PUT",
        headers: { ...(request?.headers ?? {}) },
      }),
  });
};

export const useDeleteReview = (_opts?: ReqOpts) => {
  return useMutation({
    mutationFn: ({ id, request }: { id: number; request?: { headers?: Record<string, string> } }) =>
      customFetch<{ success: boolean }>(`/api/admin/reviews/${id}`, {
        method: "DELETE",
        headers: { ...(request?.headers ?? {}) },
      }),
  });
};

// ─── Blog Hooks ───────────────────────────────────────────────────────────────

export const useListBlogPosts = (
  params?: { limit?: string | number; page?: string | number; published?: boolean; category?: string },
  opts?: ReqOpts,
) => {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.published !== undefined) searchParams.set("published", String(params.published));
  if (params?.category) searchParams.set("category", params.category);
  const qs = searchParams.toString();
  const url = `/api/blog${qs ? `?${qs}` : ""}`;
  const headers = opts?.request?.headers ?? {};
  const authKey = headers["Authorization"] ?? headers["authorization"] ?? "";
  return useQuery({
    queryKey: ["/api/blog", params, authKey ? "auth" : "anon"],
    queryFn: () => customFetch<{ posts: BlogPost[]; total: number; page: number; limit: number }>(url, {
      headers,
    }),
    staleTime: 60 * 1000,
  });
};

export const useCreateBlogPost = (_opts?: ReqOpts) => {
  return useMutation({
    mutationFn: ({ data, request }: { data: BlogPostInput; request?: { headers?: Record<string, string> } }) =>
      customFetch<BlogPost>("/api/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(request?.headers ?? {}) },
        body: JSON.stringify(data),
      }),
  });
};

export const useUpdateBlogPost = (_opts?: ReqOpts) => {
  return useMutation({
    mutationFn: ({ id, data, request }: { id: number; data: Partial<BlogPostInput>; request?: { headers?: Record<string, string> } }) =>
      customFetch<BlogPost>(`/api/blog/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(request?.headers ?? {}) },
        body: JSON.stringify(data),
      }),
  });
};

export const useDeleteBlogPost = (_opts?: ReqOpts) => {
  return useMutation({
    mutationFn: ({ id, request }: { id: number; request?: { headers?: Record<string, string> } }) =>
      customFetch<void>(`/api/blog/${id}`, {
        method: "DELETE",
        headers: { ...(request?.headers ?? {}) },
      }),
  });
};

// ─── Facebook / Social Import Hooks ──────────────────────────────────────────

export const useFetchFacebookPosts = (opts?: ReqOpts) => {
  return useMutation({
    mutationFn: ({ data }: { data: { pageId: string; accessToken: string } }) =>
      customFetch<{ posts: FacebookPost[]; total: number }>("/api/admin/facebook/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(opts?.request?.headers ?? {}) },
        body: JSON.stringify(data),
      }),
  });
};

export const useFetchSocialUrl = (opts?: ReqOpts) => {
  return useMutation({
    mutationFn: ({ data }: { data: { url: string; accessToken?: string } }) =>
      customFetch<{ post: FetchSocialUrl200Post; source: string }>("/api/admin/social/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(opts?.request?.headers ?? {}) },
        body: JSON.stringify(data),
      }),
  });
};

export const useImportFacebookProduct = (opts?: ReqOpts) => {
  return useMutation({
    mutationFn: ({ data }: { data: Partial<CreateProductRequest> & { category?: string } }) =>
      customFetch<{ product: Product }>("/api/admin/facebook/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(opts?.request?.headers ?? {}) },
        body: JSON.stringify(data),
      }),
  });
};
