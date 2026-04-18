import { AdminLayout } from "@/components/layout/AdminLayout";
import { BookOpen, ExternalLink, CheckCircle2, AlertCircle, Copy, Facebook } from "lucide-react";
import { useState } from "react";

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative bg-gray-900 rounded-lg p-4 mt-2 overflow-x-auto">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 text-gray-400 hover:text-white p-1 rounded"
      >
        {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
      </button>
      <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">{text}</pre>
    </div>
  );
}

export default function AdminFacebookGuide() {
  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Facebook className="w-7 h-7 text-blue-600" />
            Facebook Product Import — Setup Guide
          </h1>
          <p className="text-gray-500 mt-1">Step-by-step guide to import products from your Facebook page</p>
        </div>

        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-blue-50">
              <h2 className="font-bold text-blue-900 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">1</span>
                Create a Facebook App
              </h2>
            </div>
            <div className="p-5 space-y-3 text-sm text-gray-700">
              <p>Go to <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">Meta for Developers <ExternalLink className="w-3 h-3" /></a></p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Click <strong>"Create App"</strong></li>
                <li>Choose <strong>"Business"</strong> type</li>
                <li>Enter app name: <strong>"TryNex Import Tool"</strong></li>
                <li>Select your Facebook page as the business</li>
                <li>Once created, go to <strong>App Settings → Basic</strong></li>
                <li>Copy the <strong>App ID</strong> and <strong>App Secret</strong></li>
              </ol>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-blue-50">
              <h2 className="font-bold text-blue-900 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">2</span>
                Get a Page Access Token
              </h2>
            </div>
            <div className="p-5 space-y-3 text-sm text-gray-700">
              <p>Go to <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">Graph API Explorer <ExternalLink className="w-3 h-3" /></a></p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Select your app from the dropdown</li>
                <li>Click <strong>"Get User Access Token"</strong></li>
                <li>Check permissions: <code className="bg-gray-100 px-1.5 rounded">pages_read_engagement</code>, <code className="bg-gray-100 px-1.5 rounded">pages_show_list</code></li>
                <li>Click <strong>"Generate Access Token"</strong></li>
                <li>Then select your <strong>Page</strong> from the user token dropdown to get a <strong>Page Access Token</strong></li>
              </ol>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 mt-4">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800">Important</p>
                  <p className="text-amber-700">Short-lived tokens expire in ~1 hour. For a long-lived token, use the <strong>Access Token Debugger</strong> and click <strong>"Extend Access Token"</strong>.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-blue-50">
              <h2 className="font-bold text-blue-900 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">3</span>
                Find Your Page ID
              </h2>
            </div>
            <div className="p-5 space-y-3 text-sm text-gray-700">
              <p>In the Graph API Explorer, type this in the query field:</p>
              <CopyBlock text="me/accounts" />
              <p>Click <strong>Submit</strong>. You'll see your pages listed. Copy the <code className="bg-gray-100 px-1.5 rounded">id</code> field — this is your <strong>Page ID</strong>.</p>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-blue-50">
              <h2 className="font-bold text-blue-900 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">4</span>
                Fetch Products from Facebook
              </h2>
            </div>
            <div className="p-5 space-y-3 text-sm text-gray-700">
              <p>Now use the API to fetch posts with product images:</p>
              <CopyBlock text={`GET https://graph.facebook.com/v19.0/{PAGE_ID}/posts?fields=message,full_picture,created_time,attachments{media,description,title}&access_token={ACCESS_TOKEN}`} />
              <p className="mt-3">Or use the <strong>Social Media Import</strong> page in this admin panel:</p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Go to <a href="/admin/facebook-import" className="text-blue-600 hover:underline">Social Media Import</a></li>
                <li>Paste a Facebook post URL</li>
                <li>The system will auto-detect product details (name, price, sizes, colors)</li>
                <li>Review and import to your product catalog</li>
              </ol>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-blue-50">
              <h2 className="font-bold text-blue-900 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">5</span>
                Set Up Facebook Login (For Customers)
              </h2>
            </div>
            <div className="p-5 space-y-3 text-sm text-gray-700">
              <p>To let customers log in with Facebook:</p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>In your Facebook App, go to <strong>Add Product → Facebook Login</strong></li>
                <li>Set <strong>Valid OAuth Redirect URIs</strong> to your site URL:
                  <CopyBlock text="https://trynexshop.com/login" />
                </li>
                <li>Copy your <strong>App ID</strong></li>
                <li>Add the Facebook SDK to your site's <code className="bg-gray-100 px-1.5 rounded">index.html</code>:
                  <CopyBlock text={`<script async defer crossorigin="anonymous"\n  src="https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v19.0&appId=YOUR_APP_ID">\n</script>`} />
                </li>
                <li>Initialize FB in your code:
                  <CopyBlock text={`window.fbAsyncInit = function() {\n  FB.init({\n    appId: 'YOUR_APP_ID',\n    cookie: true,\n    xfbml: true,\n    version: 'v19.0'\n  });\n};`} />
                </li>
              </ol>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-blue-50">
              <h2 className="font-bold text-blue-900 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">6</span>
                Set Up Google Login (For Customers)
              </h2>
            </div>
            <div className="p-5 space-y-3 text-sm text-gray-700">
              <p>To let customers log in with Google:</p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">Google Cloud Console <ExternalLink className="w-3 h-3" /></a></li>
                <li>Create a new project or select existing one</li>
                <li>Go to <strong>Credentials → Create Credentials → OAuth 2.0 Client ID</strong></li>
                <li>Set type to <strong>Web application</strong></li>
                <li>Add <strong>Authorized JavaScript origins</strong>: <code className="bg-gray-100 px-1.5 rounded">https://trynexshop.com</code></li>
                <li>Copy the <strong>Client ID</strong></li>
                <li>Set the env variable: <code className="bg-gray-100 px-1.5 rounded">VITE_GOOGLE_CLIENT_ID=your_client_id</code></li>
                <li>Add Google Sign-In script to <code className="bg-gray-100 px-1.5 rounded">index.html</code>:
                  <CopyBlock text={`<script src="https://accounts.google.com/gsi/client" async defer></script>`} />
                </li>
              </ol>
            </div>
          </section>

          <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-green-900">You're all set!</p>
              <p className="text-green-700 text-sm mt-1">
                Once configured, customers can sign in with Google, Facebook, or email. Products can be imported from Facebook posts. 
                All data flows through your secure API and is stored in your PostgreSQL database.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
