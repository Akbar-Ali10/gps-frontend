import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';

import CustomerTrackingPage from './pages/CustomerTrackingPage';
import AdminDashboard from './pages/AdminDashboard';
import DriverApp from './pages/DriverApp';
import DriverDashboard from './pages/DriverDashboard';
import AuthPage from './pages/AuthPage';

import CreateTripForm from './components/CreateTripForm';
import { getAuthUser, logoutUser } from './services/apiService';

// Redirects unauthenticated users to /auth
const ProtectedRoute = ({ children }) => {
  const user = getAuthUser();
  if (!user) return <Navigate to="/auth" replace />;
  return children;
};

import 'leaflet/dist/leaflet.css';

const CustomerOrderLayout = ({ orderType }) => {
  const pageMap = {
    shopping: {
      title: 'Shopping Booking',
      subtitle: 'Place your grocery, fruits, vegetables, or market order.',
    },
    pickup_drop: {
      title: 'Pickup & Drop Booking',
      subtitle: 'Book a pickup from one address and delivery to another address.',
    },
    ride: {
      title: 'Ride Booking',
      subtitle: 'Book a ride by giving pickup and destination details.',
    },
  };

  const current = pageMap[orderType] || pageMap.pickup_drop;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-indigo-100">
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-blue-700">
            🚚 Quick Delivery
          </Link>

          <Link
            to="/"
            className="px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800"
          >
            Home
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2 text-slate-900">{current.title}</h1>
        <p className="text-slate-600 mb-6">{current.subtitle}</p>

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-blue-600">
            🚚 Quick Delivery
          </Link>

          <div className="flex gap-3 items-center flex-wrap justify-end">
            {user ? (
              <>
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                  >
                    Admin Dashboard
                  </Link>
                )}

                <button
                  onClick={handleLogout}
                  className="px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                className="px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium"
              >
                Login / Signup
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="text-6xl mb-5">📍</div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">
            Delivery & Ride Platform
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Shopping orders, pickup & drop, ride booking, live driver tracking, and admin monitoring.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10">
          <Link
            to="/book/shopping"
            className="p-8 bg-white rounded-2xl shadow-lg border border-slate-200 hover:shadow-xl transition-all"
          >
            <div className="text-4xl mb-4">🛒</div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Shopping Order</h3>
            <p className="text-slate-600">Order groceries, vegetables, fruits, and market items.</p>
          </Link>

          <Link
            to="/book/pickup-drop"
            className="p-8 bg-white rounded-2xl shadow-lg border border-slate-200 hover:shadow-xl transition-all"
          >
            <div className="text-4xl mb-4">📦</div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Pickup & Drop</h3>
            <p className="text-slate-600">Send parcels from one address to another.</p>
          </Link>

          <Link
            to="/book/ride"
            className="p-8 bg-white rounded-2xl shadow-lg border border-slate-200 hover:shadow-xl transition-all"
          >
            <div className="text-4xl mb-4">🏍️</div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Ride Booking</h3>
            <p className="text-slate-600">Book a ride with pickup and destination details.</p>
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
        </Routes>
      </div>
    </Router>
  );
}

export default App;