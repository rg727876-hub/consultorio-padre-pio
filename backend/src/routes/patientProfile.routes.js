const { Router } = require('express');
const { getProfile, updateProfile, uploadPhotoForSelf } = require('../controllers/patientProfile.controller');
const { patientAuth } = require('../middlewares/patientAuth.middleware');
const { upload } = require('../middlewares/upload.middleware');

const router = Router();

router.get('/me',   patientAuth, getProfile);
router.patch('/me', patientAuth, updateProfile);
router.post('/me/foto', patientAuth, upload.single('foto'), uploadPhotoForSelf);

module.exports = router;
