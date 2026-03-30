const mongoose = require('mongoose');

const holidayPackageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Package title is required'],
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  destination: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 3000
  },
  shortDescription: {
    type: String,
    maxlength: 300
  },
  images: [String],
  coverImage: String,
  duration: {
    days: { type: Number, required: true, min: 1 },
    nights: { type: Number, required: true, min: 0 }
  },
  pricing: {
    basePrice: { type: Number, required: true },
    discountedPrice: Number,
    currency: { type: String, default: 'INR' },
    perPersonBasis: { type: Boolean, default: true },
    includesVehicle: { type: Boolean, default: false }
  },
  inclusions: [String],
  exclusions: [String],
  itinerary: [{
    day: Number,
    title: String,
    description: String,
    activities: [String],
    meals: {
      breakfast: Boolean,
      lunch: Boolean,
      dinner: Boolean
    }
  }],
  highlights: [String],
  category: {
    type: String,
    enum: ['adventure', 'beach', 'mountain', 'heritage', 'wildlife', 'romantic', 'family', 'weekend'],
    required: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'moderate', 'challenging'],
    default: 'easy'
  },
  maxGroupSize: { type: Number, default: 20 },
  vehicleOptions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  }],
  startDates: [Date],
  ratings: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Auto-generate slug from title
holidayPackageSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Text search
holidayPackageSchema.index({ title: 'text', destination: 'text', description: 'text' });

module.exports = mongoose.model('HolidayPackage', holidayPackageSchema);
