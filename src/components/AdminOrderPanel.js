import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getTrackingData } from '../services/apiService';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const destIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;background:#ef4444;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(239,68,68,0.5)"></div>`,
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 18],
});

const MapFit = ({ driverPos, destPos }) => {
  const map = useMap();
  useEffect(() => {
    if (driverPos && destPos) {
      map.fitBounds([driverPos, destPos], { padding: [40, 40] });
    } else if (driverPos) {
      map.setView(driverPos, 14);
    }
  }, [driverPos, destPos, map]);
  return null;
};

const statusColors = {
  pending: 'bg-amber-100 text-amber-800',
  'counter_offer': 'bg-purple-100 text-purple-800',
  'customer_countered': 'bg-blue-100 text-blue-800',
  active: 'bg-blue-100 text-blue-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800',
};

const fmt = (val) => val || 'N/A';

const parseUTC = (iso) => {
  if (!iso) return null;
  try {
    let formatted = iso.replace(' ', 'T');
    if (!formatted.endsWith('Z') && !formatted.includes('+')) formatted += 'Z';
    const date = new Date(formatted);
    return isNaN(date.getTime()) ? null : date;
  } catch (e) {
    return null;
  }
};

const fmtTime = (iso) => {
  const date = parseUTC(iso);
  if (!date) return 'N/A';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi',
  });
};

const fmtDate = (iso) => {
  const date = parseUTC(iso);
  if (!date) return 'N/A';
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
  });
};

const minutesDiff = (a, b) => {
  const dateA = parseUTC(a);
  const dateB = parseUTC(b);
  if (!dateA || !dateB) return null;
  return Math.max(0, Math.round((dateB - dateA) / 60000));
};
// -----------------------------------------------------

const AdminOrderPanel = ({ trip, onClose }) => {
  const [liveData, setLiveData] = useState(null);

  const fetchLive = useCallback(async () => {
    if (!trip?.tracking_id) return;
    try {
      const data = await getTrackingData(trip.tracking_id);
      setLiveData(data);
    } catch {}
  }, [trip?.tracking_id]);

  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, 5000);
    return () => clearInterval(interval);
  }, [fetchLive]);

  if (!trip) return null;

  const status = String(trip.status || '').toLowerCase();
  const isActive = status === 'active' || status === 'in-progress';
  const isCompleted = status === 'completed';

  const driverLoc = liveData?.location;
  const driverPos = driverLoc
    ? [Number(driverLoc.latitude), Number(driverLoc.longitude)]
    : null;

  const destPos =
    trip.destination_lat && trip.destination_lng
      ? [Number(trip.destination_lat), Number(trip.destination_lng)]
      : null;

  const mapCenter = driverPos || destPos || [24.8607, 67.0011];
  const duration = minutesDiff(trip.created_at, trip.updated_at);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-black text-slate-900 text-lg">Order Detail</h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              #{String(trip.tracking_id || '').slice(0, 12)}...
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${statusColors[status] || 'bg-slate-100 text-slate-700'}`}>
              {status}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Map */}
        <div className="h-52 w-full relative">
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapFit driverPos={driverPos} destPos={destPos} />
            {driverPos && <Marker position={driverPos} />}
            {destPos && <Marker position={destPos} icon={destIcon} />}
            {driverPos && destPos && (
              <Polyline positions={[driverPos, destPos]} color="#3b82f6" weight={3} dashArray="6,6" />
            )}
          </MapContainer>
          {isActive && (
            <div className="absolute top-2 left-2 z-[999] bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse inline-block" />
              LIVE
            </div>
          )}
        </div>

        <div className="p-5 space-y-4 flex-1">
          {/* Time Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-2xl p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">Order Placed</p>
              <p className="font-bold text-slate-800 text-sm">{fmtTime(trip.created_at)}</p>
              <p className="text-xs text-slate-400">{fmtDate(trip.created_at)}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">
                {isCompleted ? 'Completed' : trip.accepted_at ? 'Accepted' : 'Updated'}
              </p>
              <p className="font-bold text-slate-800 text-sm">
                {fmtTime(isCompleted ? trip.updated_at : (trip.accepted_at || trip.updated_at))}
              </p>
            </div>
            <div className={`rounded-2xl p-3 text-center ${isCompleted ? 'bg-emerald-50' : isActive ? 'bg-blue-50' : 'bg-slate-50'}`}>
              <p className="text-xs text-slate-400 mb-1">
                {isCompleted ? 'Trip Duration' : trip.accepted_at ? 'Wait Time' : 'Duration'}
              </p>
              <p className={`font-black text-lg ${isCompleted ? 'text-emerald-600' : isActive ? 'text-blue-600' : 'text-slate-700'}`}>
                {isCompleted
                  ? (minutesDiff(trip.accepted_at || trip.created_at, trip.updated_at) !== null
                      ? `${minutesDiff(trip.accepted_at || trip.created_at, trip.updated_at)}m`
                      : 'N/A')
                  : trip.accepted_at
                    ? (minutesDiff(trip.created_at, trip.accepted_at) !== null
                        ? `${minutesDiff(trip.created_at, trip.accepted_at)}m`
                        : 'N/A')
                    : (duration !== null ? `${duration}m` : 'N/A')
                }
              </p>
            </div>
          </div>

          {/* Customer */}
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase mb-2">👤 Customer</p>
            <p className="font-bold text-slate-900">{fmt(trip.customer_name)}</p>
            <p className="text-sm text-slate-500">{fmt(trip.customer_phone)}</p>
          </div>

          {/* Driver */}
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase mb-2">🚗 Driver</p>
            <p className="font-bold text-slate-900">{fmt(trip.driver_name)}</p>
            <p className="text-sm text-slate-500">ID: {fmt(trip.driver_id)}</p>
          </div>

          {/* Destination */}
          <div className="bg-rose-50 rounded-2xl p-4">
            <p className="text-xs font-bold text-rose-400 uppercase mb-1">🎯 Destination</p>
            <p className="text-sm text-slate-700">{fmt(trip.destination_address)}</p>
          </div>

          {/* Live Button */}
          <a
            href={`/driver/${trip.tracking_id}`}
            target="_blank"
            rel="noreferrer"
            className="block w-full text-center py-3 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200"
          >
            🚗 Driver Live Location ↗
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderPanel;