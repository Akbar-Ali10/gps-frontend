import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { initSocket } from '../services/socketService';
import { getTrackingData, assignDriver, updateTripStatus } from '../services/apiService';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const createDriverIcon = () =>
  L.divIcon({
    html: `<div style="width:18px;height:18px;background:#22c55e;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(34,197,94,0.35);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    className: '',
  });

const createDestinationIcon = () =>
  L.divIcon({
    html: `<div style="width:22px;height:22px;background:#ef4444;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(239,68,68,0.5);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    className: '',
  });

// ✅ FIXED: sirf pehli baar fit karega, GPS update pe zoom reset nahi hoga
const MapFollower = ({ coords, destinationCoords }) => {
  const map = useMap();
  const hasInitialFit = useRef(false); // ← yeh add kiya

  useEffect(() => {
    if (!coords) return;

    if (!hasInitialFit.current) {
      // Pehli baar: bounds fit karo
      if (destinationCoords) {
        const bounds = L.latLngBounds([
          [coords.latitude, coords.longitude],
          [destinationCoords.lat, destinationCoords.lng],
        ]);
        map.fitBounds(bounds, { padding: [40, 40] });
      } else {
        map.setView([coords.latitude, coords.longitude], 16, { animate: true });
      }
      hasInitialFit.current = true; // ← ab dobara fit nahi hoga
    } else {
      // GPS update pe sirf pan karo, zoom mat chheRo
      map.panTo([coords.latitude, coords.longitude], { animate: true });
    }
  }, [coords, destinationCoords, map]);

  return null;
};

