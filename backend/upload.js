const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 120000 // NEW: extend Cloudinary upload timeout to 120s
});

// Debug Cloudinary config
// console.log('Cloudinary Config Check:', {
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '✓ Set' : '✗ Missing',
//   api_key: process.env.CLOUDINARY_API_KEY ? '✓ Set' : '✗ Missing',
//   api_secret: process.env.CLOUDINARY_API_SECRET ? '✓ Set' : '✗ Missing'
// });

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    console.log('Processing file:', {
      originalname: file.originalname,
      mimetype: file.mimetype
    });

    // Determine resource type based on file
    let resourceType = 'raw'; // Default to raw for documents
    
    if (file.mimetype.startsWith('image/')) {
      resourceType = 'image';
    } else if (file.mimetype.startsWith('video/')) {
      resourceType = 'video';
    }

    return {
      folder: "tickets/attachments",
      resource_type: resourceType,
      // Only apply format restrictions for images
      allowed_formats: resourceType === 'image' ? 
        ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"] : 
        undefined, // No format restriction for raw files
      // Only apply transformation to images
      transformation: resourceType === 'image' ? 
        [{ width: 1000, height: 1000, crop: "limit", quality: "auto" }] : 
        undefined,
    };
  },
});

const parser = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log('File filter check:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });
    
    // Allow most common file types
    const allowedMimes = [
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
      // Documents
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv', 'application/rtf',
      // Code files
      'text/javascript', 'application/javascript', 'text/html', 'text/css', 'application/json', 'text/xml', 'text/markdown',
      // Archives
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/x-tar', 'application/gzip',
      // Other
      'application/octet-stream' // Generic binary
    ];

    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('text/')) {
      console.log('File accepted:', file.originalname);
      cb(null, true);
    } else {
      console.log('File rejected:', file.originalname, 'Type:', file.mimetype);
      cb(new Error(`File type ${file.mimetype} not supported`), false);
    }
  }
});

module.exports = parser;
