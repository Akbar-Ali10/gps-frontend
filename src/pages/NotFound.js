import React from 'react';
import { getAuthUser } from '../services/apiService';

const NotFound = () => {
  const user = getAuthUser();

  const getRedirectInfo = () => {
    if (!user) {
      return { label: 'Go to Login', href: '/auth', emoji: '🔐' };
    }
    if (user.role === 'admin') {
      return { label: 'Go to Admin Dashboard', href: '/admin', emoji: '🛠️' };
    }
    if (user.role === 'driver') {
      return { label: 'Go to Driver Dashboard', href: '/driver-dashboard', emoji: '🚗' };
    }
    // customer
    return { label: 'Go to Home', href: '/', emoji: '🏠' };
  };

  const { label, href, emoji } = getRedirectInfo();

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-9xl font-black text-gray-800 mb-2">404</div>
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-3xl font-black mb-3">Page Not Found</h1>
        <p className="text-gray-400 mb-8">
          The page you are looking for does not exist.
        </p>
        <a
          href={href}
          className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold text-lg transition-all active:scale-95"
        >
          {emoji} {label}
        </a>
      </div>
    </div>
  );
};

export default NotFound;