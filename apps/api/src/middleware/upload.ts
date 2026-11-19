import multer from 'multer';
import { env } from '../config/appConfig';
import { ALLOWED_LOGO_MIME_TYPES } from '../services/storage.service';
import { AppError } from './errorHandler';

export const logoUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxLogoFileSizeBytes,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_LOGO_MIME_TYPES[file.mimetype]) {
      cb(
        new AppError(
          400,
          'UNSUPPORTED_FILE_TYPE',
          `Unsupported file type "${file.mimetype}". Allowed: PNG, SVG, WebP, JPEG.`
        )
      );
      return;
    }
    cb(null, true);
  },
});
