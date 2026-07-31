import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { UPLOAD_CONFIG } from '../config/constants';

const uploadsDir = path.join(process.cwd(), UPLOAD_CONFIG.UPLOADS_DIR);
const isServerless = !!(process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT);

if (!isServerless && !fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = isServerless
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, UPLOAD_CONFIG.UPLOADS_DIR + '/');
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      },
    });

export const upload = multer({
  storage,
  limits: { fileSize: UPLOAD_CONFIG.MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Only images and PDFs are allowed.'));
    }
  },
});