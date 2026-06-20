const { Router } = require('express');
const { getProfile, updateProfile } = require('../controllers/patientProfile.controller');
const { patientAuth } = require('../middlewares/patientAuth.middleware');

const router = Router();

router.get('/me',   patientAuth, getProfile);
router.patch('/me', patientAuth, updateProfile);

module.exports = router;
