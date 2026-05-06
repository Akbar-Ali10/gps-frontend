import React, { useState, useEffect, useCallback } from 'react';
import {
  getAllTrips,
  assignDriver,
  rejectTrip,
  logoutUser,
  sendDriverOffer,
  acceptCustomerCounterOffer,
  getAuthUser,
} from '../services/apiService';

const DriverDashboard = () => {
  const user = getAuthUser();

  const [pendingTrips, setPendingTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState(null);

  const [offerTripId, setOfferTripId] = useState(null);
  const [offerAmount, setOfferAmount] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'driver' || !user.driver_id) {
      window.location.href = '/auth';
    }
  }, []);

  const driverId = user?.driver_id;

  const handleLogout = () => {
    logoutUser();
    window.location.href = '/auth';
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const tripsRes = await getAllTrips(null, 100, 0);
      const allTrips = tripsRes?.trips || [];

      const availableOrders = allTrips.filter((trip) =>
        ['pending', 'counter_offer', 'customer_countered'].includes(
          String(trip.status || '').toLowerCase()
        )
      );

      setPendingTrips(availableOrders);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load data. Please refresh.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!driverId) return;
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [loadData, driverId]);

  const handleAccept = async (trip) => {
    try {
      setActionLoading(`accept-${trip.id}`);
      const res = await assignDriver(trip.id, driverId);
      if (res.success) {
        window.location.href = `/driver/${trip.tracking_id}`;
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to accept order',
      });
      setActionLoading(null);
    }
  };

  const handleReject = async (trip, isConfirmed = false) => {
    if (!isConfirmed) {
      setActionLoading(`confirm-reject-${trip.id}`);
      return;
    }
    try {
      setActionLoading(`reject-${trip.id}`);
      await rejectTrip(trip.id);
      setMessage({ type: 'success', text: 'Order rejected. Customer notified.' });
      await loadData();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to reject order',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const openOfferBox = (trip) => {
    setOfferTripId(trip.id);
    setOfferAmount(
      trip.customer_counter_amount || trip.budget_amount || trip.suggested_price || ''
    );
    setActionLoading(null);
  };

  const handleSendOffer = async (trip) => {
    if (!offerAmount || Number(offerAmount) <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid offer amount.' });
      return;
    }
    try {
      setActionLoading(`offer-${trip.id}`);
      await sendDriverOffer(trip.id, {
        driver_id: driverId,
        offer_amount: Number(offerAmount),
      });
      setMessage({ type: 'success', text: 'Offer sent to customer successfully.' });
      setOfferTripId(null);
      setOfferAmount('');
      await loadData();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to send offer',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptCustomerCounter = async (trip) => {
    try {
      setActionLoading(`accept-counter-${trip.id}`);
      await acceptCustomerCounterOffer(trip.id, { driver_id: driverId });
      const res = await assignDriver(trip.id, driverId);
      if (res.success) {
        window.location.href = `/driver/${trip.tracking_id}`;
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to accept customer counter offer',
      });
      setActionLoading(null);
    }
  };

  const getStatusText = (trip) => {
    const status = String(trip.status || '').toLowerCase();
    if (status === 'counter_offer')
      return `Your offer sent: Rs. ${trip.driver_offer_amount || 'N/A'}`;
    if (status === 'customer_countered')
      return `Customer counter: Rs. ${trip.customer_counter_amount || 'N/A'}`;
    return `Customer budget: Rs. ${trip.budget_amount || trip.suggested_price || 'N/A'}`;
  };

  if (!user || user.role !== 'driver') return null;

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-blue-700">🚚 Quick Delivery</span>
            <span className="hidden sm:block text-slate-300">|</span>
            <span className="hidden sm:block text-sm font-semibold text-slate-600">Driver Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-700 hidden sm:block font-medium">
              Hi, {user.name}
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium text-sm transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <header className="mb-6 pt-2">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">
            Available Orders
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Accept, counter, or reject incoming orders below.</p>
        </header>

        {message && (
          <div
            className={`p-4 rounded-xl mb-6 font-medium ${
              message.type === 'error'
                ? 'bg-red-100 text-red-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-500">{pendingTrips.length} order{pendingTrips.length !== 1 ? 's' : ''} available</p>
            <button
              onClick={loadData}
              className="text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              Refresh
            </button>
          </div>

          {loading && pendingTrips.length === 0 ? (
            <div className="text-center py-10 text-slate-500 font-medium">
              Loading orders...
            </div>
          ) : pendingTrips.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-slate-200">
              <div className="text-4xl mb-3">😴</div>
              <h3 className="text-lg font-bold text-slate-700">No New Orders</h3>
              <p className="text-slate-500 mt-1">
                New orders will appear here when a customer places one.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pendingTrips.map((trip) => {
                const status = String(trip.status || '').toLowerCase();
                const isOfferOpen = offerTripId === trip.id;

                return (
                  <div
                    key={trip.id}
                    className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start flex-wrap gap-4 mb-4">
                      <div>
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase bg-blue-100 text-blue-800 mb-2">
                          {String(trip.order_type || '').replace('_', ' ')}
                        </span>

                        {status === 'counter_offer' && (
                          <span className="ml-2 inline-block px-3 py-1 rounded-full text-xs font-bold uppercase bg-amber-100 text-amber-800 mb-2">
                            Offer Sent
                          </span>
                        )}

                        {status === 'customer_countered' && (
                          <span className="ml-2 inline-block px-3 py-1 rounded-full text-xs font-bold uppercase bg-purple-100 text-purple-800 mb-2">
                            Customer Counter
                          </span>
                        )}

                        <h3 className="font-bold text-lg text-slate-900">
                          {trip.customer_name}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {trip.pickup_address ? `From: ${trip.pickup_address}` : 'No pickup info'}
                        </p>
                        <p className="text-sm text-slate-500">
                          {trip.destination_address
                            ? `To: ${trip.destination_address}`
                            : 'No destination info'}
                        </p>
                        <p className="text-sm font-semibold text-slate-700 mt-2">
                          {getStatusText(trip)}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-black text-emerald-600">
                          Rs.{' '}
                          {trip.customer_counter_amount ||
                            trip.budget_amount ||
                            trip.suggested_price ||
                            'N/A'}
                        </div>
                        <div className="text-xs text-slate-500 uppercase font-semibold mt-1">
                          {trip.payment_method || 'cash'}
                        </div>
                      </div>
                    </div>

                    {isOfferOpen && (
                      <div className="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                          Enter your offer amount
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <input
                            type="number"
                            value={offerAmount}
                            onChange={(e) => setOfferAmount(e.target.value)}
                            placeholder="Amount"
                            className="md:col-span-2 w-full p-3 border border-amber-200 rounded-xl outline-none"
                          />
                          <button
                            onClick={() => handleSendOffer(trip)}
                            disabled={!!actionLoading}
                            className="w-full bg-amber-600 text-white p-3 rounded-xl font-bold hover:bg-amber-700 disabled:opacity-50"
                          >
                            {actionLoading === `offer-${trip.id}` ? 'Sending...' : 'Send Offer'}
                          </button>
                        </div>
                        <button
                          onClick={() => { setOfferTripId(null); setOfferAmount(''); }}
                          className="mt-3 text-sm font-semibold text-slate-500 hover:text-slate-800"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
                      {status === 'customer_countered' ? (
                        <button
                          onClick={() => handleAcceptCustomerCounter(trip)}
                          disabled={!!actionLoading}
                          className="py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === `accept-counter-${trip.id}`
                            ? '...'
                            : `Accept Rs. ${trip.customer_counter_amount}`}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAccept(trip)}
                          disabled={!!actionLoading}
                          className="py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === `accept-${trip.id}` ? '...' : 'Accept Order'}
                        </button>
                      )}

                      <button
                        onClick={() => openOfferBox(trip)}
                        disabled={!!actionLoading}
                        className="py-3 rounded-xl font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                      >
                        Counter Offer
                      </button>

                      {actionLoading === `confirm-reject-${trip.id}` ? (
                        <button
                          onClick={() => handleReject(trip, true)}
                          disabled={actionLoading === `reject-${trip.id}`}
                          className="py-3 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors"
                        >
                          Confirm Reject
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReject(trip)}
                          disabled={!!actionLoading}
                          className="py-3 rounded-xl font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 transition-colors"
                        >
                          Reject
                        </button>
                      )}
                    </div>

                    {trip.rejection_count > 0 && (
                      <div className="mt-3 text-xs text-center font-medium text-amber-600">
                        This order was already rejected {trip.rejection_count} times by other drivers.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DriverDashboard;
