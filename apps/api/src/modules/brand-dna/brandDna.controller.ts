import type { NextFunction, Request, Response } from 'express';
import { BrandDnaService } from './brandDna.service';
import { analyzeProjectLogoSchema, updateBrandDnaSchema } from './brandDna.validation';

const brandDnaService = new BrandDnaService();

export async function analyzeProjectLogo(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = analyzeProjectLogoSchema.parse(req.body || {});
    res.status(201).json({ data: await brandDnaService.analyzeAndBuildBrandDna(String(req.params.id), dto) });
  } catch (err) { next(err); }
}

export async function getProjectBrandDna(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await brandDnaService.getProjectBrandDnas(String(req.params.id)) });
  } catch (err) { next(err); }
}

export async function updateBrandDna(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = updateBrandDnaSchema.parse(req.body);
    res.json({ data: await brandDnaService.updateBrandDna(String(req.params.id), String(req.params.dnaId), dto) });
  } catch (err) { next(err); }
}

export async function approveBrandDna(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await brandDnaService.approveBrandDna(String(req.params.id), String(req.params.dnaId)) });
  } catch (err) { next(err); }
}
