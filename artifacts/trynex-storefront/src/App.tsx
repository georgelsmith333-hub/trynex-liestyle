import { useEffect, lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { SiteSettingsProvider } from "@/context/SiteSettingsContext";
import { AuthProvider } from "@/context/AuthContext";
import { ScrollProvider } from "@/context/ScrollContext";
import { useLenis } from "@/hooks/useLenis";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { TrackingPixels } from "@/components/TrackingPixels";
import { BrandingUpdater } from "@/components/BrandingUpdater";
import { ScrollToTop } from "@/components/ScrollToTop";
import { BackToTop } from "@/components/BackToTop";
import { AbandonedCartPopup } from "@/components/AbandonedCartPopup";
import { ScrollProgressBar } from "@/components/ScrollProgressBar";
import { SocialProofToast } from "@/components/SocialProofToast";
import { SocialAuthLoader } from "@/components/SocialAuthLoader";
import { FlashSaleBar } from "@/components/FlashSaleBar";
import { ExitIntentPopup } from "@/components/ExitIntentPopup";
import { useUtmCapture } from "@/hooks/useUtm";
import { Loader } from "@/components/ui/Loader";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { getApiUrl } from "@/lib/utils";

// Warm up the Render free-tier API on app mount so checkout doesn't pay
// the 30-50s cold-start penalty when the visitor finally clicks "Place Order".
// Fire-and-forget; the response is ignored. Implemented as a hook below.
function useWarmUpApi() {
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const ping = () =>
      fetch(getApiUrl("/api/healthz"), { method: "GET", cache: "no-store" }).catch(() => {});
    // Immediate first ping on mount
    ping();
    // Retry at 3s — catches dynos still booting
    timers.push(setTimeout(ping, 3000));
    // Retry at 8s — catches very slow cold starts / Render free-tier spin-up
    timers.push(setTimeout(ping, 8000));
    return () => { timers.forEach(clearTimeout); };
  }, []);
}

