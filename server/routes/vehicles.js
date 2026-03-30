const express = require('express');
const Vehicle = require('../models/Vehicle');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/vehicles
// @desc    Get all vehicles with filters
// @access  Public
router.get('/', async (req, res) => {
  try {
    const {
      type,
      minPrice,
      maxPrice,
      availability,
      city,
      transmission,
      fuelType,
      search,
      sort = '-createdAt',
      page = 1,
      limit = 12
    } = req.query;

    const filter = { isActive: true };

    if (type) filter.type = type;
    if (availability) filter.availability = availability;
    if (city) filter['location.city'] = new RegExp(city, 'i');
    if (transmission) filter['specs.transmission'] = transmission;
    if (fuelType) filter['specs.fuelType'] = fuelType;
    if (minPrice || maxPrice) {
      filter.pricePerDay = {};
      if (minPrice) filter.pricePerDay.$gte = Number(minPrice);
      if (maxPrice) filter.pricePerDay.$lte = Number(maxPrice);
    }
    if (search) {
      filter.$text = { $search: search };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [vehicles, total] = await Promise.all([
      Vehicle.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      Vehicle.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: vehicles,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        limit: Number(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/vehicles/:id
// @desc    Get single vehicle
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }
    res.json({ success: true, data: vehicle });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/vehicles
// @desc    Add a new vehicle (Admin)
// @access  Private/Admin
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const vehicle = await Vehicle.create(req.body);
    res.status(201).json({ success: true, data: vehicle });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/vehicles/:id
// @desc    Update vehicle (Admin)
// @access  Private/Admin
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }
    res.json({ success: true, data: vehicle });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/vehicles/:id
// @desc    Delete vehicle (Admin) - soft delete
// @access  Private/Admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, { isActive: false });
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }
    res.json({ success: true, message: 'Vehicle removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
