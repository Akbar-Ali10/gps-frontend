import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  joinAdminLiveTracking,
  onLocationUpdate,
  onTripStatusUpdate,
} from '../services/socketService';
import { getAllTrips } from '../services/apiService';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const KARACHI_CENTER = [24.8607, 67.0011];

const createDriverIcon = () =>
  L.divIcon({
    html: `
      <div style="
        width: 22px;
        height: 22px;
        background: #2563eb;
        border: 3px solid white;
        border-radius: 999px;
        box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.22);
      "></div>
    `,
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

const createDestinationIcon = () =>
  L.divIcon({
    html: `
      <div style="
        width: 26px;
        height: 26px;
        background: #ef4444;
        border: 3px solid white;
        border-radius: 999px;
        box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.22);
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        font-size:13px;
        font-weight:900;
      ">📍</div>
    `,
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const geocodeAddress = async (address) => {
  if (!address || !String(address).trim()) return null;

  try {
    const cleanAddress = String(address)
      .replace(/koranghi/gi, 'Korangi')
      .replace(/korngi/gi, 'Korangi')
      .replace(/ladhini/gi, 'Landhi')
      .replace(/\s+/g, ' ')
      .trim();

    const query = `${cleanAddress}, Karachi, Pakistan`;

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      query
    )}`;

    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
    });

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) return null;

    const lat = Number(data[0].lat);
    const lng = Number(data[0].lon);

    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

    return { lat, lng };
  } catch (error) {
    console.error('Destination geocode failed:', error);
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

const MapAutoFit = ({ drivers }) => {
  const map = useMap();

  useEffect(() => {
    if (!drivers.length) return;

    setTimeout(() => {
      map.invalidateSize();

      const points = [];

      drivers.forEach((d) => {
        points.push([d.lat, d.lng]);

        if (d.destinationLat && d.destinationLng) {
          points.push([d.destinationLat, d.destinationLng]);
        }
      });

      if (points.length === 1) {
        map.setView(points[0], 15, { animate: true });
        return;
      }

      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [45, 45] });
    }, 300);
  }, [drivers, map]);

  return null;
};

const AdminLiveMap = ({ refreshTrigger }) => {
  const [drivers, setDrivers] = useState({});
  const [tripsById, setTripsById] = useState({});
  const [geocodedDestinations, setGeocodedDestinations] = useState({});
  const [routes, setRoutes] = useState({});

  const driverIcon = useMemo(() => createDriverIcon(), []);
  const destinationIcon = useMemo(() => createDestinationIcon(), []);

  const loadTrips = async () => {
    try {
      const res = await getAllTrips(null, 500, 0);
      const trips = res?.trips || [];

      const map = {};
      trips.forEach((trip) => {
        map[String(trip.id)] = trip;
      });
      setTripsById(map);

      // Fallback: socket na mile toh API polling se active drivers show karo
      setDrivers((prev) => {
        const updated = { ...prev };
        trips.forEach((trip) => {
          const status = String(trip.status || '').toLowerCase();
          const lat = Number(trip.latest_latitude);
          const lng = Number(trip.latest_longitude);
          if (!['active', 'in-progress'].includes(status)) return;
          if (!trip.latest_latitude || !trip.latest_longitude) return;
          if (isNaN(lat) || isNaN(lng)) return;
          const markerKey = `${trip.id}-api`;
          updated[markerKey] = {
            key: markerKey,
            lat,
            lng,
            tripId: trip.id,
            trackingId: trip.tracking_id,
            driverId: trip.driver_id || null,
            tripStatus: trip.status,
            updatedAt: trip.updated_at || new Date().toISOString(),
          };
        });
        return updated;
      });
    } catch (error) {
      console.error('Failed to load trips for admin map:', error);
    }
  };

  useEffect(() => {
    loadTrips();
    const interval = setInterval(loadTrips, 5000);
    return () => clearInterval(interval);
  }, [refreshTrigger]);

  useEffect(() => {
    joinAdminLiveTracking();

    const unsubscribeLocation = onLocationUpdate((data) => {
      if (!data?.tripId) return;
      if (data.latitude == null || data.longitude == null) return;

      const lat = Number(data.latitude);
      const lng = Number(data.longitude);

      if (Number.isNaN(lat) || Number.isNaN(lng)) return;

      const status = String(data.tripStatus || 'active').toLowerCase();

      const markerKey = `${data.tripId}-${data.driverId || data.trackingId || 'driver'}`;

      if (['completed', 'done', 'cancelled', 'closed'].includes(status)) {
        setDrivers((prev) => {
          const updated = { ...prev };
          delete updated[markerKey];
          return updated;
        });
        return;
      }

      setDrivers((prev) => ({
        ...prev,
        [markerKey]: {
          key: markerKey,
          lat,
          lng,
          tripId: data.tripId,
          trackingId: data.trackingId,
          driverId: data.driverId || null,
          tripStatus: data.tripStatus || 'in-progress',
          updatedAt: data.timestamp || new Date().toISOString(),
        },
      }));
    });

    const unsubscribeStatus = onTripStatusUpdate((data) => {
      const status = String(data?.status || '').toLowerCase();

      if (!data?.tripId && !data?.trackingId) return;

      if (['completed', 'done', 'cancelled', 'closed'].includes(status)) {
        setDrivers((prev) => {
          const updated = { ...prev };

          Object.keys(updated).forEach((key) => {
            const driver = updated[key];

            if (
              String(driver.tripId) === String(data.tripId) ||
              String(driver.trackingId) === String(data.trackingId)
            ) {
              delete updated[key];
            }
          });

          return updated;
        });

        setRoutes((prev) => {
          const updated = { ...prev };

          Object.keys(updated).forEach((key) => {
            if (
              key.includes(String(data.tripId || '')) ||
              key.includes(String(data.trackingId || ''))
            ) {
              delete updated[key];
            }
          });

          return updated;
        });
      }
    });

    return () => {
      if (unsubscribeLocation) unsubscribeLocation();
      if (unsubscribeStatus) unsubscribeStatus();
    };
  }, []);

  useEffect(() => {
    const runGeocoding = async () => {
      const activeDrivers = Object.values(drivers);

      for (const driver of activeDrivers) {
        const trip = tripsById[String(driver.tripId)];

        const destinationAddress =
          trip?.destination_address ||
          trip?.destinationAddress ||
          trip?.pickup_address ||
          trip?.pickupAddress ||
          '';

        if (!destinationAddress) continue;

        const hasSavedDestination =
          trip?.destination_lat &&
          trip?.destination_lng &&
          !Number.isNaN(Number(trip.destination_lat)) &&
          !Number.isNaN(Number(trip.destination_lng));

        if (hasSavedDestination) continue;

        const cacheKey = `${driver.tripId}-${destinationAddress}`;

        if (geocodedDestinations[cacheKey]) continue;

        const coords = await geocodeAddress(destinationAddress);

        if (coords) {
          setGeocodedDestinations((prev) => ({
            ...prev,
            [cacheKey]: coords,
          }));
        }
      }
    };

    runGeocoding();
  }, [drivers, tripsById, geocodedDestinations]);

  const driverList = useMemo(() => {
    return Object.values(drivers).map((driver) => {
      const trip = tripsById[String(driver.tripId)];

      const destinationAddress =
        trip?.destination_address ||
        trip?.destinationAddress ||
        trip?.pickup_address ||
        trip?.pickupAddress ||
        '';

      const customerName =
        trip?.customer_name ||
        trip?.customerName ||
        'Customer';

      const driverName =
        trip?.driver_name ||
        trip?.driverName ||
        `Driver ${driver.driverId || ''}`;

      const orderType =
        trip?.order_type ||
        trip?.orderType ||
        'order';

      const cacheKey = `${driver.tripId}-${destinationAddress}`;

      const destination =
        trip?.destination_lat &&
        trip?.destination_lng &&
        !Number.isNaN(Number(trip.destination_lat)) &&
        !Number.isNaN(Number(trip.destination_lng))
          ? {
              lat: Number(trip.destination_lat),
              lng: Number(trip.destination_lng),
            }
          : geocodedDestinations[cacheKey];

      const routeKey = destination
        ? `${driver.tripId}-${driver.key}-${driver.lat.toFixed(4)}-${driver.lng.toFixed(
            4
          )}-${destination.lat.toFixed(4)}-${destination.lng.toFixed(4)}`
        : null;

      const routeInfo = routeKey ? routes[routeKey] : null;

      return {
        ...driver,
        customerName,
        driverName,
        orderType,
        destinationAddress,
        destinationLat: destination?.lat || null,
        destinationLng: destination?.lng || null,
        routeKey,
        routePoints: routeInfo?.points || null,
        routeDistanceKm: routeInfo?.distanceKm || null,
        routeDurationMin: routeInfo?.durationMin || null,
      };
    });
  }, [drivers, tripsById, geocodedDestinations, routes]);

  useEffect(() => {
    const loadRoutes = async () => {
      for (const d of driverList) {
        if (!d.destinationLat || !d.destinationLng || !d.routeKey) continue;
        if (routes[d.routeKey]) continue;

        const routeInfo = await getRouteFromOSRM(
          d.lat,
          d.lng,
          d.destinationLat,
          d.destinationLng
        );

        if (routeInfo?.points?.length) {
          setRoutes((prev) => ({
            ...prev,
            [d.routeKey]: routeInfo,
          }));
        }
      }
    };

    if (driverList.length > 0) {
      loadRoutes();
    }
  }, [driverList, routes]);

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-slate-900">Live Drivers Map</h3>
          <p className="text-xs text-slate-500">
            Blue marker is the driver, red marker is the destination, blue route shows path from driver to customer.
          </p>
        </div>

        <div className="px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
          Active Drivers: {driverList.length}
        </div>
      </div>

      <div style={{ height: '420px', width: '100%' }}>
        <MapContainer
          center={KARACHI_CENTER}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
            maxZoom={19}
          />

          <MapAutoFit drivers={driverList} />

          {driverList.map((d) => (
            <React.Fragment key={d.key || d.tripId}>
              {d.destinationLat && d.destinationLng && (
                <>
                  {d.routePoints && d.routePoints.length > 0 ? (
                    <Polyline
                      positions={d.routePoints}
                      pathOptions={{
                        color: '#2563eb',
                        weight: 6,
                        opacity: 0.95,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                    />
                  ) : (
                    <Polyline
                      positions={[
                        [d.lat, d.lng],
                        [d.destinationLat, d.destinationLng],
                      ]}
                      pathOptions={{
                        color: '#2563eb',
                        weight: 4,
                        opacity: 0.7,
                        dashArray: '8, 8',
                      }}
                    />
                  )}

                  <Marker
                    position={[d.destinationLat, d.destinationLng]}
                    icon={destinationIcon}
                  >
                    <Popup>
                      <div className="text-sm min-w-[180px]">
                        <div className="font-bold text-slate-900 mb-2">
                          Customer / Destination
                        </div>

                        <div>
                          <strong>Customer:</strong> {d.customerName}
                        </div>

                        <div>
                          <strong>Trip ID:</strong> {d.tripId}
                        </div>

                        <div>
                          <strong>Address:</strong> {d.destinationAddress || 'N/A'}
                        </div>

                        {d.routeDistanceKm !== null && (
                          <div>
                            <strong>Distance:</strong>{' '}
                            {d.routeDistanceKm.toFixed(2)} km
                          </div>
                        )}

                        {d.routeDurationMin !== null && (
                          <div>
                            <strong>ETA:</strong>{' '}
                            {Math.round(d.routeDurationMin)} min
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                </>
              )}

              <Marker position={[d.lat, d.lng]} icon={driverIcon}>
                <Popup>
                  <div className="text-sm min-w-[200px]">
                    <div className="font-bold text-slate-900 mb-2">
                      Driver Live
                    </div>

                    <div>
                      <strong>Driver:</strong> {d.driverName}
                    </div>

                    <div>
                      <strong>Driver ID:</strong> {d.driverId || 'N/A'}
                    </div>

                    <div>
                      <strong>Customer:</strong> {d.customerName}
                    </div>

                    <div>
                      <strong>Trip ID:</strong> {d.tripId}
                    </div>

                    <div>
                      <strong>Order:</strong>{' '}
                      {String(d.orderType).replace('_', ' ')}
                    </div>

                    <div>
                      <strong>Tracking:</strong> {d.trackingId || 'N/A'}
                    </div>

                    <div>
                      <strong>Status:</strong> {d.tripStatus || 'active'}
                    </div>

                    {d.destinationAddress && (
                      <div className="mt-2">
                        <strong>Going to:</strong> {d.destinationAddress}
                      </div>
                    )}

                    {d.routeDistanceKm !== null && (
                      <div className="mt-2 font-bold text-blue-700">
                        Distance: {d.routeDistanceKm.toFixed(2)} km
                      </div>
                    )}

                    {d.routeDurationMin !== null && (
                      <div className="font-bold text-emerald-700">
                        ETA: {Math.round(d.routeDurationMin)} min
                      </div>
                    )}

                    <div className="text-xs text-slate-500 mt-2">
                      Updated: {new Date(d.updatedAt).toLocaleString()}
                    </div>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          ))}
        </MapContainer>
      </div>

      {!driverList.length && (
        <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 text-sm text-amber-800">
          No driver is currently sending live location. Press START TRACKING in the Driver app to appear on map.
        </div>
      )}

      {driverList.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-200 bg-white">
          <h4 className="font-bold text-slate-900 text-sm mb-3">
            Active Trip Routes
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {driverList.map((d) => (
              <div
                key={`info-${d.key || d.tripId}`}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
              >
                <div className="font-bold text-slate-900">
                  {d.driverName} → {d.customerName}
                </div>

                <div className="text-slate-500 text-xs mt-1">
                  Trip #{d.tripId} • {String(d.orderType).replace('_', ' ')}
                </div>

                <div className="mt-2 text-slate-700">
                  <strong>Going to:</strong> {d.destinationAddress || 'N/A'}
                </div>

                <div className="mt-1 font-bold text-blue-700">
                  Distance:{' '}
                  {d.routeDistanceKm !== null
                    ? `${d.routeDistanceKm.toFixed(2)} km`
                    : d.destinationAddress
                    ? 'Calculating / address not found'
                    : 'Destination missing'}
                </div>

                <div className="mt-1 font-bold text-emerald-700">
                  ETA:{' '}
                  {d.routeDurationMin !== null
                    ? `${Math.round(d.routeDurationMin)} min`
                    : 'Calculating'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLiveMap;