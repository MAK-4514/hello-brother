const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Vehicle name is required'],
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['car', 'bike', 'scooty', 'camera'],
    index: true
  },
  brand: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  year: Number,
  description: {
    type: String,
    maxlength: 1000
  },
  images: [String],
  pricePerDay: {
    type: Number,
    required: [true, 'Daily rental price is required'],
    min: 0
  },
  pricePerHour: {
    type: Number,
    min: 0
  },
  // Vehicle-specific fields
  specs: {
    fuelType: { type: String, enum: ['petrol', 'diesel', 'electric', 'hybrid', 'na'] },
    transmission: { type: String, enum: ['manual', 'automatic', 'na'] },
    seats: Number,
    mileage: String,
    engine: String,
    // Camera-specific
    sensorType: String,
    megapixels: Number,
    lensIncluded: [String]
  },
  features: [String],
  availability: {
    type: String,
    enum: ['available', 'rented', 'maintenance'],
    default: 'available',
    index: true
  },
  location: {
    city: String,
    area: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  ratings: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  totalTrips: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Text search index
vehicleSchema.index({ name: 'text', brand: 'text', description: 'text' });

module.exports = mongoose.model('Vehicle', vehicleSchema);
