const express = require('express');
const HolidayPackage = require('../models/HolidayPackage');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/packages
// @desc    Get all active holiday packages
// @access  Public
router.get('/', async (req, res) => {
  try {
    const {
      category,
      destination,
      minPrice,
      maxPrice,
      duration,
      featured,
      search,
      sort = '-createdAt',
      page = 1,
      limit = 12
    } = req.query;

    const filter = { isActive: true };

    if (category) filter.category = category;
    if (destination) filter.destination = new RegExp(destination, 'i');
    if (featured === 'true') filter.isFeatured = true;
    if (duration) filter['duration.days'] = { $lte: Number(duration) };
    if (minPrice || maxPrice) {
      filter['pricing.basePrice'] = {};
      if (minPrice) filter['pricing.basePrice'].$gte = Number(minPrice);
      if (maxPrice) filter['pricing.basePrice'].$lte = Number(maxPrice);
    }
    if (search) {
      filter.$text = { $search: search };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [packages, total] = await Promise.all([
      HolidayPackage.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      HolidayPackage.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: packages,
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

// @route   GET /api/packages/featured
// @desc    Get featured packages (for homepage)
// @access  Public
router.get('/featured', async (req, res) => {
  try {
    const packages = await HolidayPackage.find({ isActive: true, isFeatured: true })
      .sort('-ratings.average')
      .limit(6);
    res.json({ success: true, data: packages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/packages/:slug
// @desc    Get package by slug
// @access  Public
router.get('/:slug', async (req, res) => {
  try {
    const pkg = await HolidayPackage.findOne({ slug: req.params.slug })
      .populate('vehicleOptions');
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }
    res.json({ success: true, data: pkg });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/packages
// @desc    Create holiday package (Admin)
// @access  Private/Admin
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const pkg = await HolidayPackage.create(req.body);
    res.status(201).json({ success: true, data: pkg });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/packages/:id
// @desc    Update holiday package (Admin)
// @access  Private/Admin
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const pkg = await HolidayPackage.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }
    res.json({ success: true, data: pkg });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
