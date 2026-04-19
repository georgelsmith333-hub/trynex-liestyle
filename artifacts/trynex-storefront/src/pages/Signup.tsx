import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/context/AuthContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { Eye, EyeOff, Mail, Lock, User, Phone, Loader2, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Signup() {
  const [, navigate] = useLocation();
  const { register, loginWithGoogle, loginWithFacebook } = useAuth();
  const { googleClientId, facebookAppId } = useSiteSettings();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string; confirmPassword?: string }>({});
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const googleInitRef = useRef(false);

  const redirectTo = new URLSearchParams(window.location.search).get("redirect") || "/account";

  const passwordStrength = (() => {
    if (password.length === 0) return 0;
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Excellent"][passwordStrength];
  const strengthColor = ["", "bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-400", "bg-emerald-500"][passwordStrength];

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
      text: "signup_with",
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
    const errs: typeof fieldErrors = {};
    if (!name.trim()) errs.name = "Full name is required";
    else if (name.trim().length < 2) errs.name = "Name must be at least 2 characters";
    if (!email) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email address";
    if (!password) errs.password = "Password is required";
    else if (password.length < 6) errs.password = "Password must be at least 6 characters";
    if (password && password !== confirmPassword) errs.confirmPassword = "Passwords do not match";
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setLoading(true);
    const result = await register({ name, email, phone: phone || undefined, password });
    if (result.success) {
      navigate(redirectTo);
    } else {
      setError(result.error || "Registration failed");
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
      <SEOHead title="Create Account" description="Sign up for a TryNex Lifestyle account" noindex />
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 pt-header pb-12 sm:pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black font-display text-gray-900">Create Account</h1>
            <p className="text-gray-500 mt-2">Join TryNex Lifestyle today</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {googleClientId && (
              <div ref={googleBtnRef} className="w-full mb-3 flex justify-center [&>div]:!w-full" />
            )}

            {facebookAppId && (
              <button
                onClick={handleFacebookLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 hover:bg-blue-50 transition-all text-sm font-medium text-gray-700 disabled:opacity-50 mb-4"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Sign up with Facebook
              </button>
            )}

            {(googleClientId || facebookAppId) && (
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-gray-400 uppercase tracking-wider">or register with email</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="signup-name" className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" aria-hidden="true" />
                  <input
                    id="signup-name"
                    type="text"
                    inputMode="text"
                    autoCapitalize="words"
                    enterKeyHint="next"
                    value={name}
                    onChange={(e) => { setName(e.target.value); if (fieldErrors.name) setFieldErrors(p => ({ ...p, name: undefined })); }}
                    placeholder="Your full name"
                    autoComplete="name"
                    aria-invalid={!!fieldErrors.name}
                    aria-describedby={fieldErrors.name ? "signup-name-error" : undefined}
                    className={`w-full pl-11 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-orange-100 outline-none transition-all text-sm ${fieldErrors.name ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-orange-400"}`}
                  />
                </div>
                {fieldErrors.name && <p id="signup-name-error" role="alert" className="text-red-500 text-xs mt-1.5">{fieldErrors.name}</p>}
              </div>

              <div>
                <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" aria-hidden="true" />
                  <input
                    id="signup-email"
                    type="email"
                    inputMode="email"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: undefined })); }}
                    placeholder="your@gmail.com"
                    autoComplete="email"
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? "signup-email-error" : undefined}
                    className={`w-full pl-11 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-orange-100 outline-none transition-all text-sm ${fieldErrors.email ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-orange-400"}`}
                  />
                </div>
                {fieldErrors.email && <p id="signup-email-error" role="alert" className="text-red-500 text-xs mt-1.5">{fieldErrors.email}</p>}
              </div>

              <div>
                <label htmlFor="signup-phone" className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" aria-hidden="true" />
                  <input
                    id="signup-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    enterKeyHint="next"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1.5">Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" aria-hidden="true" />
                  <input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    enterKeyHint="next"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors(p => ({ ...p, password: undefined })); }}
                    placeholder="Min 6 characters"
                    autoComplete="new-password"
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? "signup-password-error" : "signup-password-hint"}
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
                {fieldErrors.password && <p id="signup-password-error" role="alert" className="text-red-500 text-xs mt-1.5">{fieldErrors.password}</p>}
                {password && (
                  <div className="mt-2" id="signup-password-hint">
                    <div className="flex gap-1 mb-1" role="progressbar" aria-valuenow={passwordStrength} aria-valuemin={0} aria-valuemax={5} aria-label="Password strength">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-all ${i <= passwordStrength ? strengthColor : "bg-gray-200"}`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">{strengthLabel}</p>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" aria-hidden="true" />
                  <input
                    id="signup-confirm-password"
                    type={showPassword ? "text" : "password"}
                    enterKeyHint="go"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); if (fieldErrors.confirmPassword) setFieldErrors(p => ({ ...p, confirmPassword: undefined })); }}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    aria-invalid={!!fieldErrors.confirmPassword}
                    aria-describedby={fieldErrors.confirmPassword ? "signup-confirm-error" : undefined}
                    className={`w-full pl-11 pr-11 py-3 rounded-xl border focus:ring-2 focus:ring-orange-100 outline-none transition-all text-sm ${fieldErrors.confirmPassword ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-orange-400"}`}
                  />
                  {confirmPassword && password === confirmPassword && !fieldErrors.confirmPassword && (
                    <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-green-500" aria-hidden="true" />
                  )}
                </div>
                {fieldErrors.confirmPassword && <p id="signup-confirm-error" role="alert" className="text-red-500 text-xs mt-1.5">{fieldErrors.confirmPassword}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Create Account
              </button>

              <p className="text-xs text-gray-400 text-center">
                By creating an account, you agree to our{" "}
                <a href="/terms-of-service" className="text-orange-500 hover:underline">Terms</a> and{" "}
                <a href="/privacy-policy" className="text-orange-500 hover:underline">Privacy Policy</a>.
              </p>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Already have an account?{" "}
              <a href="/login" className="text-orange-500 hover:text-orange-600 font-semibold">
                Sign In
              </a>
            </p>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
