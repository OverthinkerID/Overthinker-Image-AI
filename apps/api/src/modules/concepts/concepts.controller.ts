import type { NextFunction, Request, Response } from 'express';
import { ConceptsService } from './concepts.service';

const conceptsService = new ConceptsService();

export async function generateConcepts(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json({ data: await conceptsService.generateFourConcepts(String(req.params.id), req.body || {}) }); } catch (err) { next(err); }
}
export async function listConcepts(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await conceptsService.listConcepts(String(req.params.id)) }); } catch (err) { next(err); }
}
export async function regenerateConcept(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await conceptsService.regenerateConcept(String(req.params.id), String(req.params.conceptId), req.body || {}) }); } catch (err) { next(err); }
}
export async function toggleFavoriteConcept(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await conceptsService.toggleFavorite(String(req.params.id), String(req.params.conceptId)) }); } catch (err) { next(err); }
}
export async function approveConcept(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await conceptsService.approveAndLockConcept(String(req.params.id), String(req.params.conceptId)) }); } catch (err) { next(err); }
}
export async function reviseConcept(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await conceptsService.createControlledRevision(String(req.params.id), String(req.params.conceptId), req.body || {}) }); } catch (err) { next(err); }
}
export async function listProjectAiJobs(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await conceptsService.listAiJobs(String(req.params.id)) }); } catch (err) { next(err); }
}
export async function cancelProjectAiJob(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await conceptsService.cancelAiJob(String(req.params.id), String(req.params.jobId)) }); } catch (err) { next(err); }
}
export async function serveConceptAsset(req: Request, res: Response, next: NextFunction) {
  try {
    const { buffer, mimeType } = await conceptsService.readConceptPreviewAsset(String(req.params.projectId), String(req.params.conceptId), String(req.params.filename));
    res.setHeader('Content-Type', mimeType); res.setHeader('Content-Length', buffer.length); res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (err) { next(err); }
}