const geocodeAddress = async (address) => {
  if (!address) return null;

  try {
    const cleanAddress = `${address}, Karachi, Pakistan`;

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        cleanAddress
      )}&format=json&limit=1`,
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

const DriverApp = () => {
  const { trackingId } = useParams();

  const [isTracking, setIsTracking] = useState(false);
  const [coords, setCoords] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [locationCount, setLocationCount] = useState(0);
  const [lastSent, setLastSent] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [statusMsg, setStatusMsg] = useState('Order load ho raha hai...');
  const [linkCopied, setLinkCopied] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [tripData, setTripData] = useState(null);
  const [driverIdInput, setDriverIdInput] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [driverAccepted, setDriverAccepted] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);
  const [completedLocal, setCompletedLocal] = useState(false);

  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeDistanceKm, setRouteDistanceKm] = useState(null);
  const [routeDurationMin, setRouteDurationMin] = useState(null);

  const socketRef = useRef(null);
  const watchIdRef = useRef(null);
  const wakeLockRef = useRef(null);
  const tripIdRef = useRef(null);
  const driverIdRef = useRef(null);
  const isStartingRef = useRef(false);

  const driverIcon = useMemo(() => createDriverIcon(), []);
  const destIcon = useMemo(() => createDestinationIcon(), []);

  const customerLink = `${window.location.origin}/track/${trackingId}`;

  const getOrderTypeLabel = (type) => {
    if (type === 'shopping') return 'Shopping';
    if (type === 'ride') return 'Ride';
    return 'Pickup & Drop';
  };

  const getStatusBadge = (status) => {
    const n = String(status || 'pending').toLowerCase();
    if (n === 'active' || n === 'in-progress') return 'bg-green-900 text-green-400';
    if (n === 'completed') return 'bg-blue-900 text-blue-300';
    if (n === 'cancelled') return 'bg-red-900 text-red-300';
    return 'bg-yellow-900 text-yellow-300';
  };

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch (e) {}
      wakeLockRef.current = null;
    }
  }, []);

  const stopTrackingOnly = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsTracking(false);
    setShowMap(false);
    isStartingRef.current = false;
    releaseWakeLock();
  }, [releaseWakeLock]);

  const fetchTripData = useCallback(async () => {
    try {
      const data = await getTrackingData(trackingId);

      setTripData(data);

      if (data?.tripId) {
        setTripId(data.tripId);
        tripIdRef.current = data.tripId;
      }

      if (data?.driverId) {
        driverIdRef.current = data.driverId;
        setDriverAccepted(true);
      }

      if (String(data?.status || '').toLowerCase() === 'completed') {
        setCompletedLocal(true);
        stopTrackingOnly();
        setStatusMsg('✅ Order completed successfully.');
      }

      const dbLat = data?.destinationLat || data?.destination_lat;
      const dbLng = data?.destinationLng || data?.destination_lng;

      if (dbLat && dbLng) {
        setDestinationCoords({
          lat: Number(dbLat),
          lng: Number(dbLng),
        });
      } else {
        const address = data?.destinationAddress || data?.destination_address || null;
        if (address) {
          const destination = await geocodeAddress(address);
          if (destination) setDestinationCoords(destination);
        }
      }
    } catch (error) {
      console.error('Failed to fetch trip data:', error);
      setStatusMsg('Failed to load order');
    }
  }, [trackingId, stopTrackingOnly]);

  useEffect(() => {
    fetchTripData();
  }, [fetchTripData]);

  useEffect(() => {
    const loadRoute = async () => {
      if (!coords || !destinationCoords) return;

      const routeInfo = await getRouteFromOSRM(
        coords.latitude,
        coords.longitude,
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
  }, [coords, destinationCoords]);

  const copyCustomerLink = async () => {
    try {
      await navigator.clipboard.writeText(customerLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleAssignDriver = async () => {
    if (!driverIdInput.trim()) {
      setStatusMsg('Driver ID is required');
      return;
    }

    if (!tripIdRef.current) {
      setStatusMsg('Order is not ready yet');
      return;
    }

    try {
      setAssigning(true);

      const parsedDriverId = parseInt(driverIdInput, 10);

      if (Number.isNaN(parsedDriverId)) {
        setStatusMsg('Please enter a valid Driver ID');
        return;
      }

      const response = await assignDriver(tripIdRef.current, parsedDriverId);

      if (response?.success) {
        driverIdRef.current = parsedDriverId;
        setDriverAccepted(true);
        setStatusMsg('Order accept ho gaya. Ab tracking start kar sakte hain.');

        await fetchTripData();

        const socket = initSocket();
        socketRef.current = socket;

        socket.emit('join-trip', {
          trackingId,
          driverId: parsedDriverId,
          role: 'driver',
        });

        socket.emit('trip-status-updated', {
          tripId: tripIdRef.current,
          trackingId,
          status: 'active',
        });
      }
    } catch (error) {
      setStatusMsg(error.response?.data?.error || 'Failed to assign driver');
    } finally {
      setAssigning(false);
    }
  };

  useEffect(() => {
    const socket = initSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setSocketConnected(true);

      if (driverIdRef.current) {
        socket.emit('join-trip', {
          trackingId,
          driverId: driverIdRef.current,
          role: 'driver',
        });
      }
    };

    const onDisconnect = () => setSocketConnected(false);

    const onRoomJoined = (data) => {
      if (data.success) {
        const parsed = parseInt(data.tripId, 10);
        setTripId(parsed);
        tripIdRef.current = parsed;
        setStatusMsg('Ready — ab START TRACKING dabayein');
      }
    };

    const onLocationSaved = () => setLastSent(new Date());
    const onLocationError = (data) => setStatusMsg(data?.message || 'Location update failed');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-joined', onRoomJoined);
    socket.on('location-saved', onLocationSaved);
    socket.on('location-error', onLocationError);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-joined', onRoomJoined);
      socket.off('location-saved', onLocationSaved);
      socket.off('location-error', onLocationError);
    };
  }, [trackingId]);

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch (e) {}
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsTracking(false);
    setShowMap(false);
    setStatusMsg('Tracking band ho gayi. Ab complete kar sakte hain.');
    isStartingRef.current = false;
    releaseWakeLock();
  }, [releaseWakeLock]);

  const handleCompleteTrip = async () => {
    if (!tripIdRef.current) return;

    try {
      setShowConfirmComplete(false);
      setPaymentLoading(true);

      stopTrackingOnly();

      await updateTripStatus(tripIdRef.current, 'completed');

      if (socketRef.current) {
        socketRef.current.emit('trip-status-updated', {
          tripId: tripIdRef.current,
          trackingId,
          status: 'completed',
        });
      }

      setCompletedLocal(true);
      setStatusMsg('✅ Order Completed!');

      await fetchTripData();
    } catch (err) {
      console.error(err);
      setStatusMsg('Failed to complete order');
    } finally {
      setPaymentLoading(false);
    }
  };

  const startTracking = useCallback(() => {
    if (isTracking || isStartingRef.current) return;

    if (!driverAccepted && !driverIdRef.current) {
      setStatusMsg('Please accept the order first');
      return;
    }

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not available in this browser');
      return;
    }

    if (!tripIdRef.current) {
      setStatusMsg('Order not loaded yet');
      return;
    }

    isStartingRef.current = true;
    setGpsError(null);
    setIsTracking(true);
    setShowMap(true);
    setStatusMsg('GPS signal dhundh raha hai...');

    requestWakeLock();

    if (socketRef.current) {
      socketRef.current.emit('join-trip', {
        trackingId,
        driverId: driverIdRef.current,
        role: 'driver',
      });

      socketRef.current.emit('trip-status-updated', {
        tripId: tripIdRef.current,
        trackingId,
        status: 'in-progress',
      });
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        setCoords({ latitude, longitude });
        setAccuracy(accuracy);
        setStatusMsg('Live location bheji ja rahi hai...');
        setLocationCount((n) => n + 1);
        isStartingRef.current = false;

        if (socketRef.current && tripIdRef.current) {
          socketRef.current.emit('update-location', {
            latitude,
            longitude,
            tripId: tripIdRef.current,
            trackingId,
            driverId: driverIdRef.current,
            tripStatus: 'in-progress',
            timestamp: new Date().toISOString(),
          });
        }
      },
      (err) => {
        isStartingRef.current = false;
        setIsTracking(false);

        if (err.code === 1) setGpsError('denied');
        else if (err.code === 2) setGpsError('Location unavailable. Please turn on GPS and try again.');
        else if (err.code === 3) setGpsError('Location timeout. Please try again.');
        else setGpsError(`GPS error: ${err.message}`);

        setStatusMsg('Failed to start GPS');
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 3000,
      }
    );
  }, [isTracking, trackingId, requestWakeLock, driverAccepted]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }

      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  const fmt = (v) => (v != null ? v.toFixed(6) : '——');

  const isCompleted =
    completedLocal || String(tripData?.status || '').toLowerCase() === 'completed';

  if (gpsError === 'denied') {
    return (
      <div className="min-h-screen bg-red-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-sm text-center">
          <div className="text-5xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">GPS Access Denied</h2>
          <p className="text-gray-600 text-sm">
            Please allow location access in browser settings, then reload the page.
          </p>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-3xl p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-3xl font-black mb-3">Order Completed</h1>
          <p className="text-gray-400 mb-6">
            Tracking stop ho gayi hai. Customer ab review de sakta hai.
          </p>
          <a
            href="/driver-dashboard"
            className="block w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 font-bold"
          >
            Go to Driver Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col gap-4 p-4">
      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Driver App</h1>
          <p className="text-xs text-gray-500 font-mono mt-1">
            Order DB ID: {tripId || 'loading...'}
          </p>
        </div>

        <div
          className={`text-xs font-bold px-3 py-1 rounded-full ${
            socketConnected
              ? 'bg-green-900 text-green-400'
              : 'bg-red-900 text-red-400'
          }`}
        >
          {socketConnected ? '● Online' : '● Offline'}
        </div>
      </div>

      {tripData && (
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wide">
                Order Detail
              </p>
              <h2 className="text-lg font-bold mt-1">
                {getOrderTypeLabel(tripData.orderType)}
              </h2>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusBadge(
                tripData.status
              )}`}
            >
              {tripData.status || 'pending'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-300">
            <div className="bg-gray-800 rounded-xl p-3">
              <span className="text-gray-400 text-xs uppercase block mb-1">
                Customer
              </span>
              <div className="font-semibold">{tripData.customerName || 'N/A'}</div>
            </div>

            <div className="bg-gray-800 rounded-xl p-3">
              <span className="text-gray-400 text-xs uppercase block mb-1">
                Amount
              </span>
              <div className="font-semibold">
                Rs.{' '}
                {tripData.finalPrice ||
                  tripData.budgetAmount ||
                  tripData.suggestedPrice ||
                  0}
              </div>
            </div>

            {tripData.destinationAddress && (
              <div className="bg-gray-800 rounded-xl p-3 md:col-span-2">
                <span className="text-gray-400 text-xs uppercase block mb-1">
                  📍 Destination
                </span>
                <div className="font-semibold text-red-400">
                  {tripData.destinationAddress}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!driverAccepted && !tripData?.driverId && (
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <p className="text-xs text-gray-400 mb-3 uppercase font-bold tracking-wide">
            Accept This Order
          </p>

          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Enter Driver ID"
              value={driverIdInput}
              onChange={(e) => setDriverIdInput(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-white outline-none"
            />

            <button
              onClick={handleAssignDriver}
              disabled={assigning}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold disabled:bg-gray-700"
            >
              {assigning ? '...' : 'Accept'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
        <p className="text-xs text-gray-400 mb-2 uppercase font-bold tracking-wide">
          Customer Tracking Link
        </p>

        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-300 flex-1 truncate font-mono bg-gray-800 px-3 py-2 rounded-lg">
            {customerLink}
          </p>

          <button
            onClick={copyCustomerLink}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              linkCopied
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {linkCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
        <p
          className={`text-sm font-medium mb-3 ${
            isTracking ? 'text-green-400 animate-pulse' : 'text-gray-300'
          }`}
        >
          {statusMsg}
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gray-800 p-3 rounded-xl">
            <span className="text-[10px] text-gray-400 uppercase block mb-1">
              Latitude
            </span>
            <div className="text-base font-mono font-bold">
              {fmt(coords?.latitude)}
            </div>
          </div>

          <div className="bg-gray-800 p-3 rounded-xl">
            <span className="text-[10px] text-gray-400 uppercase block mb-1">
              Longitude
            </span>
            <div className="text-base font-mono font-bold">
              {fmt(coords?.longitude)}
            </div>
          </div>
        </div>

        <div className="flex justify-between text-xs text-gray-400 flex-wrap gap-2">
          <span>
            Accuracy:{' '}
            <span className="text-blue-400">
              {accuracy ? `±${Math.round(accuracy)}m` : '—'}
            </span>
          </span>

          <span>
            Updates: <span className="text-green-400">{locationCount}</span>
          </span>

          {lastSent && (
            <span>
              Last sent:{' '}
              <span className="text-blue-400">
                {lastSent.toLocaleTimeString()}
              </span>
            </span>
          )}
        </div>
      </div>

      {showMap && coords && (
        <div
          className="rounded-2xl overflow-hidden border border-gray-700"
          style={{ height: '360px' }}
        >
          <MapContainer
            center={[coords.latitude, coords.longitude]}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
            scrollWheelZoom={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap"
              maxZoom={19}
            />

            <MapFollower coords={coords} destinationCoords={destinationCoords} />

            <Marker position={[coords.latitude, coords.longitude]} icon={driverIcon}>
              <Popup>
                <strong>You are here</strong>
              </Popup>
            </Marker>

            {destinationCoords && (
              <Marker
                position={[destinationCoords.lat, destinationCoords.lng]}
                icon={destIcon}
              >
                <Popup>
                  <strong>📍 Destination</strong>
                  <br />
                  {tripData?.destinationAddress}
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
              destinationCoords && (
                <Polyline
                  positions={[
                    [coords.latitude, coords.longitude],
                    [destinationCoords.lat, destinationCoords.lng],
                  ]}
                  pathOptions={{
                    color: '#2563eb',
                    weight: 4,
                    opacity: 0.5,
                    dashArray: '8 6',
                  }}
                />
              )
            )}
          </MapContainer>
        </div>
      )}

      {showMap && coords && destinationCoords && (
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <p className="text-xs text-gray-400 uppercase font-bold tracking-wide mb-2">
            Route Info
          </p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-800 rounded-xl p-3">
              <span className="text-gray-400 text-xs block mb-1">Road Distance</span>
              <div className="font-bold text-blue-400">
                {routeDistanceKm ? `${routeDistanceKm.toFixed(2)} km` : 'Calculating...'}
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-3">
              <span className="text-gray-400 text-xs block mb-1">ETA</span>
              <div className="font-bold text-green-400">
                {routeDurationMin ? `${Math.round(routeDurationMin)} min` : 'Calculating...'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="pb-4">
        {!isTracking ? (
          <button
            onClick={startTracking}
            disabled={!tripId || !driverAccepted}
            className="w-full py-5 bg-green-600 hover:bg-green-700 active:scale-95 rounded-2xl font-black text-xl shadow-lg shadow-green-900/40 disabled:bg-gray-800 disabled:text-gray-600 transition-all"
          >
            {tripId && driverAccepted ? '▶ START TRACKING' : 'Accept order first'}
          </button>
        ) : (
          <button
            onClick={stopTracking}
            className="w-full py-4 bg-red-600 hover:bg-red-700 active:scale-95 rounded-2xl font-black shadow-lg shadow-red-900/40 transition-all"
          >
            ⏹ PAUSE / STOP TRACKING
          </button>
        )}

        {driverAccepted && (
          <div className="mt-3">
            {!showConfirmComplete ? (
              <button
                onClick={() => setShowConfirmComplete(true)}
                disabled={paymentLoading}
                className="w-full py-5 bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-2xl font-black text-xl shadow-lg shadow-blue-900/40 transition-all disabled:bg-gray-700"
              >
                {paymentLoading ? 'Updating...' : '✅ MARK AS COMPLETED'}
              </button>
            ) : (
              <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
                <p className="text-center font-bold text-slate-200 mb-3">
                  Order complete ho gaya hai?
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowConfirmComplete(false)}
                    className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleCompleteTrip}
                    disabled={paymentLoading}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl disabled:bg-gray-700"
                  >
                    {paymentLoading ? '...' : 'Haan, Complete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverApp;