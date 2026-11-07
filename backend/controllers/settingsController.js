const School = require('../models/School');
const path = require('path');
const { validationResult } = require('express-validator');

/**
 * Settings controller – aligned with school portal Settings page.
 * GET/PUT /api/settings/school-info, POST /api/settings/school-info/logo
 */

// @desc    Get current school info (for settings page)
// @route   GET /api/settings/school-info
// @access  Private (School Admin only)
const getSchoolInfo = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'No school associated with this account'
      });
    }

    const school = await School.findById(schoolId).lean();
    if (!school) {
      return res.status(404).json({
        success: false,
        error: 'School not found'
      });
    }

    // Return shape expected by school portal Settings.tsx
    res.status(200).json({
      success: true,
      data: {
        _id: school._id,
        name: school.name || '',
        code: school.code || '',
        address: school.address || '',
        contact: school.contact || '',
        phone: school.phone || '',
        email: school.email || '',
        website: school.website || '',
        logo: school.logo || '',
        principal: school.principal || { name: '', email: '', phone: '' }
      }
    });
  } catch (error) {
    console.error('Get school info error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Update current school info (for settings page)
// @route   PUT /api/settings/school-info
// @access  Private (School Admin only)
const updateSchoolInfo = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'No school associated with this account'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({
        success: false,
        error: 'School not found'
      });
    }

    const { name, address, phone, email, website, logo, principal } = req.body;

    if (name !== undefined) school.name = name;
    if (address !== undefined) school.address = address;
    if (phone !== undefined) school.phone = phone;
    if (email !== undefined) school.email = email;
    if (website !== undefined) school.website = website;
    if (logo !== undefined) school.logo = logo;
    if (principal !== undefined) {
      if (typeof principal === 'object') {
        if (principal.name !== undefined) school.principal.name = principal.name;
        if (principal.email !== undefined) school.principal.email = principal.email;
        if (principal.phone !== undefined) school.principal.phone = principal.phone;
      }
    }

    await school.save();

    res.status(200).json({
      success: true,
      message: 'School settings updated successfully',
      data: {
        _id: school._id,
        name: school.name,
        address: school.address,
        phone: school.phone,
        email: school.email,
        website: school.website,
        logo: school.logo,
        principal: school.principal
      }
    });
  } catch (error) {
    console.error('Update school info error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Upload school logo (for settings page)
// @route   POST /api/settings/school-info/logo
// @access  Private (School Admin only)
const uploadSchoolLogo = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'No school associated with this account'
      });
    }

    if (!req.file || !req.file.path) {
      return res.status(400).json({
        success: false,
        error: 'No logo file uploaded'
      });
    }

    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({
        success: false,
        error: 'School not found'
      });
    }

    // Store URL path for frontend (e.g. /uploads/school-logos/logo-xxx.jpg)
    const logoUrl = '/uploads/school-logos/' + path.basename(req.file.path);
    school.logo = logoUrl;
    await school.save();

    // Response shape expected by school portal Settings.tsx (result.data?.logo || result.logo)
    res.status(200).json({
      success: true,
      message: 'Logo uploaded successfully',
      data: { logo: logoUrl },
      logo: logoUrl
    });
  } catch (error) {
    console.error('Upload school logo error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

module.exports = {
  getSchoolInfo,
  updateSchoolInfo,
  uploadSchoolLogo
};
