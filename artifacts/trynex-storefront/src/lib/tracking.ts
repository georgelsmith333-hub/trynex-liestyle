declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
    _fbq?: unknown;
  }
}

let gaLoaded = false;
let fbLoaded = false;

export function initGoogleAnalytics(measurementId: string) {
  if (!measurementId || gaLoaded) return;
  gaLoaded = true;

  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  script.async = true;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag(...args: unknown[]) {
    window.dataLayer!.push(args as unknown as Record<string, unknown>);
  }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", measurementId, { send_page_view: false });
}

export function initFacebookPixel(pixelId: string) {
  if (!pixelId || fbLoaded) return;
  fbLoaded = true;

  const n = (window.fbq = function (...args: unknown[]) {
    if ((n as any).callMethod) {
      (n as any).callMethod(...args);
    } else {
      (n as any).queue.push(args);
    }
  }) as any;
  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];

  const script = document.createElement("script");
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  script.async = true;
  document.head.appendChild(script);

  const noscript = document.createElement("noscript");
  const img = document.createElement("img");
  img.height = 1;
  img.width = 1;
  img.style.display = "none";
  img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
  noscript.appendChild(img);
  document.body.appendChild(noscript);

  window.fbq("init", pixelId);
}

export function initGoogleAds(conversionId: string) {
  if (!conversionId) return;

  if (!window.gtag) {
    window.dataLayer = window.dataLayer || [];
    function gtag(...args: unknown[]) {
      window.dataLayer!.push(args as unknown as Record<string, unknown>);
    }
    window.gtag = gtag;

    const script = document.createElement("script");
    script.src = `https://www.googletagmanager.com/gtag/js?id=${conversionId}`;
    script.async = true;
    document.head.appendChild(script);

    gtag("js", new Date());
  }
  window.gtag("config", conversionId);
}

export function trackPageView(path: string) {
  if (window.gtag) {
    window.gtag("event", "page_view", { page_path: path });
  }
  if (window.fbq) {
    window.fbq("track", "PageView");
  }
}

export function trackViewContent(product: {
  id: number | string;
  name: string;
  price: number;
  category?: string;
}) {
  if (window.gtag) {
    window.gtag("event", "view_item", {
      currency: "BDT",
      value: product.price,
      items: [
        {
          item_id: String(product.id),
          item_name: product.name,
          price: product.price,
          item_category: product.category || "",
        },
      ],
    });
  }
  if (window.fbq) {
    window.fbq("track", "ViewContent", {
      content_ids: [String(product.id)],
      content_name: product.name,
      content_type: "product",
      value: product.price,
      currency: "BDT",
    });
  }
}

export function trackAddToCart(product: {
  id: number | string;
  name: string;
  price: number;
  quantity: number;
}) {
  if (window.gtag) {
    window.gtag("event", "add_to_cart", {
      currency: "BDT",
      value: product.price * product.quantity,
      items: [
        {
          item_id: String(product.id),
          item_name: product.name,
          price: product.price,
          quantity: product.quantity,
        },
      ],
    });
  }
  if (window.fbq) {
    window.fbq("track", "AddToCart", {
      content_ids: [String(product.id)],
      content_name: product.name,
      content_type: "product",
      value: product.price * product.quantity,
      currency: "BDT",
    });
  }
}

export function trackInitiateCheckout(items: { id: string | number; name: string; price: number; quantity: number }[], total: number) {
  if (window.gtag) {
    window.gtag("event", "begin_checkout", {
      currency: "BDT",
      value: total,
      items: items.map((i) => ({
        item_id: String(i.id),
        item_name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
    });
  }
  if (window.fbq) {
    window.fbq("track", "InitiateCheckout", {
      content_ids: items.map((i) => String(i.id)),
      content_type: "product",
      num_items: items.length,
      value: total,
      currency: "BDT",
    });
  }
}

export function trackPurchase(order: {
  orderId: string;
  total: number;
  items: { id: string | number; name: string; price: number; quantity: number }[];
}) {
  if (window.gtag) {
    window.gtag("event", "purchase", {
      transaction_id: order.orderId,
      currency: "BDT",
      value: order.total,
      items: order.items.map((i) => ({
        item_id: String(i.id),
        item_name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
    });
  }
  if (window.fbq) {
    window.fbq("track", "Purchase", {
      content_ids: order.items.map((i) => String(i.id)),
      content_type: "product",
      num_items: order.items.length,
      value: order.total,
      currency: "BDT",
    });
  }
}

export function trackLead(data?: { content_name?: string }) {
  if (window.gtag) {
    window.gtag("event", "generate_lead", data);
  }
  if (window.fbq) {
    window.fbq("track", "Lead", data);
  }
}
