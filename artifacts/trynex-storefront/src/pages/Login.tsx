import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/context/AuthContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { Eye, EyeOff, Mail, Lock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const [, navigate] = useLocation();
  const { login, loginWithGoogle, loginWithFacebook } = useAuth();
  const { googleClientId, facebookAppId } = useSiteSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const googleInitRef = useRef(false);

  const redirectTo = new URLSearchParams(window.location.search).get("redirect") || "/account";

  const initGoogleButton = useCallback(() => {
    if (!googleClientId || !window.google?.accounts?.id || !googleBtnRef.current || googleInitRef.current) return;
    googleInitRef.current = true;
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response: { credential: string }) => {
        setLoading(true);
        setError("");
        const result = await loginWithGoogle(response.credential);
        if (result.success) navigate(redirectTo);
        else setError(result.error || "Google login failed");
        setLoading(false);
      },
      ux_mode: "popup",
    });
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      width: googleBtnRef.current.offsetWidth,
    });
  }, [googleClientId, loginWithGoogle, navigate, redirectTo]);

  useEffect(() => {
    initGoogleButton();
    if (googleClientId && !window.google?.accounts?.id) {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          initGoogleButton();
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [initGoogleButton, googleClientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const errs: { email?: string; password?: string } = {};
    if (!email) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email address";
    if (!password) errs.password = "Password is required";
    else if (password.length < 6) errs.password = "Password must be at least 6 characters";
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setLoading(true);
    const result = await login(email, password);
    if (result.success) {
      navigate(redirectTo);
    } else {
      setError(result.error || "Login failed");
    }
    setLoading(false);
  };

  const handleFacebookLogin = () => {
    if (!facebookAppId) {
      setError("Facebook Login is not set up yet.");
      return;
    }
    if (!window.FB) {
      setError("Facebook SDK is still loading. Please wait a moment and try again.");
      return;
    }
    window.FB.login(async (response) => {
      if (response.authResponse?.accessToken) {
        setLoading(true);
        const result = await loginWithFacebook(response.authResponse.accessToken);
        if (result.success) navigate(redirectTo);
        else setError(result.error || "Facebook login failed");
        setLoading(false);
      } else {
        setError("Facebook login was cancelled or failed. Please try again.");
      }
    }, { scope: "email,public_profile" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <SEOHead title="Login" description="Sign in to your TryNex Lifestyle account" noindex />
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 pt-header pb-12 sm:pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black font-display text-gray-900">Welcome Back</h1>
            <p className="text-gray-500 mt-2">Sign in to your TryNex account</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" aria-hidden="true" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: undefined })); }}
                    placeholder="your@email.com"
                    autoComplete="email"
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
                    className={`w-full pl-11 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-orange-100 outline-none transition-all text-sm ${fieldErrors.email ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-orange-400"}`}
                  />
                </div>
                {fieldErrors.email && <p id="login-email-error" role="alert" className="text-red-500 text-xs mt-1.5">{fieldErrors.email}</p>}
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" aria-hidden="true" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors(p => ({ ...p, password: undefined })); }}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
                    className={`w-full pl-11 pr-11 py-3 rounded-xl border focus:ring-2 focus:ring-orange-100 outline-none transition-all text-sm ${fieldErrors.password ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-orange-400"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
                {fieldErrors.password && <p id="login-password-error" role="alert" className="text-red-500 text-xs mt-1.5">{fieldErrors.password}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Sign In
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-gray-400 uppercase tracking-wider">or continue with</span>
              </div>
            </div>

            {googleClientId && (
              <div ref={googleBtnRef} className="w-full mb-3 flex justify-center [&>div]:!w-full" />
            )}

            {facebookAppId && (
              <button
                onClick={handleFacebookLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 hover:bg-blue-50 transition-all text-sm font-medium text-gray-700 disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Sign in with Facebook
              </button>
            )}

            <p className="text-center text-sm text-gray-500 mt-6">
              Don't have an account?{" "}
              <a href="/signup" className="text-orange-500 hover:text-orange-600 font-semibold">
                Create Account
              </a>
            </p>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
