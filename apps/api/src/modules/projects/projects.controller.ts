import type { NextFunction, Request, Response } from 'express';
import { ProjectsService } from './projects.service';
import { createProjectSchema, updateProjectSchema } from './projects.validation';

const projectsService = new ProjectsService();

export async function listProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const projects = await projectsService.listProjects({
      search,
      status,
      workspaceId: req.auth?.workspaceId,
    });
    res.json({ data: projects });
  } catch (err) {
    next(err);
  }
}

export async function getProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectsService.getProjectById(String(req.params.id), req.auth?.workspaceId);
    res.json({ data: project });
  } catch (err) {
    next(err);
  }
}

export async function createProject(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = createProjectSchema.parse(req.body);
    const project = await projectsService.createProject({
      ...dto,
      workspaceId: req.auth?.workspaceId,
    });
    res.status(201).json({ data: project });
  } catch (err) {
    next(err);
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = updateProjectSchema.parse(req.body);
    const project = await projectsService.updateProject(String(req.params.id), dto, req.auth?.workspaceId);
    res.json({ data: project });
  } catch (err) {
    next(err);
  }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await projectsService.deleteProject(String(req.params.id), req.auth?.workspaceId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
