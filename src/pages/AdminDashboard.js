import React, { useEffect, useState } from 'react';
import TripList from '../components/TripList';
import AdminLiveMap from '../components/AdminLiveMap';
import { getAllTrips, getAllDrivers, logoutUser } from '../services/apiService';

const AdminDashboard = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [dashboardStats, setDashboardStats] = useState({
    totalOrders: 0,
    activeOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalDrivers: 0,
    onlineDrivers: 0,
    offlineDrivers: 0,
    shoppingOrders: 0,
    pickupDropOrders: 0,
    rideOrders: 0,
    topDrivers: [],
  });

  const loadDashboardStats = async () => {
    try {
      const [tripsRes, driversRes] = await Promise.all([
        getAllTrips(null, 500, 0),
        getAllDrivers(),
      ]);

      const trips = tripsRes?.trips || [];
      const drivers = driversRes?.drivers || [];

      setDashboardStats({
        totalOrders: trips.length,
        activeOrders: trips.filter(
          (t) => t.status === 'active' || t.status === 'in-progress'
        ).length,
        pendingOrders: trips.filter((t) => t.status === 'pending').length,
        completedOrders: trips.filter((t) => t.status === 'completed').length,
        cancelledOrders: trips.filter((t) => t.status === 'cancelled').length,
        totalDrivers: drivers.length,
        onlineDrivers: drivers.filter((d) => d.status === 'online').length,
        offlineDrivers: drivers.filter((d) => d.status !== 'online').length,
        shoppingOrders: trips.filter((t) => t.order_type === 'shopping').length,
        pickupDropOrders: trips.filter((t) => t.order_type === 'pickup_drop').length,
        rideOrders: trips.filter((t) => t.order_type === 'ride').length,
        topDrivers: [...drivers]
          .sort((a, b) => {
            if ((b.average_rating || 0) !== (a.average_rating || 0)) {
              return (b.average_rating || 0) - (a.average_rating || 0);
            }
            return (b.completed_trips || 0) - (a.completed_trips || 0);
          })
          .slice(0, 5),
      });
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    }
  };

  useEffect(() => {
    loadDashboardStats();
  }, [refreshTrigger]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger((prev) => prev + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-5 flex justify-between items-center">
          <div>
            <div className="text-sm font-medium text-blue-200 mb-1">🚚 Quick Delivery</div>
            <h1 className="text-2xl md:text-3xl font-bold leading-tight">Admin Dashboard</h1>
            <p className="text-blue-200 mt-1 text-xs md:text-sm">
              Monitor orders, drivers, live tracking, and system activity
            </p>
          </div>
          <button
            onClick={() => { logoutUser(); window.location.href = '/auth'; }}
            className="px-4 py-2 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Live Driver Tracking
          </h2>

          <p className="text-sm text-slate-500 mb-4">
            View live location, destination and route line of all active drivers
          </p>

          <AdminLiveMap refreshTrigger={refreshTrigger} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-300">Total Orders</p>
            <p className="text-3xl font-bold mt-2">{dashboardStats.totalOrders}</p>
          </div>

          <div className="bg-blue-600 text-white rounded-2xl p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-blue-100">Active Orders</p>
            <p className="text-3xl font-bold mt-2">{dashboardStats.activeOrders}</p>
          </div>

          <div className="bg-amber-500 text-white rounded-2xl p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-amber-50">Pending Orders</p>
            <p className="text-3xl font-bold mt-2">{dashboardStats.pendingOrders}</p>
          </div>

          <div className="bg-emerald-600 text-white rounded-2xl p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-emerald-100">Completed Orders</p>
            <p className="text-3xl font-bold mt-2">{dashboardStats.completedOrders}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-400 font-semibold">Cancelled</p>
            <p className="text-2xl font-bold text-rose-600 mt-2">
              {dashboardStats.cancelledOrders}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-400 font-semibold">Total Drivers</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {dashboardStats.totalDrivers}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-400 font-semibold">Online Drivers</p>
            <p className="text-2xl font-bold text-emerald-600 mt-2">
              {dashboardStats.onlineDrivers}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-400 font-semibold">Offline Drivers</p>
            <p className="text-2xl font-bold text-slate-700 mt-2">
              {dashboardStats.offlineDrivers}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-400 font-semibold">Shopping</p>
            <p className="text-2xl font-bold text-emerald-700 mt-2">
              {dashboardStats.shoppingOrders}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-400 font-semibold">Pickup/Ride</p>
            <p className="text-2xl font-bold text-indigo-700 mt-2">
              {dashboardStats.pickupDropOrders + dashboardStats.rideOrders}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-5 overflow-hidden">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Orders Monitoring</h2>
                  <p className="text-sm text-slate-500">
                    Monitor all orders, rides and tracking links from here
                  </p>
                </div>

                <button
                  onClick={() => setRefreshTrigger((prev) => prev + 1)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
                >
                  Refresh Data
                </button>
              </div>

              <TripList refreshTrigger={refreshTrigger} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-xl font-bold text-slate-900 mb-4">System Overview</h2>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-slate-600">Shopping Orders</span>
                  <span className="font-bold text-slate-900">{dashboardStats.shoppingOrders}</span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-slate-600">Pickup & Drop</span>
                  <span className="font-bold text-slate-900">{dashboardStats.pickupDropOrders}</span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-slate-600">Ride Orders</span>
                  <span className="font-bold text-slate-900">{dashboardStats.rideOrders}</span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-slate-600">Online Drivers</span>
                  <span className="font-bold text-emerald-600">{dashboardStats.onlineDrivers}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-xl font-bold text-slate-900 mb-4">🏆 Top Drivers</h2>

              <div className="space-y-3">
                {dashboardStats.topDrivers && dashboardStats.topDrivers.length > 0 ? (
                  dashboardStats.topDrivers.map((driver, idx) => (
                    <div
                      key={driver.id}
                      className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-blue-100 text-blue-700">
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{driver.name}</p>
                          <p className="text-xs text-slate-500">
                            {driver.completed_trips || 0} rides • {driver.total_reviews || 0} reviews
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-amber-500">
                          ⭐ {driver.average_rating || 'N/A'}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 italic text-center py-4">
                    No reviews yet.
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Quick Actions</h2>

              <div className="grid grid-cols-1 gap-4">
                <a
                  href="/"
                  className="p-4 rounded-2xl border border-blue-100 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <div className="text-2xl mb-2">🏠</div>
                  <div className="font-semibold text-slate-900">Home</div>
                  <div className="text-sm text-slate-600 mt-1">Go to main page</div>
                </a>

                <a
                  href="/driver-dashboard"
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="text-2xl mb-2">🚗</div>
                  <div className="font-semibold text-slate-900">Driver Dashboard</div>
                  <div className="text-sm text-slate-600 mt-1">
                    Drivers can manage their profile and orders here
                  </div>
                </a>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-xl font-bold text-slate-900 mb-3">Admin Notes</h2>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>• Monitor all pending orders</li>
                <li>• Manage active rides — complete or cancel</li>
                <li>• Drivers are added via the Driver Dashboard</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;