const Home = lazy(() => import("./pages/Home"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const ShippingPolicy = lazy(() => import("./pages/ShippingPolicy"));
const ReturnPolicy = lazy(() => import("./pages/ReturnPolicy"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Account = lazy(() => import("./pages/Account"));
const NotFound = lazy(() => import("./pages/not-found"));

const AdminLogin = lazy(() => import("./pages/admin/Login"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminBlog = lazy(() => import("./pages/admin/AdminBlog"));
const AdminCustomers = lazy(() => import("./pages/admin/AdminCustomers"));
const AdminBackup = lazy(() => import("./pages/admin/AdminBackup"));
const AdminFacebookImport = lazy(() => import("./pages/admin/AdminFacebookImport"));
const AdminReviews = lazy(() => import("./pages/admin/AdminReviews"));
const AdminTechStack = lazy(() => import("./pages/admin/AdminTechStack"));
const AdminDesigner = lazy(() => import("./pages/admin/AdminDesigner"));
const AdminFacebookGuide = lazy(() => import("./pages/admin/AdminFacebookGuide"));
const AdminDeployment = lazy(() => import("./pages/admin/AdminDeployment"));
const AdminHampers = lazy(() => import("./pages/admin/AdminHampers"));
const AdminActivityLog = lazy(() => import("./pages/admin/AdminActivityLog"));
const Hampers = lazy(() => import("./pages/Hampers"));
const HamperDetail = lazy(() => import("./pages/HamperDetail"));
const HamperBuilder = lazy(() => import("./pages/HamperBuilder"));
const Referral = lazy(() => import("./pages/Referral"));
const DesignStudio = lazy(() => import("./pages/DesignStudio"));
const SalePage = lazy(() => import("./pages/SalePage"));
const FAQ = lazy(() => import("./pages/FAQ"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const SizeGuide = lazy(() => import("./pages/SizeGuide"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // 3 minutes default stale time — settings/products don't change every
      // 30 s. Reduces redundant API calls without sacrificing freshness.
      staleTime: 3 * 60 * 1000,
      // Keep unused query data for 10 minutes so navigating back to a page
      // shows instant cached content while revalidating in the background.
      gcTime: 10 * 60 * 1000,
    }
  }
});

function Router() {
  const [location] = useLocation();
  // Key on full location path so transitions fire on all route changes.

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: "easeInOut" }}
      >
        <Suspense fallback={<Loader fullScreen />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/products" component={Products} />
          <Route path="/shop" component={Products} />
          <Route path="/product/:id" component={ProductDetail} />
          <Route path="/cart" component={Cart} />
          <Route path="/checkout" component={Checkout} />
          <Route path="/track" component={TrackOrder} />
          <Route path="/blog" component={Blog} />
          <Route path="/blog/:slug" component={BlogPost} />
          <Route path="/wishlist" component={Wishlist} />
          <Route path="/shipping-policy" component={ShippingPolicy} />
          <Route path="/return-policy" component={ReturnPolicy} />
          <Route path="/privacy-policy" component={PrivacyPolicy} />
          <Route path="/terms-of-service" component={TermsOfService} />
          <Route path="/referral" component={Referral} />
          <Route path="/design-studio" component={DesignStudio} />
          <Route path="/hampers" component={Hampers} />
          <Route path="/hampers/build" component={HamperBuilder} />
          <Route path="/hampers/:slug" component={HamperDetail} />
          <Route path="/sale" component={SalePage} />
          <Route path="/faq" component={FAQ} />
          <Route path="/about" component={About} />
          <Route path="/contact" component={Contact} />
          <Route path="/size-guide" component={SizeGuide} />
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Signup} />
          <Route path="/account" component={Account} />

          <Route path="/admin/login" component={AdminLogin} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin/products" component={AdminProducts} />
          <Route path="/admin/categories" component={AdminCategories} />
          <Route path="/admin/orders" component={AdminOrders} />
          <Route path="/admin/blog" component={AdminBlog} />
          <Route path="/admin/customers" component={AdminCustomers} />
          <Route path="/admin/backup" component={AdminBackup} />
          <Route path="/admin/settings" component={AdminSettings} />
          <Route path="/admin/facebook-import" component={AdminFacebookImport} />
          <Route path="/admin/reviews" component={AdminReviews} />
          <Route path="/admin/tech-stack" component={AdminTechStack} />
          <Route path="/admin/facebook-guide" component={AdminFacebookGuide} />
          <Route path="/admin/designer" component={AdminDesigner} />
          <Route path="/admin/deployment" component={AdminDeployment} />
          <Route path="/admin/hampers" component={AdminHampers} />
          <Route path="/admin/logs" component={AdminActivityLog} />

          {/* Short-URL redirects for common aliases */}
          <Route path="/privacy"><Redirect to="/privacy-policy" /></Route>
          <Route path="/terms"><Redirect to="/terms-of-service" /></Route>
          <Route path="/shipping"><Redirect to="/shipping-policy" /></Route>
          <Route path="/returns"><Redirect to="/return-policy" /></Route>
          <Route path="/refund"><Redirect to="/return-policy" /></Route>

          <Route component={NotFound} />
        </Switch>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function Redirect({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => { navigate(to, { replace: true } as any); }, [to, navigate]);
  return null;
}

function CaptureReferralCode() {
  const [location] = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      localStorage.setItem("trynex_ref_code", ref.toUpperCase().trim());
      const url = new URL(window.location.href);
      url.searchParams.delete("ref");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [location]);
  return null;
}

function AppInner() {
  useLenis();
  useUtmCapture();
  useWarmUpApi();
  return null;
}

function App() {
  return (
    <AppErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SiteSettingsProvider>
          <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <ScrollProvider>
                <AppInner />
                <ScrollProgressBar />
                <CaptureReferralCode />
                <TrackingPixels />
                <SocialAuthLoader />
                <BrandingUpdater />
                <ScrollToTop />
                <FlashSaleBar />
                <AnnouncementBar />
                <Router />
                <WhatsAppButton />
                <BackToTop />
                <AbandonedCartPopup />
                <ExitIntentPopup />
                <SocialProofToast />
              </ScrollProvider>
              </WouterRouter>
              <Toaster />
            </WishlistProvider>
          </CartProvider>
          </AuthProvider>
          </SiteSettingsProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
    </AppErrorBoundary>
  );
}

export default App;
