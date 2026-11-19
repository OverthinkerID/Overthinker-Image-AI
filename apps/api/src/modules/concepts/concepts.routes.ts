import { Router } from 'express';
import { approveConcept, cancelProjectAiJob, generateConcepts, listConcepts, listProjectAiJobs, regenerateConcept, reviseConcept, serveConceptAsset, toggleFavoriteConcept } from './concepts.controller';

export const projectConceptsRouter = Router({ mergeParams: true });
projectConceptsRouter.get('/concepts', listConcepts);
projectConceptsRouter.post('/concepts/generate', generateConcepts);
projectConceptsRouter.post('/concepts/:conceptId/regenerate', regenerateConcept);
projectConceptsRouter.patch('/concepts/:conceptId/favorite', toggleFavoriteConcept);
projectConceptsRouter.post('/concepts/:conceptId/approve', approveConcept);
projectConceptsRouter.post('/concepts/:conceptId/revisions', reviseConcept);
projectConceptsRouter.get('/jobs', listProjectAiJobs);
projectConceptsRouter.post('/jobs/:jobId/cancel', cancelProjectAiJob);

export const conceptAssetsRouter = Router();
conceptAssetsRouter.get('/:projectId/:conceptId/:filename', serveConceptAsset);
