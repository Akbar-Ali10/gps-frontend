import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import TrackingMap from '../components/TrackingMap';
import { getTrackingData, updateTripBudget, submitReview } from '../services/apiService';
import './CustomerTrackingPage.css';

const goHome = () => { window.location.href = '/'; };

const CustomerTrackingPage = () => {
  const { trackingId } = useParams();
  const [tripData, setTripData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [budgetInput, setBudgetInput] = useState('');
  const [updatingBudget, setUpdatingBudget] = useState(false);

  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [uiMessage, setUiMessage] = useState(null);

  const fetchTripData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getTrackingData(trackingId);
      setTripData(data);

      if (data?.budgetAmount) {
        setBudgetInput(data.budgetAmount);
      }
    } catch (err) {
      setError('Failed to load tracking data');
    } finally {
      setLoading(false);
    }
  }, [trackingId]);

  useEffect(() => {
    fetchTripData();
    const interval = setInterval(fetchTripData, 5000);
    return () => clearInterval(interval);
  }, [fetchTripData]);

  if (loading && !tripData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading your order...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Tracking Error</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <button onClick={fetchTripData} className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const customerName = tripData.customerName || 'Customer';
  const driverName = tripData.driverName || 'Driver';
  const status = tripData.status;

  const handleUpdateBudget = async () => {
    try {
      setUpdatingBudget(true);
      await updateTripBudget(tripData.tripId, budgetInput);
      await fetchTripData();
    } finally {
      setUpdatingBudget(false);
    }
  };

  const handleReviewSubmit = async () => {
    try {
      setSubmittingReview(true);
      await submitReview(tripData.tripId, {
        rating,
        review_text: reviewText,
      });
      setReviewSuccess(true);
      await fetchTripData();
    } finally {
      setSubmittingReview(false);
    }
  };

  if (status === 'completed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Order Completed!</h2>
            <p className="text-slate-500 mb-8">Your delivery was successful. Thank you for using Quick Delivery!</p>

            {!tripData.hasReview && !reviewSuccess ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left">
                <h3 className="text-base font-bold text-slate-800 mb-4 text-center">Rate your driver — {driverName}</h3>

                <div className="flex justify-center gap-3 mb-5">
                  {[1,2,3,4,5].map(star => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className="text-3xl transition-transform hover:scale-110"
                    >
                      {rating >= star ? '⭐' : '☆'}
                    </button>
                  ))}
                </div>

                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-3"
                  rows={3}
                  placeholder="Share your experience (optional)..."
                />

                <button
                  onClick={handleReviewSubmit}
                  disabled={submittingReview}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors mb-3"
                >
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>

                <button
                  onClick={goHome}
                  className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
                >
                  Skip & Go Home
                </button>
              </div>
            ) : (
              <div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-5">
                  <div className="text-2xl mb-2">⭐</div>
                  <p className="text-emerald-800 font-semibold">Thank you for your feedback!</p>
                  <p className="text-emerald-600 text-sm mt-1">You rated {tripData.rating || rating}/5</p>
                </div>
                <button
                  onClick={goHome}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                >
                  Go to Home
                </button>
              </div>
            )}
          </div>
        </div>
    );
  }

  return (
    <div className="customer-tracking-page pb-20">
      <TrackingMap
        trackingId={trackingId}
        customerName={customerName}
        driverName={driverName}
        tripData={tripData}
        onRefreshTrip={fetchTripData}
      />
    </div>
  );
};

export default CustomerTrackingPage;