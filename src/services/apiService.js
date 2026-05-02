import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

// TRACKING
export const getTrackingData = async (trackingId) => {
  const res = await api.get(`/track/${trackingId}`);
  return res.data;
};

export const getLocationHistory = async (trackingId, limit = 50) => {
  const res = await api.get(`/track/${trackingId}/history`, {
    params: { limit },
  });
  return res.data;
};

// TRIPS
export const getAllTrips = async (status = null, limit = 100, offset = 0) => {
  const params = { limit, offset };
  if (status) params.status = status;

  const res = await api.get('/trips', { params });
  return res.data;
};

export const getTripById = async (tripId) => {
  const res = await api.get(`/trips/${tripId}`);
  return res.data;
};

// CREATE ORDER
export const createOrder = async ({
  orderType,
  customerName,
  customerPhone,
  pickupAddress = '',
  destinationAddress = '',
  pickupLat = null,
  pickupLng = null,
  destinationLat = null,
  destinationLng = null,
  items = [],
  notes = '',
  budgetAmount = '',
  paymentMethod = 'cash',
}) => {
  const payload = {
    order_type: orderType,
    customer_name: customerName,
    customer_phone: customerPhone || null,
    pickup_address: pickupAddress || null,
    destination_address: destinationAddress || null,

    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    destination_lat: destinationLat,
    destination_lng: destinationLng,

    item_list: Array.isArray(items) ? items : [],
    notes: notes || null,
    budget_amount:
      budgetAmount !== '' && budgetAmount !== null && budgetAmount !== undefined
        ? Number(budgetAmount)
        : null,
    payment_method: paymentMethod || 'cash',
  };

  const res = await api.post('/orders', payload);
  return res.data;
};

// DRIVER
export const assignDriver = async (tripId, driverId) => {
  const res = await api.put(`/trips/${tripId}/assign-driver`, {
    driver_id: driverId,
  });
  return res.data;
};

export const getAllDrivers = async () => {
  const res = await api.get('/drivers');
  return res.data;
};

export const createDriver = async (name, phone, status = 'offline') => {
  const res = await api.post('/drivers', { name, phone, status });
  return res.data;
};

// STATUS
export const updateTripStatus = async (tripId, status) => {
  const res = await api.put(`/trips/${tripId}/status`, { status });
  return res.data;
};

export const cancelTrip = async (tripId) => {
  return updateTripStatus(tripId, 'cancelled');
};

export const clearTripHistory = async (tripId) => {
  const res = await api.post(`/trips/${tripId}/clear-history`);
  return res.data;
};

export const rejectTrip = async (tripId) => {
  const res = await api.put(`/trips/${tripId}/reject`);
  return res.data;
};

export const updateTripBudget = async (tripId, budgetAmount) => {
  const res = await api.put(`/trips/${tripId}/budget`, {
    budget_amount: budgetAmount,
  });
  return res.data;
};

// NEGOTIATION / OFFER SYSTEM
export const sendDriverOffer = async (tripId, data) => {
  const res = await api.put(`/trips/${tripId}/driver-offer`, {
    driver_id: data.driver_id,
    offer_amount: data.offer_amount,
  });
  return res.data;
};

export const sendCustomerCounterOffer = async (tripId, data) => {
  const res = await api.put(`/trips/${tripId}/customer-counter-offer`, {
    counter_amount: data.counter_amount,
  });
  return res.data;
};

export const acceptCustomerCounterOffer = async (tripId, data) => {
  const res = await api.put(`/trips/${tripId}/accept-customer-counter`, {
    driver_id: data.driver_id,
  });
  return res.data;
};

export const acceptDriverOffer = async (tripId) => {
  const res = await api.put(`/trips/${tripId}/accept-driver-offer`);
  return res.data;
};

export const closeNegotiation = async (tripId) => {
  const res = await api.put(`/trips/${tripId}/close-negotiation`);
  return res.data;
};

// PAYMENT
export const updatePayment = async (
  tripId,
  {
    payment_status = 'paid',
    paid_amount = 0,
    transaction_id = null,
    payment_method = 'cash',
  } = {}
) => {
  const res = await api.put(`/trips/${tripId}/payment`, {
    payment_status,
    paid_amount,
    transaction_id,
    payment_method,
  });
  return res.data;
};

// REVIEW
export const submitReview = async (tripId, { rating, review_text = '' } = {}) => {
  const res = await api.post(`/trips/${tripId}/review`, {
    rating,
    review_text,
  });
  return res.data;
};

// COMPLAINT
export const submitComplaint = async (
  tripId,
  { message, complaint_type = 'general' } = {}
) => {
  const res = await api.post(`/trips/${tripId}/complaint`, {
    message,
    complaint_type,
  });
  return res.data;
};

// AUTH - UPDATED TO SESSIONSTORAGE
export const signupUser = async (data) => {
  const res = await api.post('/auth/signup', data);
  return res.data;
};

export const loginUser = async (data) => {
  const res = await api.post('/auth/login', data);
  return res.data;
};

export const forgotPassword = async (email) => {
  const res = await api.post('/auth/forgot-password', { email });
  return res.data;
};

export const resetPassword = async (data) => {
  const res = await api.post('/auth/reset-password', data);
  return res.data;
};

export const saveAuthUser = (user) => {
  // Using sessionStorage so each tab has its own driver session
  sessionStorage.setItem('quick_delivery_user', JSON.stringify(user));
};

export const getAuthUser = () => {
  const user = sessionStorage.getItem('quick_delivery_user');
  return user ? JSON.parse(user) : null;
};

export const logoutUser = () => {
  sessionStorage.removeItem('quick_delivery_user');
  sessionStorage.clear();
};

export default api;