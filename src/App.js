import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';

import CustomerTrackingPage from './pages/CustomerTrackingPage';
import AdminDashboard from './pages/AdminDashboard';
import DriverApp from './pages/DriverApp';
import DriverDashboard from './pages/DriverDashboard';
import AuthPage from './pages/AuthPage';

import CreateTripForm from './components/CreateTripForm';
import { getAuthUser, logoutUser } from './services/apiService';
import 'leaflet/dist/leaflet.css';
import NotFound from './pages/NotFound';

// Redirects unauthenticated users to /auth
const ProtectedRoute = ({ children }) => {
  const user = getAuthUser();
  if (!user) return <Navigate to="/auth" replace />;
  return children;
};

const CustomerOrderLayout = ({ orderType }) => {
  const pageMap = {
    shopping: {
      title: 'Shopping Order',
      subtitle: 'Place your grocery, fruits, vegetables, or market order.',
      icon: '🛒',
    },
    pickup_drop: {
      title: 'Pickup & Drop',
      subtitle: 'Book a pickup from one address and delivery to another address.',
      icon: '📦',
    },
    ride: {
      title: 'Ride Booking',
      subtitle: 'Book a ride by giving pickup and destination details.',
      icon: '🏍️',
    },
  };

  const current = pageMap[orderType] || pageMap.pickup_drop;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-xl font-bold text-blue-700 flex items-center gap-2">
            🚚 <span>Quick Delivery</span>
          </Link>
          <Link
            to="/"
            className="px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 text-sm font-medium transition-colors"
          >
            ← Home
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <div className="text-4xl mb-3">{current.icon}</div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">{current.title}</h1>
          <p className="text-slate-500 text-base">{current.subtitle}</p>
        </div>

        <CreateTripForm orderType={orderType} />
      </div>
    </div>
  );
};

const HomePage = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = getAuthUser();
    setUser(u);
  }, []);

  const handleLogout = () => {
    logoutUser();
    window.location.href = '/';
  };

  const goDashboard = () => {
    if (!user) {
      window.location.href = '/auth';
      return;
    }

    if (user.role === 'admin') window.location.href = '/admin';
    else if (user.role === 'driver') window.location.href = '/driver-dashboard';
    else window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <nav className="bg-white shadow-sm border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-xl font-bold text-blue-700 flex items-center gap-2">
            🚚 <span>Quick Delivery</span>
          </Link>

          <div className="flex gap-3 items-center">
            {user ? (
              <>
                <span className="text-sm text-slate-700 hidden sm:block font-medium">
                  Hi, {user.name}
                </span>
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm transition-colors"
                  >
                    Admin
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium text-sm transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors"
              >
                Login / Signup
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-14">
          <div className="mb-6 flex justify-center">
            <svg width="72" height="80" viewBox="0 0 72 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Map base */}
              <rect x="4" y="28" width="64" height="44" rx="4" fill="#4ade80" />
              <rect x="4" y="28" width="64" height="44" rx="4" fill="url(#mapgrad)" />
              <line x1="4" y1="44" x2="68" y2="44" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
              <line x1="4" y1="58" x2="68" y2="58" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
              <line x1="24" y1="28" x2="24" y2="72" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
              <line x1="48" y1="28" x2="48" y2="72" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
              {/* Road */}
              <path d="M4 54 Q20 48 36 50 Q52 52 68 46" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
              {/* Pin shadow */}
              <ellipse cx="36" cy="72" rx="10" ry="3" fill="black" fillOpacity="0.15" />
              {/* Pin body */}
              <path d="M36 8 C26 8 18 16 18 26 C18 38 36 56 36 56 C36 56 54 38 54 26 C54 16 46 8 36 8Z" fill="#ef4444" />
              <circle cx="36" cy="26" r="8" fill="white" fillOpacity="0.9" />
              <circle cx="36" cy="26" r="4" fill="#ef4444" />
              {/* Shine on pin */}
              <ellipse cx="30" cy="20" rx="4" ry="3" fill="white" fillOpacity="0.3" transform="rotate(-20 30 20)" />
              <defs>
                <linearGradient id="mapgrad" x1="4" y1="28" x2="68" y2="72" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="50%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#6ee7b7" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 leading-tight">
            Delivery & Ride Platform
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Shopping orders, pickup & drop, and ride booking — with live driver tracking.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Link
            to="/book/shopping"
            className="group p-7 bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-200 transition-all"
          >
            <div className="text-4xl mb-4">🛒</div>
            <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">Shopping Order</h3>
            <p className="text-slate-500 text-sm leading-relaxed">Order groceries, vegetables, fruits, and market items delivered to your door.</p>
            <div className="mt-5 text-sm font-semibold text-blue-600 group-hover:underline">Book now →</div>
          </Link>

          <Link
            to="/book/pickup-drop"
            className="group p-7 bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-200 transition-all"
          >
            <div className="text-4xl mb-4">📦</div>
            <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">Pickup & Drop</h3>
            <p className="text-slate-500 text-sm leading-relaxed">Send parcels and packages from one address to another quickly.</p>
            <div className="mt-5 text-sm font-semibold text-blue-600 group-hover:underline">Book now →</div>
          </Link>

          <Link
            to="/book/ride"
            className="group p-7 bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-200 transition-all"
          >
            <div className="text-4xl mb-4">🏍️</div>
            <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">Ride Booking</h3>
            <p className="text-slate-500 text-sm leading-relaxed">Book a ride with pickup and destination — track your driver live.</p>
            <div className="mt-5 text-sm font-semibold text-blue-600 group-hover:underline">Book now →</div>
          </Link>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <Routes>
          <Route path="/auth" element={<AuthPage />} />

          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />

          <Route path="/driver-dashboard" element={<ProtectedRoute><DriverDashboard /></ProtectedRoute>} />
          <Route path="/driver/:trackingId" element={<ProtectedRoute><DriverApp /></ProtectedRoute>} />

          <Route path="/track/:trackingId" element={<CustomerTrackingPage />} />

          <Route path="/book/shopping" element={<ProtectedRoute><CustomerOrderLayout orderType="shopping" /></ProtectedRoute>} />
          <Route path="/book/pickup-drop" element={<ProtectedRoute><CustomerOrderLayout orderType="pickup_drop" /></ProtectedRoute>} />
          <Route path="/book/ride" element={<ProtectedRoute><CustomerOrderLayout orderType="ride" /></ProtectedRoute>} />

          {/* Root: redirect to /auth if not logged in, else show home */}
          <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;