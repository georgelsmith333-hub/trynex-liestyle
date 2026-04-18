import { Link, useLocation } from "wouter";
import { Menu, X, ChevronDown, Heart, ShoppingCart, User, LogIn, LogOut, Package, ShoppingBag, Gift, Search } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { CartDrawer } from "@/components/CartDrawer";

const SHOP_CATEGORIES = [
  { label: "All Products", href: "/products", emoji: "🛍️" },
  { label: "T-Shirts", href: "/products?category=t-shirts", emoji: "👕" },
  { label: "Hoodies", href: "/products?category=hoodies", emoji: "🧥" },
  { label: "Caps", href: "/products?category=caps", emoji: "🧢" },
  { label: "Mugs", href: "/products?category=mugs", emoji: "☕" },
  { label: "Design Studio", href: "/design-studio", emoji: "🎨" },
];

export function Navbar() {
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const settings = useSiteSettings();
  const { customer, isAuthenticated, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const { itemCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const isHomePage = location === "/" || location === "";

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 12);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setShopOpen(false);
    setProfileOpen(false);
    setSearchOpen(false);
  }, [location]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false);
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/products", label: "Shop", dropdown: true },
    { href: "/design-studio", label: "Customize", badge: "NEW" as const },
    { href: "/blog", label: "Blog" },
    { href: "/track", label: "Track Order" },
  ];

  return (
    <header
      className={cn(
        "fixed left-0 right-0 z-40 transition-all duration-500",
        scrolled
          ? "bg-white/[0.97] backdrop-blur-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(232,93,4,0.06)]"
          : isHomePage
            ? "bg-transparent"
            : "bg-white/95 backdrop-blur-lg",
      )}
      style={{ top: 'var(--announcement-height, 0px)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[4.25rem]">

          <Link href="/" className="flex items-center gap-3 group select-none">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black font-display text-lg shadow-lg transition-transform group-hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 4px 14px rgba(232,93,4,0.35)' }}
            >
              {(settings.siteName?.trim() || "TryNex Lifestyle")[0]}
            </div>
            <div className="flex flex-col leading-none gap-[3px]">
              <span className="text-[1.35rem] font-black font-display tracking-tight text-gray-900 group-hover:text-orange-600 transition-colors">
                {(() => {
                  const name = settings.siteName?.trim() || "TryNex Lifestyle";
                  if (name === "TryNex Lifestyle") return <>TRY<span style={{ color: '#E85D04' }}>NEX</span></>;
                  return <span style={{ color: '#E85D04' }}>{name.split(' ')[0]}</span>;
                })()}
              </span>
              <span className="text-[9px] font-bold text-gray-400 tracking-[0.25em] uppercase">
                {(() => {
                  const name = settings.siteName?.trim() || "TryNex Lifestyle";
                  if (name === "TryNex Lifestyle") return "Lifestyle";
                  return name.split(' ').slice(1).join(' ') || settings.tagline || "";
                })()}
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center">
            {navLinks.map((link) =>
              link.dropdown ? (
                <div
                  key={link.href}
                  className="relative"
                  onMouseEnter={() => setShopOpen(true)}
                  onMouseLeave={() => setShopOpen(false)}
                >
                  <button
                    className={cn(
                      "flex items-center gap-1 px-4 py-2 rounded-full font-semibold text-[0.8125rem] transition-all",
                      location === link.href
                        ? "text-orange-600 bg-orange-50"
                        : "text-gray-600 hover:text-orange-600 hover:bg-orange-50/60"
                    )}
                  >
                    {link.label}
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", shopOpen && "rotate-180")} />
                  </button>
                  <AnimatePresence>
                    {shopOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden p-1.5 z-50"
                      >
                        {SHOP_CATEGORIES.map((cat) => (
                          <Link
                            key={cat.label}
                            href={cat.href}
                            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[0.8125rem] font-semibold text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                          >
                            <span className="text-base">{cat.emoji}</span>
                            {cat.label}
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative px-4 py-2 rounded-full font-semibold text-[0.8125rem] transition-all inline-flex items-center gap-1.5",
                    location === link.href
                      ? "text-orange-600 bg-orange-50"
                      : "text-gray-600 hover:text-orange-600 hover:bg-orange-50/60"
                  )}
                >
                  {link.label}
                  {link.badge && (
                    <span
                      className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-full text-white"
                      style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}
                    >
                      {link.badge}
                    </span>
                  )}
                </Link>
              )
            )}
          </nav>

          <div className="flex items-center gap-1.5">
            {/* Search button */}
            <button
              onClick={() => setSearchOpen(prev => !prev)}
              className={cn(
                "hidden md:flex items-center justify-center w-10 h-10 rounded-full transition-all",
                searchOpen
                  ? "text-orange-600 bg-orange-50"
                  : "text-gray-500 hover:text-orange-600 hover:bg-orange-50/60"
              )}
              title="Search (Ctrl+K)"
              aria-label="Search products"
            >
              <Search className="w-[1.05rem] h-[1.05rem]" />
            </button>

            {isAuthenticated ? (
              <div ref={profileRef} className="relative hidden sm:block">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-full hover:bg-orange-50/70 transition-all"
                  title={customer?.name}
                >
                  {customer?.avatar ? (
                    <img src={customer.avatar} alt="" className="w-7 h-7 rounded-full object-cover border-2 border-orange-200" />
                  ) : (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black" style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)" }}>
                      {customer?.name?.[0]?.toUpperCase() || "U"}
                    </div>
                  )}
                  <span className="text-[0.8125rem] font-semibold text-gray-700 max-w-[80px] truncate">
                    {customer?.name?.split(" ")[0]}
                  </span>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform duration-200", profileOpen && "rotate-180")} />
                </button>
                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                      className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 overflow-hidden z-50"
                    >
                      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-br from-orange-50 to-amber-50">
                        <p className="text-sm font-bold text-gray-900 truncate">{customer?.name}</p>
                        <p className="text-xs text-gray-400 truncate">{customer?.email}</p>
                      </div>
                      <div className="p-1.5 space-y-0.5">
                        <Link href="/account" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[0.8125rem] font-semibold text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                          <User className="w-4 h-4" /> My Profile
                        </Link>
                        <Link href="/account" onClick={() => setTimeout(() => window.dispatchEvent(new CustomEvent("account-tab", { detail: "orders" })), 50)} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[0.8125rem] font-semibold text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                          <ShoppingBag className="w-4 h-4" /> My Orders
                        </Link>
                        <Link href="/track" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[0.8125rem] font-semibold text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                          <Package className="w-4 h-4" /> Track Order
                        </Link>
                        <Link href="/wishlist" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[0.8125rem] font-semibold text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                          <Heart className="w-4 h-4" /> Wishlist
                        </Link>
                        <Link href="/referral" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[0.8125rem] font-semibold text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                          <Gift className="w-4 h-4" /> Referral Program
                        </Link>
                      </div>
                      <div className="p-1.5 border-t border-gray-100">
                        <button
                          onClick={async () => { await logout(); setProfileOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[0.8125rem] font-semibold text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                href="/login"
                className="relative hidden sm:flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-orange-600 hover:bg-orange-50/60 transition-all"
                title="Sign in"
              >
                <LogIn className="w-[1.15rem] h-[1.15rem]" />
              </Link>
            )}

            <Link
              href="/wishlist"
              className="relative hidden sm:flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-orange-600 hover:bg-orange-50/60 transition-all"
            >
              <Heart className="w-[1.15rem] h-[1.15rem]" />
              {wishlistCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-[1.15rem] h-[1.15rem] text-[9px] font-black text-white rounded-full flex items-center justify-center ring-2 ring-white"
                  style={{ background: '#E85D04' }}
                >
                  {wishlistCount}
                </span>
              )}
            </Link>

            <button
              onClick={() => setCartDrawerOpen(true)}
              className={cn(
                "relative flex items-center gap-2 rounded-full font-bold text-[0.8125rem] transition-all active:scale-95",
                itemCount > 0
                  ? "text-white px-5 py-2.5"
                  : "text-gray-600 px-4 py-2.5 border border-gray-200 bg-white hover:border-orange-300 hover:text-orange-600"
              )}
              style={itemCount > 0 ? {
                background: 'linear-gradient(135deg, #E85D04, #FB8500)',
                boxShadow: '0 4px 16px rgba(232,93,4,0.3)'
              } : undefined}
              aria-label={`Shopping cart with ${itemCount} items`}
            >
              <ShoppingCart className="w-[1.05rem] h-[1.05rem]" />
              <span className="hidden sm:inline">
                {itemCount > 0 ? `Cart (${itemCount})` : "Cart"}
              </span>
              {itemCount > 0 && <span className="sm:hidden font-black text-xs">{itemCount}</span>}
            </button>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-full text-gray-600 hover:text-orange-600 hover:bg-orange-50 transition-all"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="md:hidden overflow-hidden bg-white border-t border-gray-100"
          >
            <div className="px-5 py-5 space-y-1">
              {/* Mobile search */}
              <form onSubmit={handleSearch} className="flex items-center gap-2 mb-3">
                <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-2xl border border-gray-200 bg-gray-50">
                  <Search className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type="search"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-gray-800 text-sm placeholder:text-gray-400"
                    autoComplete="off"
                  />
                </div>
                <button type="submit"
                  className="px-4 py-2.5 rounded-2xl font-bold text-white text-sm"
                  style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}>
                  Go
                </button>
              </form>

              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3.5 rounded-2xl font-semibold text-[0.9375rem] transition-all",
                    location === link.href
                      ? "text-orange-600 bg-orange-50"
                      : "text-gray-700 hover:text-orange-600 hover:bg-orange-50"
                  )}
                >
                  {link.label}
                  {link.badge && (
                    <span
                      className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-full text-white"
                      style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}
                    >
                      {link.badge}
                    </span>
                  )}
                </Link>
              ))}
              <div className="pt-3 mt-3 border-t border-gray-100 space-y-1">
                {isAuthenticated ? (
                  <>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-orange-50 mb-1">
                      {customer?.avatar ? (
                        <img src={customer.avatar} alt={customer.name ? `${customer.name}'s avatar` : "User avatar"} className="w-9 h-9 rounded-full object-cover border-2 border-orange-200 shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black shrink-0" style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)" }} aria-hidden="true">
                          {customer?.name?.[0]?.toUpperCase() || "U"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{customer?.name}</p>
                        <p className="text-xs text-gray-400 truncate">{customer?.email}</p>
                      </div>
                    </div>
                    <Link href="/account" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl font-semibold text-[0.9375rem] text-gray-700 hover:text-orange-600 hover:bg-orange-50 transition-all">
                      <User style={{ width: '1.1rem', height: '1.1rem' }} aria-hidden="true" /> My Profile
                    </Link>
                    <Link href="/account" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl font-semibold text-[0.9375rem] text-gray-700 hover:text-orange-600 hover:bg-orange-50 transition-all"
                      onClick={() => { setMobileOpen(false); setTimeout(() => window.dispatchEvent(new CustomEvent("account-tab", { detail: "orders" })), 50); }}>
                      <ShoppingBag style={{ width: '1.1rem', height: '1.1rem' }} aria-hidden="true" /> My Orders
                    </Link>
                    <Link href="/wishlist" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl font-semibold text-[0.9375rem] text-gray-700 hover:text-orange-600 hover:bg-orange-50 transition-all">
                      <Heart style={{ width: '1.1rem', height: '1.1rem' }} aria-hidden="true" /> Wishlist {wishlistCount > 0 && `(${wishlistCount})`}
                    </Link>
                    <button
                      onClick={async () => { setMobileOpen(false); await logout(); }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-semibold text-[0.9375rem] text-red-500 hover:bg-red-50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded-2xl"
                    >
                      <LogOut style={{ width: '1.1rem', height: '1.1rem' }} aria-hidden="true" /> Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl font-semibold text-[0.9375rem] text-gray-700 hover:text-orange-600 hover:bg-orange-50 transition-all">
                      <LogIn style={{ width: '1.1rem', height: '1.1rem' }} aria-hidden="true" /> Sign In
                    </Link>
                    <Link href="/signup" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl font-semibold text-[0.9375rem] text-gray-700 hover:text-orange-600 hover:bg-orange-50 transition-all">
                      <User style={{ width: '1.1rem', height: '1.1rem' }} aria-hidden="true" /> Create Account
                    </Link>
                    <Link href="/wishlist" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl font-semibold text-[0.9375rem] text-gray-700 hover:text-orange-600 hover:bg-orange-50 transition-all">
                      <Heart style={{ width: '1.1rem', height: '1.1rem' }} aria-hidden="true" /> Wishlist {wishlistCount > 0 && `(${wishlistCount})`}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden bg-white border-t border-gray-100 shadow-lg"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <form onSubmit={handleSearch} className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-orange-200 bg-orange-50/40 focus-within:border-orange-400 transition-colors">
                  <Search className="w-4 h-4 text-orange-400 shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    placeholder="Search T-shirts, Hoodies, Caps, Mugs..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-gray-800 font-medium text-sm placeholder:text-gray-400"
                    autoComplete="off"
                  />
                  <kbd className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold text-gray-400 border border-gray-200 bg-white">
                    ESC
                  </kbd>
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-2xl font-bold text-white text-sm transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}
                >
                  Search
                </button>
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </form>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs text-gray-400 font-semibold">Popular:</span>
                {['Custom T-Shirt', 'Oversized Hoodie', 'Logo Cap', 'Custom Mug'].map(term => (
                  <button
                    key={term}
                    onClick={() => { navigate(`/products?search=${encodeURIComponent(term)}`); setSearchOpen(false); setSearchQuery(""); }}
                    className="px-3 py-1 rounded-full text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 transition-colors border border-orange-100"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CartDrawer open={cartDrawerOpen} onClose={() => setCartDrawerOpen(false)} />
    </header>
  );
}
