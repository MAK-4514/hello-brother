const express = require('express');
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/bookings
// @desc    Create a new booking
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const {
      bookingType,
      vehicleId,
      holidayPackageId,
      startDate,
      endDate,
      pickupLocation,
      dropoffLocation,
      customerDetails,
      paymentMethod
    } = req.body;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Build booking object
    const bookingData = {
      user: req.user._id,
      bookingType,
      startDate: start,
      endDate: end,
      pickupLocation,
      dropoffLocation,
      customerDetails,
      paymentMethod
    };

    // Calculate pricing for vehicle bookings
    if (bookingType === 'vehicle' && vehicleId) {
      const vehicle = await Vehicle.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ success: false, message: 'Vehicle not found' });
      }
      if (vehicle.availability !== 'available') {
        return res.status(400).json({ success: false, message: 'Vehicle is not available' });
      }

      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      const subtotal = vehicle.pricePerDay * days;
      const tax = subtotal * 0.18; // 18% GST

      bookingData.vehicle = vehicleId;
      bookingData.dailyRate = vehicle.pricePerDay;
      bookingData.totalDays = days;
      bookingData.subtotal = subtotal;
      bookingData.tax = tax;
      bookingData.totalAmount = subtotal + tax;

      // Mark vehicle as rented
      await Vehicle.findByIdAndUpdate(vehicleId, { availability: 'rented' });
    }

    if (bookingType === 'holiday_package' && holidayPackageId) {
      bookingData.holidayPackage = holidayPackageId;
    }

    const booking = await Booking.create(bookingData);

    res.status(201).json({
      success: true,
      data: await booking.populate(['vehicle', 'holidayPackage'])
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/bookings/my
// @desc    Get current user's bookings
// @access  Private
router.get('/my', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('vehicle')
      .populate('holidayPackage')
      .sort('-createdAt');

    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get single booking
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('vehicle')
      .populate('holidayPackage')
      .populate('user', 'name email phone');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Ensure user owns the booking or is admin
    if (booking.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/bookings/:id/status
// @desc    Update booking status (Admin)
// @access  Private/Admin
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      {
        status,
        ...(status === 'confirmed' && { confirmedAt: new Date() }),
        ...(status === 'cancelled' && {
          cancelledAt: new Date(),
          cancellationReason: req.body.reason
        })
      },
      { new: true }
    );

    // If cancelled, free the vehicle
    if (status === 'cancelled' && booking.vehicle) {
      await Vehicle.findByIdAndUpdate(booking.vehicle, { availability: 'available' });
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/bookings (Admin)
// @desc    Get all bookings
// @access  Private/Admin
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate('vehicle')
        .populate('holidayPackage')
        .populate('user', 'name email phone')
        .sort('-createdAt')
        .skip(skip)
        .limit(Number(limit)),
      Booking.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: bookings,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
