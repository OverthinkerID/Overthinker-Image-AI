import { Router } from 'express';
import { logoUploadMiddleware } from '../../middleware/upload';
import { listLogos, serveLogoFile, setPrimaryLogo, uploadLogo } from './logos.controller';

export const projectLogosRouter = Router({ mergeParams: true });
projectLogosRouter.get('/', listLogos);
projectLogosRouter.post('/', logoUploadMiddleware.single('file'), uploadLogo);
projectLogosRouter.patch('/:logoId/primary', setPrimaryLogo);

export const logosRouter = Router();
logosRouter.get('/:logoId/file', serveLogoFile);
