import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

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
  totalSpent?: string;
}

export interface AdminStatsWeeklyDataItem {
  date: string;
  orders: number;
  revenue: number;
}

export interface AdminStatsPaymentDistributionItem {
  method: string;
  count: number;
  amount: number;
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

export const useGetSettings = () => {
  return useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => customFetch<{ settings: Record<string, string> }>("/api/settings"),
    staleTime: 5 * 60 * 1000,
  });
};

export const useUpdateSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, string>) =>
      customFetch<{ settings: Record<string, string> }>("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/settings"] }),
  });
};

export const useListProducts = (params?: {
  category?: string;
  featured?: boolean;
  limit?: number;
  search?: string;
  page?: number;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set("category", params.category);
  if (params?.featured !== undefined) searchParams.set("featured", String(params.featured));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", String(params.page));
  const qs = searchParams.toString();
  const url = `/api/products${qs ? `?${qs}` : ""}`;
  return useQuery({
    queryKey: ["/api/products", params],
    queryFn: () => customFetch<{ products: Product[]; total?: number }>(url),
    staleTime: 60 * 1000,
  });
};

export const useGetProduct = (slug: string) => {
  return useQuery({
    queryKey: ["/api/products", slug],
    queryFn: () => customFetch<{ product: Product }>(`/api/products/${slug}`),
    enabled: !!slug,
    staleTime: 60 * 1000,
  });
};

export const useListCategories = () => {
  return useQuery({
    queryKey: ["/api/categories"],
    queryFn: () => customFetch<{ categories: Category[] }>("/api/categories"),
    staleTime: 5 * 60 * 1000,
  });
};

export const useGetTestimonials = () => {
  return useQuery({
    queryKey: ["/api/testimonials"],
    queryFn: () => customFetch<{ testimonials: Testimonial[] }>("/api/testimonials"),
    staleTime: 5 * 60 * 1000,
  });
};

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
}) => {
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

export const useGetAdminStats = () => {
  return useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: () =>
      customFetch<{
        totalRevenue: number;
        totalOrders: number;
        totalProducts: number;
        totalCustomers: number;
        pendingOrders: number;
        weeklyData: AdminStatsWeeklyDataItem[];
        paymentDistribution: AdminStatsPaymentDistributionItem[];
      }>("/api/admin/stats"),
  });
};

export const useListAdminCustomers = () => {
  return useQuery({
    queryKey: ["/api/admin/customers"],
    queryFn: () =>
      customFetch<{ customers: AdminCustomer[] }>("/api/admin/customers"),
  });
};

export const getExportBackupUrl = () => `/api/backup/export`;
export const getExportOrdersCsvUrl = () => `/api/backup/orders-csv`;

export const useImportBackup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FormData) =>
      customFetch<{ message: string; imported: number }>("/api/backup/import", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      qc.invalidateQueries({ queryKey: ["/api/orders"] });
      qc.invalidateQueries({ queryKey: ["/api/categories"] });
    },
  });
};
