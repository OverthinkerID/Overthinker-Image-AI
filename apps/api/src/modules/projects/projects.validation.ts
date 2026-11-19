import { z } from 'zod';

export const PROJECT_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(120),
  description: z.string().trim().max(1000).optional(),
  industry: z.string().trim().max(100).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name cannot be empty').max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  industry: z.string().trim().max(100).nullable().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
});

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
