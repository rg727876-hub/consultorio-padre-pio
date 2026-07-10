const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Asegurar que existan los directorios
const uploadDirs = {
    avatars: path.join(__dirname, '../../uploads/avatars'),
    services: path.join(__dirname, '../../uploads/services'),
    patients: path.join(__dirname, '../../uploads/patients'),
};

Object.values(uploadDirs).forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let dest = uploadDirs.avatars; // default
        if (req.baseUrl.includes('services')) dest = uploadDirs.services;
        if (req.baseUrl.includes('patient')) dest = uploadDirs.patients; // Matches both /patient and /patients
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Formato de archivo no soportado. Solo JPG, PNG y WEBP.'), false);
    }
};

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter
});

module.exports = { upload };
