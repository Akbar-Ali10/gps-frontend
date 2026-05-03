import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  getTrackingData,
  updatePayment,
  submitReview,
  submitComplaint,
  sendCustomerCounterOffer,
  acceptDriverOffer,
  closeNegotiation,
  getAuthUser,
} from '../services/apiService';
import { joinTrip, onLocationUpdate, onTripStatusUpdate } from '../services/socketService';
import './TrackingMap.css';

const goHome = () => { window.location.href = '/'; };

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const KARACHI_CENTER = [24.8607, 67.0011];
const DEFAULT_ZOOM = 15;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const createPulsingDotIcon = () =>
  L.divIcon({
    html: `<div class="pulsing-dot">
      <div class="dot"></div>
      <div class="pulse"></div>
    </div>`,
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });

const createDestinationIcon = () =>
  L.divIcon({
    html: `<div style="
      width: 22px;
      height: 22px;
      background: #ef4444;
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 8px rgba(239,68,68,0.5);
    "></div>`,
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -22],
  });

const getCoordinates = (location) => {
  if (!location) return null;
  const lat = parseFloat(location.latitude ?? location.lat ?? location[0]);
  const lng = parseFloat(location.longitude ?? location.lng ?? location[1]);

  if (isNaN(lat) || isNaN(lng)) return null;

  return {
    lat,
    lng,
    timestamp: location.timestamp ?? new Date().toISOString(),
  };
};

const filterAndSortLocations = (locations) => {
  const unique = locations.filter((loc, index, arr) => {
    return index === arr.findIndex(
      (l) => Math.abs(l.lat - loc.lat) < 0.00001 && Math.abs(l.lng - loc.lng) < 0.00001
    );
  });

  return unique.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const computeStats = (locs) => {
  if (locs.length <= 1) {
    return {
      totalDistance: 0,
      journeyTime: 0,
      startTime: null,
    };
  }

  let totalDistance = 0;

  for (let i = 0; i < locs.length - 1; i++) {
    totalDistance += calculateDistance(
      locs[i].lat,
      locs[i].lng,
      locs[i + 1].lat,
      locs[i + 1].lng
    );
  }

  const firstTime = new Date(locs[0].timestamp);
  const lastTime = new Date(locs[locs.length - 1].timestamp);

  return {
    totalDistance: totalDistance.toFixed(2),
    journeyTime: ((lastTime - firstTime) / (1000 * 60 * 60)).toFixed(2),
    startTime: firstTime,
  };
};

// ✅ FIXED: MapController - zoom reset nahi hoga ab
const MapController = ({ driverLocation, destinationCoords }) => {
  const map = useMap();
  const hasInitialFit = useRef(false); // ← sirf pehli baar fit karega

  useEffect(() => {
    if (!driverLocation) return;

    if (!hasInitialFit.current) {
      // Pehli baar: bounds fit karo (driver + destination dono dikhao)
      setTimeout(() => {
        map.invalidateSize();

        if (destinationCoords) {
          const bounds = L.latLngBounds([
            [driverLocation.lat, driverLocation.lng],
            [destinationCoords.lat, destinationCoords.lng],
          ]);
          map.fitBounds(bounds, { padding: [45, 45] });
        } else {
          map.setView([driverLocation.lat, driverLocation.lng], DEFAULT_ZOOM, {
            animate: true,
            duration: 0.8,
          });
        }

        hasInitialFit.current = true; // ← ab dobara fit nahi hoga
      }, 200);
    } else {
      // Driver move kare to sirf smoothly pan karo, zoom mat chheRo
      map.panTo([driverLocation.lat, driverLocation.lng], { animate: true });
    }
  }, [driverLocation, destinationCoords, map]);

  return null;
};

const LoadingScreen = ({ message = 'Loading map...' }) => (
  <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
    <div className="text-center">
      <div className="inline-block">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-6"></div>
      </div>
      <p className="text-slate-700 font-semibold text-lg">{message}</p>
    </div>
  </div>
);

const geocodeAddress = async (address) => {
  if (!address) return null;

  try {
    const cleanAddress = `${address}, Karachi, Pakistan`;

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanAddress)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );

    const data = await res.json();

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }

    return null;
  } catch (err) {
    console.error('Geocoding failed:', err);
    return null;
  }
};

