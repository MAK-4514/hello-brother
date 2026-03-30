const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bookingType: {
    type: String,
    required: true,
    enum: ['vehicle', 'holiday_package']
  },
  // For vehicle/camera bookings
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  },
  // For holiday package bookings
  holidayPackage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HolidayPackage'
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  pickupLocation: String,
  dropoffLocation: String,
  // Pricing
  dailyRate: Number,
  totalDays: Number,
  subtotal: Number,
  tax: Number,
  discount: { type: Number, default: 0 },
  totalAmount: {
    type: Number,
    required: true
  },
  // Booking status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'active', 'completed', 'cancelled', 'refunded'],
    default: 'pending',
    index: true
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid', 'refunded'],
    default: 'unpaid'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'cash', 'wallet']
  },
  // Customer details for the booking
  customerDetails: {
    name: String,
    email: String,
    phone: String,
    emergencyContact: String,
    specialRequests: String
  },
  // AI-generated itinerary (for holiday packages)
  aiItinerary: {
    generated: { type: Boolean, default: false },
    content: String,
    generatedAt: Date
  },
  // Timestamps
  confirmedAt: Date,
  cancelledAt: Date,
  cancellationReason: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Auto-calculate total days and amount before save
bookingSchema.pre('save', function(next) {
  if (this.startDate && this.endDate) {
    const timeDiff = this.endDate.getTime() - this.startDate.getTime();
    this.totalDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    if (this.totalDays < 1) this.totalDays = 1;
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
