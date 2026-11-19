import { Router } from 'express';
import { analyzeProjectLogo, approveBrandDna, getProjectBrandDna, updateBrandDna } from './brandDna.controller';

export const brandDnaRouter = Router({ mergeParams: true });
brandDnaRouter.post('/analyze', analyzeProjectLogo);
brandDnaRouter.get('/brand-dna', getProjectBrandDna);
brandDnaRouter.patch('/brand-dna/:dnaId', updateBrandDna);
brandDnaRouter.post('/brand-dna/:dnaId/approve', approveBrandDna);
