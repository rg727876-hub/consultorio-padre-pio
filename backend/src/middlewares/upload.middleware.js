const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ── Fallback a almacenamiento local (Disco) ──
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

const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        let dest = uploadDirs.avatars;
        if (req.baseUrl.includes('services')) dest = uploadDirs.services;
        if (req.baseUrl.includes('patient')) dest = uploadDirs.patients;
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

let storage = diskStorage;

// ── Cloudinary Storage (Si está configurado) ──
if (process.env.CLOUDINARY_URL) {
    const cloudinary = require('cloudinary').v2;
    const { CloudinaryStorage } = require('multer-storage-cloudinary');
    
    storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: async (req, file) => {
            let folder = 'avatars';
            if (req.baseUrl.includes('services')) folder = 'services';
            if (req.baseUrl.includes('patient')) folder = 'patients';
            
            return {
                folder: `consultorio/${folder}`,
                allowed_formats: ['jpeg', 'jpg', 'png', 'webp'],
                // Se generará un nombre único automáticamente en Cloudinary
            };
        },
    });
}

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter
});

module.exports = { upload };
