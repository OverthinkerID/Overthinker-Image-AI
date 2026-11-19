import { Router } from 'express';
import { requirePermission } from '../../middleware/tenantContext';
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from './projects.controller';

export const projectsRouter = Router();

projectsRouter.get('/', requirePermission('projects:view'), listProjects);
projectsRouter.post('/', requirePermission('projects:create'), createProject);
projectsRouter.get('/:id', requirePermission('projects:view'), getProject);
projectsRouter.patch('/:id', requirePermission('projects:edit'), updateProject);
projectsRouter.delete('/:id', requirePermission('projects:edit'), deleteProject);