const getRouteFromOSRM = async (startLat, startLng, endLat, endLng) => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data?.routes || data.routes.length === 0) return null;

    const route = data.routes[0];

    return {
      points: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceKm: route.distance ? route.distance / 1000 : null,
      durationMin: route.duration ? route.duration / 60 : null,
    };
  } catch (error) {
    console.error('OSRM route failed:', error);
    return null;
  }
};

const TrackingMap = ({ trackingId, customerName, driverName, tripData, onRefreshTrip }) => {
  const [driverLocation, setDriverLocation] = useState(null);
  const [pathHistory, setPathHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalDistance: 0, journeyTime: 0, startTime: null });
  const [tripStatus, setTripStatus] = useState(null);
  const [isLinkCopied, setIsLinkCopied] = useState(false);

  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeDistanceKm, setRouteDistanceKm] = useState(null);
  const [routeDurationMin, setRouteDurationMin] = useState(null);

  const [budgetInput, setBudgetInput] = useState('');
  const [negotiationLoading, setNegotiationLoading] = useState(false);
  const [negotiationMsg, setNegotiationMsg] = useState('');
  const [showOfferPopup, setShowOfferPopup] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState(tripData?.paymentMethod || 'cash');
  const [paidAmount, setPaidAmount] = useState(
    tripData?.paidAmount || tripData?.finalPrice || tripData?.budgetAmount || tripData?.suggestedPrice || ''
  );
  const [transactionId, setTransactionId] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState('');

  const [rating, setRating] = useState('5');
  const [reviewText, setReviewText] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewMsg, setReviewMsg] = useState('');

  const [complaintType, setComplaintType] = useState('general');
  const [complaintMessage, setComplaintMessage] = useState('');
  const [complaintLoading, setComplaintLoading] = useState(false);
  const [complaintMsg, setComplaintMsg] = useState('');

  const budgetInitializedRef = useRef(false);
  const reviewRef = useRef(null);
  const onRefreshTripRef = useRef(onRefreshTrip);

  const carIcon = useMemo(() => createPulsingDotIcon(), []);
  const destinationIcon = useMemo(() => createDestinationIcon(), []);

  useEffect(() => {
    onRefreshTripRef.current = onRefreshTrip;
  }, [onRefreshTrip]);

  const normalizedTripStatus = String(tripStatus || tripData?.status || '').toLowerCase();
  const driverId = tripData?.driverId || tripData?.driver_id || null;
  const driverOfferAmount = tripData?.driverOfferAmount || tripData?.driver_offer_amount || null;
  const offerDriverName =
    tripData?.offerDriverName || tripData?.offer_driver_name || tripData?.driverName || 'Driver';
  const negotiationStatus = tripData?.negotiationStatus || tripData?.negotiation_status || 'open';
  const rejectionCount = Number(tripData?.rejection_count || tripData?.rejectionCount || 0);

  const isCompleted = ['completed', 'done'].includes(normalizedTripStatus);
  const isCancelled = normalizedTripStatus === 'cancelled';
  const isAccepted = Boolean(driverId) || negotiationStatus === 'accepted';
  const showNegotiationBox = !isCompleted && !isCancelled && !isAccepted;
  const showMapSection = !isCompleted && !isCancelled && Boolean(driverLocation);

  useEffect(() => {
    if (driverOfferAmount && normalizedTripStatus === 'counter_offer') {
      setShowOfferPopup(true);
    }
  }, [driverOfferAmount, normalizedTripStatus]);

  useEffect(() => {
    if (!tripData?.location) return;
    const coords = getCoordinates(tripData.location);
    if (!coords) return;
    setDriverLocation((prev) => {
      if (prev && prev.lat === coords.lat && prev.lng === coords.lng) return prev;
      return coords;
    });
  }, [tripData?.location]);

  useEffect(() => {
    const savedDestinationLat =
      tripData?.destinationLat ?? tripData?.destination_lat ?? null;

    const savedDestinationLng =
      tripData?.destinationLng ?? tripData?.destination_lng ?? null;

    if (savedDestinationLat && savedDestinationLng) {
      const lat = Number(savedDestinationLat);
      const lng = Number(savedDestinationLng);

      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        setDestinationCoords({ lat, lng });
        return;
      }
    }

    const address =
      tripData?.destinationAddress ||
      tripData?.destination_address ||
      tripData?.deliveryAddress ||
      tripData?.delivery_address ||
      null;

    if (!address) return;

    geocodeAddress(address).then((coords) => {
      if (coords) {
        setDestinationCoords(coords);
      }
    });
  }, [
    tripData?.destinationLat,
    tripData?.destinationLng,
    tripData?.destination_lat,
    tripData?.destination_lng,
    tripData?.destinationAddress,
    tripData?.destination_address,
    tripData?.deliveryAddress,
    tripData?.delivery_address,
  ]);

  useEffect(() => {
    const loadRoute = async () => {
      if (!driverLocation || !destinationCoords) return;

      const routeInfo = await getRouteFromOSRM(
        driverLocation.lat,
        driverLocation.lng,
        destinationCoords.lat,
        destinationCoords.lng
      );

      if (routeInfo?.points?.length) {
        setRouteCoords(routeInfo.points);
        setRouteDistanceKm(routeInfo.distanceKm);
        setRouteDurationMin(routeInfo.durationMin);
      }
    };

    loadRoute();
  }, [driverLocation, destinationCoords]);

  useEffect(() => {
    setPathHistory([]);
    setDriverLocation(null);
    setRouteCoords([]);
    setRouteDistanceKm(null);
    setRouteDurationMin(null);
    setLoading(true);
    setStats({ totalDistance: 0, journeyTime: 0, startTime: null });
    setTripStatus(null);
    setNegotiationMsg('');
    budgetInitializedRef.current = false;
  }, [trackingId]);

  useEffect(() => {
    setPaymentMethod(tripData?.paymentMethod || 'cash');
    setPaidAmount(
      tripData?.paidAmount ||
      tripData?.finalPrice ||
      tripData?.budgetAmount ||
      tripData?.suggestedPrice ||
      ''
    );
  }, [tripData]);

  useEffect(() => {
    if (!tripData?.tripId) return;
    if (budgetInitializedRef.current) return;

    const initialBudget =
      tripData?.budgetAmount ||
      tripData?.budget_amount ||
      tripData?.customer_counter_amount ||
      tripData?.suggestedPrice ||
      tripData?.suggested_price ||
      '';

    setBudgetInput(initialBudget ? String(initialBudget) : '');
    budgetInitializedRef.current = true;
  }, [tripData]);

  useEffect(() => {
    if (isCompleted) {
      setDriverLocation(null);
      setRouteCoords([]);

      setTimeout(() => {
        reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 400);
    }
  }, [isCompleted]);

  const refreshTrip = async () => {
    if (typeof onRefreshTripRef.current === 'function') {
      await onRefreshTripRef.current();
    }
  };

  const handleCustomerCounterOffer = async () => {
    if (!tripData?.tripId) return;

    if (!budgetInput || Number(budgetInput) <= 0) {
      setNegotiationMsg('Please enter a valid amount.');
      return;
    }

    try {
      setNegotiationLoading(true);
      setNegotiationMsg('');

      await sendCustomerCounterOffer(tripData.tripId, {
        counter_amount: Number(budgetInput),
      });

      setNegotiationMsg('✅ Your updated budget has been sent to drivers.');
      await refreshTrip();
    } catch (error) {
      setNegotiationMsg(error.response?.data?.error || 'Failed to update budget.');
    } finally {
      setNegotiationLoading(false);
    }
  };

  const handleAcceptDriverOffer = async () => {
    if (!tripData?.tripId) return;

    try {
      setNegotiationLoading(true);
      setNegotiationMsg('');

      await acceptDriverOffer(tripData.tripId);

      setShowOfferPopup(false);
      setNegotiationMsg('✅ Driver offer accepted successfully.');
      await refreshTrip();
    } catch (error) {
      setNegotiationMsg(error.response?.data?.error || 'Failed to accept driver offer.');
    } finally {
      setNegotiationLoading(false);
    }
  };

  const handleCloseDeal = async () => {
    if (!tripData?.tripId) return;

    if (!window.confirm('Are you sure you want to close/cancel this order?')) return;

    try {
      setNegotiationLoading(true);
      setNegotiationMsg('');

      await closeNegotiation(tripData.tripId);

      goHome();
    } catch (error) {
      setNegotiationMsg(error.response?.data?.error || 'Failed to close order.');
    } finally {
      setNegotiationLoading(false);
    }
  };

  const handleShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setIsLinkCopied(true);
      setTimeout(() => setIsLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const tripDataResponse = await getTrackingData(trackingId);
        const initialStatus = String(tripDataResponse?.status || '').toLowerCase();

        if (initialStatus) setTripStatus(initialStatus);

        if (['completed', 'done'].includes(initialStatus)) {
          setDriverLocation(null);
          setPathHistory([]);
          setRouteCoords([]);
          setStats({ totalDistance: 0, journeyTime: 0, startTime: null });
          return;
        }

        const initialHistory = Array.isArray(tripDataResponse.locationHistory)
          ? tripDataResponse.locationHistory.map(getCoordinates).filter(Boolean)
          : [];

        const filteredHistory = filterAndSortLocations(initialHistory);

        setPathHistory(filteredHistory);
        setStats(computeStats(filteredHistory));

        if (tripDataResponse.location) {
          const latest = getCoordinates(tripDataResponse.location);

          if (latest) setDriverLocation(latest);
          else if (filteredHistory.length > 0) {
            setDriverLocation(filteredHistory[filteredHistory.length - 1]);
          }
        } else if (filteredHistory.length > 0) {
          setDriverLocation(filteredHistory[filteredHistory.length - 1]);
        }
      } catch (error) {
        console.error('Error fetching initial tracking data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
    joinTrip(trackingId);

    const unsubscribeLocation = onLocationUpdate((data) => {
      if (data.trackingId !== trackingId) return;

      const newStatus = String(data.tripStatus || '').toLowerCase();

      if (newStatus) setTripStatus(newStatus);

      if (['completed', 'done'].includes(newStatus)) {
        setDriverLocation(null);
        setRouteCoords([]);

        if (typeof onRefreshTripRef.current === 'function') {
          onRefreshTripRef.current();
        }

        return;
      }

      const coords = getCoordinates(data);

      if (!coords) return;

      setDriverLocation(coords);

      setPathHistory((prev) => {
        if (prev.length > 0) {
          const lastCoord = prev[prev.length - 1];
          const lastTimestamp = new Date(lastCoord.timestamp).getTime();
          const newTimestamp = new Date(coords.timestamp).getTime();

          if (newTimestamp <= lastTimestamp) return prev;

          const distanceKm = calculateDistance(lastCoord.lat, lastCoord.lng, coords.lat, coords.lng);

          if (distanceKm * 1000 < 2) return prev;
        }

        const updated = [...prev, coords];
        setStats(computeStats(updated));
        return updated;
      });
    });

    const unsubscribeStatus = onTripStatusUpdate((data) => {
      if (data.trackingId !== trackingId) return;

      const newStatus = String(data.status || '').toLowerCase();

      setTripStatus(newStatus);

      if (['completed', 'done'].includes(newStatus)) {
        setDriverLocation(null);
        setRouteCoords([]);

        setTimeout(() => {
          reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 500);
      }

      if (typeof onRefreshTripRef.current === 'function') {
        onRefreshTripRef.current();
      }
    });

    return () => {
      if (unsubscribeLocation) unsubscribeLocation();
      if (unsubscribeStatus) unsubscribeStatus();
    };
  }, [trackingId]);

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();

    try {
      setPaymentLoading(true);
      setPaymentMsg('');

      await updatePayment(tripData.tripId, {
        payment_status: paymentMethod === 'cash' ? 'cash_on_delivery' : 'paid',
        paid_amount: Number(paidAmount || 0),
        transaction_id: transactionId || null,
        payment_method: paymentMethod,
      });

      setPaymentMsg('✅ Payment updated');
      await refreshTrip();
    } catch (error) {
      setPaymentMsg(error.response?.data?.error || 'Payment update failed');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();

    try {
      setReviewLoading(true);
      setReviewMsg('');

      await submitReview(tripData.tripId, {
        rating: Number(rating),
        review_text: reviewText,
      });

      setReviewMsg('✅ Review submitted');
      setReviewText('');

      await refreshTrip();
    } catch (error) {
      setReviewMsg(error.response?.data?.error || 'Review submit failed');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleComplaintSubmit = async (e) => {
    e.preventDefault();

    try {
      setComplaintLoading(true);
      setComplaintMsg('');

      await submitComplaint(tripData.tripId, {
        complaint_type: complaintType,
        message: complaintMessage,
      });

      setComplaintMsg('✅ Complaint submitted');
      setComplaintMessage('');

      await refreshTrip();
    } catch (error) {
      setComplaintMsg(error.response?.data?.error || 'Complaint submit failed');
    } finally {
      setComplaintLoading(false);
    }
  };

  if (loading) return <LoadingScreen message="Loading map..." />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-blue-50 to-slate-100 py-6 md:py-10">

      {/* Driver Offer Popup */}
      {showOfferPopup && driverOfferAmount && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center animate-bounce-once">
            <div className="text-5xl mb-4">🚗</div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Driver Offer Received!</h2>
            <p className="text-slate-500 text-sm mb-6">
              {offerDriverName} has sent an offer to take your order
            </p>

            <div className="bg-slate-50 rounded-2xl p-4 mb-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-sm">Aapka Budget</span>
                <span className="font-bold text-slate-700">
                  Rs. {tripData?.budgetAmount || tripData?.budget_amount || '—'}
                </span>
              </div>
              <div className="border-t border-slate-200" />
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-sm">Driver's Offer</span>
                <span className="font-black text-2xl text-emerald-600">Rs. {driverOfferAmount}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleAcceptDriverOffer}
                disabled={negotiationLoading}
                className="w-full py-3 rounded-2xl bg-emerald-600 text-white font-bold text-lg hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {negotiationLoading ? 'Processing...' : `✅ Accept Rs. ${driverOfferAmount}`}
              </button>

              <button
                onClick={() => setShowOfferPopup(false)}
                className="w-full py-3 rounded-2xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition"
              >
                ❌ Decide Later
              </button>
            </div>

            {negotiationMsg && (
              <p className="mt-4 text-sm text-slate-600">{negotiationMsg}</p>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 space-y-5">
        {isCompleted && (
          <div className="rounded-3xl border border-emerald-300 bg-emerald-50 p-8 text-center shadow-sm">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="font-black text-emerald-700 text-3xl mb-2">Order Completed</h2>
            <p className="text-base text-emerald-700 font-medium">Your order has been completed.</p>
            <p className="text-sm text-emerald-600 mt-1">Please submit your review below.</p>
          </div>
        )}

        {isAccepted && !isCompleted && !isCancelled && (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="font-black text-emerald-700 text-lg">✅ Driver accepted your order</h2>
            <p className="text-sm text-emerald-700 mt-1">
              Driver has accepted your order. Live tracking will start when driver starts sharing location.
            </p>
          </div>
        )}

        {showNegotiationBox && (
          <div className={`rounded-3xl border p-4 md:p-5 ${driverOfferAmount ? 'border-emerald-300 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                {driverOfferAmount ? (
                  <>
                    <h2 className="font-black text-emerald-700 text-lg">🚗 Driver Offer Received!</h2>
                    <p className="text-sm text-emerald-700 font-semibold mt-1">
                      Driver wants to take your order for Rs. <span className="text-2xl font-black">{driverOfferAmount}</span>
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">
                      Your budget: Rs. {tripData?.budgetAmount || tripData?.budget_amount} — Accept or update your budget
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="font-black text-rose-700 text-lg">⚠ Budget Negotiation</h2>
                    {rejectionCount > 0 ? (
                      <p className="text-sm text-rose-600 mt-1">
                        Drivers are rejecting your order. Increase your budget so a driver accepts it.
                      </p>
                    ) : (
                      <p className="text-sm text-slate-600 mt-1">
                        Update your budget if drivers are not accepting your order.
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-800">Rs.</span>

                <input
                  type="number"
                  min="1"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-32 p-3 rounded-xl border border-rose-200 outline-none focus:border-rose-500"
                  placeholder="Amount"
                />

                <button
                  type="button"
                  onClick={handleCustomerCounterOffer}
                  disabled={negotiationLoading}
                  className="px-5 py-3 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 disabled:bg-slate-400"
                >
                  Update Budget
                </button>

                <button
                  type="button"
                  onClick={handleAcceptDriverOffer}
                  disabled={negotiationLoading || !driverOfferAmount}
                  className="px-5 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:bg-slate-400"
                >
                  Accept Driver Offer
                </button>

                <button
                  type="button"
                  onClick={handleCloseDeal}
                  disabled={negotiationLoading}
                  className="px-5 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:bg-slate-400"
                >
                  Close Deal
                </button>
              </div>
            </div>

            {negotiationMsg && (
              <div className="mt-3 rounded-xl bg-white border border-rose-100 p-3 text-sm text-slate-700">
                {negotiationMsg}
              </div>
            )}
          </div>
        )}

        <div className="rounded-3xl overflow-hidden border border-white/70 bg-white/90 backdrop-blur shadow-xl shadow-slate-200/50">
          <div className="px-6 md:px-8 py-6 bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-blue-100 text-xs uppercase tracking-[0.2em] font-bold mb-2">
                Delivery Tracking
              </p>
              <h1 className="text-white font-black text-2xl md:text-3xl leading-tight">
                Track Your Delivery
              </h1>
              <p className="text-blue-100 text-sm mt-2">
                Real-time movement, route history, and status updates
              </p>
            </div>

            <div className="px-4 py-2 rounded-full text-xs font-black uppercase tracking-wide border bg-white/15 text-white border-white/20">
              {normalizedTripStatus ? normalizedTripStatus.toUpperCase() : 'PENDING'}
            </div>
          </div>

          <div className="px-6 md:px-8 py-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-2">
                Driver
              </p>
              <p className="font-black text-slate-900 text-lg">
                {driverName || 'Unknown Driver'}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-2">
                Customer
              </p>
              <p className="font-black text-slate-900 text-lg">
                {customerName || 'Unknown Customer'}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-2">
                Order Type
              </p>
              <p className="font-black text-slate-900 text-lg">
                {tripData?.orderType === 'shopping'
                  ? 'Shopping'
                  : tripData?.orderType === 'ride'
                    ? 'Ride'
                    : 'Pickup & Drop'}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-2">
                Tracking ID
              </p>
              <p className="font-mono text-xs text-slate-600 break-all">{trackingId}</p>
            </div>
          </div>

          <div className="px-6 md:px-8 pb-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {tripData?.pickupAddress && (
              <div className="rounded-2xl bg-white border border-slate-200 p-4">
                <p className="text-slate-400 text-xs font-bold uppercase mb-2">Pickup</p>
                <p className="text-slate-700">{tripData.pickupAddress}</p>
              </div>
            )}

            {tripData?.destinationAddress && (
              <div className="rounded-2xl bg-white border border-slate-200 p-4">
                <p className="text-slate-400 text-xs font-bold uppercase mb-2">
                  Destination
                </p>
                <p className="text-slate-700">{tripData.destinationAddress}</p>
              </div>
            )}

            {Array.isArray(tripData?.itemList) && tripData.itemList.length > 0 && (
              <div className="rounded-2xl bg-white border border-slate-200 p-4 md:col-span-2">
                <p className="text-slate-400 text-xs font-bold uppercase mb-2">Items</p>
                <p className="text-slate-700">
                  {tripData.itemList.map((item) => item.name || item).join(', ')}
                </p>
              </div>
            )}

            <div className="rounded-2xl bg-white border border-slate-200 p-4">
              <p className="text-slate-400 text-xs font-bold uppercase mb-2">
                Payment Method
              </p>
              <p className="text-slate-700">{tripData?.paymentMethod || 'cash'}</p>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 p-4">
              <p className="text-slate-400 text-xs font-bold uppercase mb-2">
                Payment Status
              </p>
              <p className="text-slate-700">{tripData?.paymentStatus || 'pending'}</p>
            </div>
          </div>
        </div>

        {showMapSection ? (
          <div className="relative rounded-3xl shadow-2xl overflow-hidden border border-white/70 h-[62vh] bg-white">
            <MapContainer
              center={KARACHI_CENTER}
              zoom={DEFAULT_ZOOM}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                url={OSM_TILE_URL}
                attribution="&copy; OpenStreetMap contributors"
                maxZoom={19}
              />

              <MapController
                driverLocation={driverLocation}
                destinationCoords={destinationCoords}
              />

              <Marker position={[driverLocation.lat, driverLocation.lng]} icon={carIcon}>
                <Popup>
                  <div className="text-sm">
                    <strong className="block mb-2">🚗 Driver Location</strong>
                    <p>
                      <strong>Latitude:</strong> {driverLocation.lat.toFixed(6)}
                    </p>
                    <p>
                      <strong>Longitude:</strong> {driverLocation.lng.toFixed(6)}
                    </p>
                    {driverLocation.timestamp && (
                      <p className="text-xs text-gray-600 mt-2">
                        {new Date(driverLocation.timestamp).toLocaleString()}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>

              {destinationCoords && (
                <Marker
                  position={[destinationCoords.lat, destinationCoords.lng]}
                  icon={destinationIcon}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong className="block mb-1">📍 Destination</strong>
                      <p>{tripData?.destinationAddress || tripData?.destination_address}</p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {routeCoords.length > 0 ? (
                <Polyline
                  positions={routeCoords}
                  pathOptions={{
                    color: '#2563eb',
                    weight: 6,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              ) : (
                destinationCoords &&
                driverLocation && (
                  <Polyline
                    positions={[
                      [driverLocation.lat, driverLocation.lng],
                      [destinationCoords.lat, destinationCoords.lng],
                    ]}
                    pathOptions={{
                      color: '#2563eb',
                      weight: 4,
                      opacity: 0.45,
                      dashArray: '8 6',
                    }}
                  />
                )
              )}
            </MapContainer>

            {destinationCoords && (
              <div className="absolute top-3 right-3 z-[999] bg-white rounded-xl shadow-lg border border-slate-200 px-3 py-2 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                  <span className="text-slate-600">Driver</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-slate-600">Destination</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-5 h-1 bg-blue-600 rounded-full"></div>
                  <span className="text-slate-600">Route to go</span>
                </div>
              </div>
            )}

            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[999] pointer-events-auto">
              <button
                onClick={handleShareLink}
                className={`flex items-center gap-2.5 px-6 py-3.5 rounded-full font-bold text-sm shadow-2xl transition-all duration-300 active:scale-95 ${isLinkCopied
                    ? 'bg-emerald-500 text-white scale-105'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'
                  }`}
              >
                {/* {isLinkCopied ? 'Copied!' : 'Share Live Location'} */}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center">
            <div className="text-5xl mb-3">
              {isCancelled ? '❌' : isCompleted ? '✅' : isAccepted ? '🚗' : '📍'}
            </div>

            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              {isCancelled
                ? 'Trip Cancelled'
                : isCompleted
                  ? 'Order Completed'
                  : isAccepted
                    ? 'Waiting for driver live location'
                    : 'Waiting for location'}
            </h3>

            <p className="text-slate-500">
              {isCancelled
                ? 'This trip has been cancelled.'
                : isCompleted
                  ? 'Your order has been completed. Please submit your review below.'
                  : isAccepted
                    ? 'Driver accepted your order. Map will appear when driver starts live tracking.'
                    : 'Driver location is not available yet.'}
            </p>
          </div>
        )}

        {!isCompleted && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-3xl p-6 bg-white border border-white/80 shadow-lg">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">
                Road Distance
              </p>
              <p className="text-4xl font-black text-slate-900">
                {routeDistanceKm ? routeDistanceKm.toFixed(2) : stats.totalDistance}
              </p>
              <p className="text-sm text-slate-500 mt-1">Kilometers to destination</p>
            </div>

            <div className="rounded-3xl p-6 bg-white border border-white/80 shadow-lg">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">
                ETA
              </p>
              <p className="text-4xl font-black text-slate-900">
                {routeDurationMin ? Math.round(routeDurationMin) : '—'}
              </p>
              <p className="text-sm text-slate-500 mt-1">Minutes estimated</p>
            </div>

            <div className="rounded-3xl p-6 bg-white border border-white/80 shadow-lg">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">
                Waypoints
              </p>
              <p className="text-4xl font-black text-slate-900">{pathHistory.length}</p>
              <p className="text-sm text-slate-500 mt-1">Saved route points</p>
            </div>
          </div>
        )}

        {!isCancelled && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment</h2>
            <p className="text-slate-500 mb-4">Customer can update payment status here.</p>

            <form onSubmit={handlePaymentSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-2xl outline-none bg-white"
              >
                <option value="cash">Cash</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">EasyPaisa</option>
                <option value="card">Card</option>
              </select>

              <input
                type="number"
                placeholder="Paid Amount"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-2xl outline-none"
              />

              <input
                type="text"
                placeholder="Transaction ID (optional)"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-2xl outline-none md:col-span-2"
              />

              <button
                type="submit"
                disabled={paymentLoading}
                className="md:col-span-2 w-full bg-emerald-600 text-white p-3 rounded-2xl font-semibold hover:bg-emerald-700 transition-all disabled:bg-slate-400"
              >
                {paymentLoading ? 'Updating Payment...' : 'Update Payment'}
              </button>
            </form>

            {paymentMsg && (
              <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
                {paymentMsg}
              </div>
            )}
          </div>
        )}

        {isCompleted && (
          <div ref={reviewRef} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Submit Review</h2>
              <p className="text-slate-500 mb-4">
                Delivery completed. You can submit your review now.
              </p>

              {tripData?.hasReview ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                    Review already submitted.
                  </div>

                  <button
                    type="button"
                    onClick={() => (goHome())}
                    className="w-full bg-blue-600 text-white p-3 rounded-2xl font-semibold hover:bg-blue-700 transition-all"
                  >
                    Go to Home Page
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReviewSubmit} className="space-y-4">
                  <select
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-2xl outline-none bg-white"
                  >
                    <option value="5">5 Star</option>
                    <option value="4">4 Star</option>
                    <option value="3">3 Star</option>
                    <option value="2">2 Star</option>
                    <option value="1">1 Star</option>
                  </select>

                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Write your review..."
                    className="w-full p-3 border border-slate-200 rounded-2xl outline-none min-h-[120px]"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="submit"
                      disabled={reviewLoading}
                      className="w-full bg-blue-600 text-white p-3 rounded-2xl font-semibold hover:bg-blue-700 transition-all disabled:bg-slate-400"
                    >
                      {reviewLoading ? 'Submitting Review...' : 'Submit Review'}
                    </button>

                    <button
                      type="button"
                      onClick={() => (goHome())}
                      className="w-full bg-slate-900 text-white p-3 rounded-2xl font-semibold hover:bg-slate-800 transition-all"
                    >
                      Skip / Go Home
                    </button>
                  </div>
                </form>
              )}

              {reviewMsg && (
                <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
                  {reviewMsg}
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Complaint</h2>
              <p className="text-slate-500 mb-4">If there was any issue, submit a complaint.</p>

              {tripData?.hasComplaint ? (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
                  Complaint already submitted.
                </div>
              ) : (
                <form onSubmit={handleComplaintSubmit} className="space-y-4">
                  <select
                    value={complaintType}
                    onChange={(e) => setComplaintType(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-2xl outline-none bg-white"
                  >
                    <option value="general">General</option>
                    <option value="late_delivery">Late Delivery</option>
                    <option value="driver_behavior">Driver Behavior</option>
                    <option value="payment_issue">Payment Issue</option>
                    <option value="other">Other</option>
                  </select>

                  <textarea
                    value={complaintMessage}
                    onChange={(e) => setComplaintMessage(e.target.value)}
                    placeholder="Write complaint..."
                    className="w-full p-3 border border-slate-200 rounded-2xl outline-none min-h-[120px]"
                  />

                  <button
                    type="submit"
                    disabled={complaintLoading}
                    className="w-full bg-rose-600 text-white p-3 rounded-2xl font-semibold hover:bg-rose-700 transition-all disabled:bg-slate-400"
                  >
                    {complaintLoading ? 'Submitting Complaint...' : 'Submit Complaint'}
                  </button>
                </form>
              )}

              {complaintMsg && (
                <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
                  {complaintMsg}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackingMap;