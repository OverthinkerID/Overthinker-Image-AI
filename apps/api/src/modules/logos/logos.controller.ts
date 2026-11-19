import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { LogosService } from './logos.service';

const logosService = new LogosService();

export async function uploadLogo(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw new AppError(400, 'MISSING_FILE', 'No logo file was uploaded under field "file".');
    }
    const isPrimary =
      req.body?.isPrimary === 'true' || req.body?.isPrimary === true ? true : undefined;

    const logo = await logosService.uploadOriginalLogo({
      projectId: String(req.params.id),
      file: req.file,
      isPrimary,
    });
    res.status(201).json({ data: logo });
  } catch (err) {
    next(err);
  }
}

export async function listLogos(req: Request, res: Response, next: NextFunction) {
  try {
    const logos = await logosService.listProjectLogos(String(req.params.id));
    res.json({ data: logos });
  } catch (err) {
    next(err);
  }
}

export async function setPrimaryLogo(req: Request, res: Response, next: NextFunction) {
  try {
    const logo = await logosService.setPrimaryLogo(String(req.params.id), String(req.params.logoId));
    res.json({ data: logo });
  } catch (err) {
    next(err);
  }
}

export async function serveLogoFile(req: Request, res: Response, next: NextFunction) {
  try {
    const { logo, buffer } = await logosService.getLogoFile(String(req.params.logoId));
    res.setHeader('Content-Type', logo.mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Disposition', `inline; filename="${logo.originalFilename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}
