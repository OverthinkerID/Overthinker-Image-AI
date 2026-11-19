export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface LogoAsset {
  id: string; projectId: string; originalFilename: string; storedFilename: string; storagePath: string;
  mimeType: string; fileSize: number; sha256: string; width: number | null; height: number | null;
  isOriginal: boolean; isPrimary: boolean; createdAt: string;
}

export interface Project {
  id: string; name: string; slug: string; description: string | null; industry: string | null;
  status: ProjectStatus; createdAt: string; updatedAt: string; logos: LogoAsset[];
}

export interface BrandAnalysis {
  id: string; projectId: string; logoId: string; format: string; width: number; height: number;
  aspectRatio: string; aspectLabel: string; hasTransparency: boolean; transparencyRatio: number;
  backgroundType: string; backgroundHex: string | null; isMonochrome: boolean; colorCount: number;
  shapeStyle: string; visualElementsJson: string; extractedText: string | null; hasText: boolean;
  ocrConfidence: number; createdAt: string;
}

export interface BrandColor {
  id: string; brandDnaId: string;
  role: 'PRIMARY' | 'SECONDARY' | 'ACCENT' | 'NEUTRAL_LIGHT' | 'NEUTRAL_DARK' | 'BG_LIGHT' | 'BG_DARK';
  name: string | null; hex: string; rgb: string; hsl: string; dominance: number; isEdited: boolean; sortOrder: number;
}

export interface BrandTypography {
  id: string; brandDnaId: string; extractedText: string | null; detectedStyle: string;
  identificationConfidence: number; confidenceNote: string; headingFont: string; bodyFont: string;
  headingFallback: string; bodyFallback: string; isManualOverride: boolean; recommendationsJson: string;
}

export interface BrandPersonality {
  id: string; brandDnaId: string; personalityTraitsJson: string; visualStyle: string; targetAudience: string;
  industry: string; brandPositioning: string; brandTone: string; designRecommendationsJson: string;
  providerType: string; modelName: string | null; isEdited: boolean;
}

export interface BrandDna {
  id: string; projectId: string; analysisId: string | null; version: number; brandName: string;
  industry: string | null; brandDescription: string | null; logoCharacteristicsJson: string;
  visualDirection: string | null; designRulesJson: string; status: 'DRAFT' | 'APPROVED' | 'SUPERSEDED';
  isApproved: boolean; approvedAt: string | null; createdAt: string; updatedAt: string;
  colors: BrandColor[]; typography: BrandTypography | null; personality: BrandPersonality | null; analysis: BrandAnalysis | null;
}

export interface AiProviderConfig {
  id: string; name: string; mode: 'LOCAL_ONLY' | 'CLOUD_ONLY' | 'HYBRID'; providerType: string;
  baseUrl: string | null; defaultModel: string | null; hasApiKey: boolean; settings: Record<string, unknown>;
  isActive: boolean; healthStatus: 'UNKNOWN' | 'HEALTHY' | 'UNREACHABLE'; lastCheckedAt: string | null;
}

export interface ComfyWorkflowTemplate { id: string; name: string; category: string; version: string; description: string | null; isDefault: boolean; }
export interface ConceptRevision { id: string; conceptId: string; version: number; conceptName: string; description: string; visualDirection: string; revisionNote: string | null; createdAt: string; }

export interface BrandConcept {
  id: string; projectId: string; brandDnaId: string;
  categoryKey: 'ORIGINAL_EVOLUTION' | 'PREMIUM_LUXURY' | 'MODERN_MINIMALIST' | 'CREATIVE_FUTURISTIC';
  conceptName: string; description: string; visualDirection: string; moodboardJson: string;
  colorPaletteJson: string; typographyJson: string; logoApplicationDirection: string; graphicElementsJson: string;
  mockupPreviewsJson: string; promptUsed: string; isFavorite: boolean; isPrimary: boolean;
  isApproved: boolean; isLocked: boolean; approvedAt: string | null; currentVersion: number; createdAt: string;
  revisions: ConceptRevision[];
}

export interface AiJob {
  id: string; projectId: string; jobType: string; status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number; provider: string; model: string | null; prompt: string; workflowVersion: string | null;
  errorMessage: string | null; createdAt: string; completedAt: string | null;
}

export interface LogoVariation { id: string; projectId: string; parentLogoId: string | null; conceptId: string | null; variationType: string; name: string; format: string; storagePath: string; svgContent: string | null; width: number; height: number; version: number; isEdited: boolean; createdAt: string; }
export interface ColorSystem { id: string; projectId: string; name: string; version: number; palettesJson: string; contrastJson: string; isActive: boolean; createdAt: string; }
export interface TypographySystem { id: string; projectId: string; name: string; version: number; rolesJson: string; customFontsJson: string; isActive: boolean; createdAt: string; }
export interface GraphicElement { id: string; projectId: string; elementType: string; name: string; format: string; storagePath: string; svgContent: string | null; version: number; createdAt: string; }
export interface DesignTemplate { id: string; projectId: string | null; category: string; templateKey: string; name: string; width: number; height: number; canvasJson: string; isCustom: boolean; }
export interface DesignVersion { id: string; documentId: string; version: number; canvasJson: string; changeNote: string | null; createdAt: string; }
export interface DesignDocument { id: string; projectId: string; conceptId: string | null; templateId: string | null; title: string; category: string; width: number; height: number; canvasJson: string; currentVersion: number; versions: DesignVersion[]; updatedAt: string; }
export interface BrandAsset { id: string; projectId: string; conceptId: string | null; name: string; category: string; assetType: string; storagePath: string; mimeType: string; version: number; aiProvider: string; status: string; createdAt: string; }
export interface MockupTemplate { id: string; category: string; templateKey: string; name: string; description: string | null; width: number; height: number; capabilitiesJson: string; isFavorite: boolean; }
export interface MockupDocument { id: string; projectId: string; templateId: string | null; title: string; category: string; width: number; height: number; sceneConfigJson: string; renderedPath: string | null; currentVersion: number; template?: MockupTemplate | null; versions: Array<{ id: string; version: number; changeNote: string | null; createdAt: string }>; }
export interface MockupRenderJob { id: string; projectId: string; provider: string; prompt: string; status: string; progress: number; outputPath: string | null; createdAt: string; }
export interface GuidelineSection { id: string; sectionKey: string; title: string; orderIndex: number; content: string; layoutType: string; isPlaceholder: boolean; }
export interface BrandGuideline { id: string; projectId: string; title: string; currentVersion: number; sections: GuidelineSection[]; versions: Array<{ id: string; version: number; changeNote: string | null; createdAt: string }>; }
export interface PresentationSlide { id: string; slideType: string; title: string; subtitle: string | null; body: string; layout: string; orderIndex: number; }
export interface BrandPresentation { id: string; projectId: string; title: string; aspectRatio: string; currentVersion: number; slides: PresentationSlide[]; versions: Array<{ id: string; version: number; changeNote: string | null; createdAt: string }>; }

export interface CreateProjectPayload { name: string; description?: string; industry?: string; status?: ProjectStatus; }
export interface UpdateProjectPayload { name?: string; description?: string | null; industry?: string | null; status?: ProjectStatus; }

export const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api/v1';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  if (typeof window !== 'undefined') {
    const wsId = window.localStorage.getItem('bf_active_workspace');
    if (wsId && !headers.has('x-workspace-id')) headers.set('x-workspace-id', wsId);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include', cache: 'no-store' });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error?.message || `Request failed with status ${res.status}`);
  return payload.data as T;
}

export function getLogoFileUrl(logoId: string): string { return `${API_BASE}/logos/${encodeURIComponent(logoId)}/file`; }
export function getConceptAssetUrl(storagePath: string): string {
  const parts = storagePath.split('/');
  if (parts.length >= 5 && parts[0] === 'projects' && parts[2] === 'concepts') {
    return `${API_BASE}/concept-assets/${encodeURIComponent(parts[1])}/${encodeURIComponent(parts[3])}/${encodeURIComponent(parts[4])}`;
  }
  return '';
}
export function getBrandAssetFileUrl(projectId: string, assetId: string): string {
  return `${API_BASE}/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/file`;
}
export function getMockupRenderUrl(projectId: string, mockupId: string, version?: number): string {
  return `${API_BASE}/projects/${encodeURIComponent(projectId)}/mockups/${encodeURIComponent(mockupId)}/render${version ? `?v=${version}` : ''}`;
}

export const api = {
  listProjects(params?: { search?: string; status?: string }): Promise<Project[]> {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.status && params.status !== 'ALL') qs.set('status', params.status);
    return request<Project[]>(`/projects${qs.toString() ? `?${qs.toString()}` : ''}`);
  },
  getProject: (id: string) => request<Project>(`/projects/${encodeURIComponent(id)}`),
  createProject: (data: CreateProjectPayload) => request<Project>('/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  updateProject: (id: string, data: UpdateProjectPayload) => request<Project>(`/projects/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteProject: (id: string) => request<{ deleted: boolean; id: string }>(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  uploadLogo(projectId: string, file: File, isPrimary = true): Promise<LogoAsset> {
    const formData = new FormData(); formData.append('file', file); formData.append('isPrimary', String(isPrimary));
    return request<LogoAsset>(`/projects/${encodeURIComponent(projectId)}/logos`, { method: 'POST', body: formData });
  },
  setPrimaryLogo: (projectId: string, logoId: string) => request<LogoAsset>(`/projects/${encodeURIComponent(projectId)}/logos/${encodeURIComponent(logoId)}/primary`, { method: 'PATCH' }),
  analyzeLogo: (projectId: string, payload?: { logoId?: string; provider?: string }) => request<{ analysis: BrandAnalysis; brandDna: BrandDna }>(`/projects/${encodeURIComponent(projectId)}/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) }),
  getBrandDnaVersions: (projectId: string) => request<{ versions: BrandDna[]; latestAnalysis: BrandAnalysis | null }>(`/projects/${encodeURIComponent(projectId)}/brand-dna`),
  updateBrandDna: (projectId: string, dnaId: string, payload: Record<string, unknown>) => request<BrandDna>(`/projects/${encodeURIComponent(projectId)}/brand-dna/${encodeURIComponent(dnaId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  approveBrandDna: (projectId: string, dnaId: string) => request<BrandDna>(`/projects/${encodeURIComponent(projectId)}/brand-dna/${encodeURIComponent(dnaId)}/approve`, { method: 'POST' }),
  listAiProviders: () => request<AiProviderConfig[]>('/ai/providers'),
  testAiProvider: (providerType: string) => request<{ providerType: string; ok: boolean; latencyMs: number; message: string }>(`/ai/providers/${encodeURIComponent(providerType)}/test`, { method: 'POST' }),
  listWorkflows: () => request<ComfyWorkflowTemplate[]>('/ai/workflows'),
  listConcepts: (projectId: string) => request<BrandConcept[]>(`/projects/${encodeURIComponent(projectId)}/concepts`),
  generateConcepts: (projectId: string, payload: Record<string, unknown>) => request<{ concepts: BrandConcept[]; job: AiJob }>(`/projects/${encodeURIComponent(projectId)}/concepts/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  regenerateConcept: (projectId: string, conceptId: string, payload?: Record<string, unknown>) => request<BrandConcept>(`/projects/${encodeURIComponent(projectId)}/concepts/${encodeURIComponent(conceptId)}/regenerate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) }),
  toggleFavoriteConcept: (projectId: string, conceptId: string) => request<BrandConcept>(`/projects/${encodeURIComponent(projectId)}/concepts/${encodeURIComponent(conceptId)}/favorite`, { method: 'PATCH' }),
  approveConcept: (projectId: string, conceptId: string) => request<BrandConcept>(`/projects/${encodeURIComponent(projectId)}/concepts/${encodeURIComponent(conceptId)}/approve`, { method: 'POST' }),
  listAiJobs: (projectId: string) => request<AiJob[]>(`/projects/${encodeURIComponent(projectId)}/jobs`),
  cancelAiJob: (projectId: string, jobId: string) => request<AiJob>(`/projects/${encodeURIComponent(projectId)}/jobs/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' }),
  listLogoVariations: (projectId: string) => request<LogoVariation[]>(`/projects/${encodeURIComponent(projectId)}/logo-variations`),
  generateLogoVariations: (projectId: string, payload?: { conceptId?: string; types?: string[] }) => request<LogoVariation[]>(`/projects/${encodeURIComponent(projectId)}/logo-variations/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) }),
  listColorSystems: (projectId: string) => request<ColorSystem[]>(`/projects/${encodeURIComponent(projectId)}/color-systems`),
  generateColorSystem: (projectId: string, conceptId?: string) => request<ColorSystem>(`/projects/${encodeURIComponent(projectId)}/color-systems/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conceptId }) }),
  saveColorSystem: (projectId: string, palettes: Record<string, unknown>) => request<ColorSystem>(`/projects/${encodeURIComponent(projectId)}/color-systems`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ palettes }) }),
  listTypographySystems: (projectId: string) => request<TypographySystem[]>(`/projects/${encodeURIComponent(projectId)}/typography-systems`),
  generateTypographySystem: (projectId: string, conceptId?: string) => request<TypographySystem>(`/projects/${encodeURIComponent(projectId)}/typography-systems/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conceptId }) }),
  saveTypographySystem: (projectId: string, roles: Record<string, unknown>) => request<TypographySystem>(`/projects/${encodeURIComponent(projectId)}/typography-systems`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roles }) }),
  listGraphicElements: (projectId: string) => request<GraphicElement[]>(`/projects/${encodeURIComponent(projectId)}/graphic-elements`),
  generateGraphicElements: (projectId: string, format: 'SVG' | 'PNG' = 'SVG') => request<GraphicElement[]>(`/projects/${encodeURIComponent(projectId)}/graphic-elements/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format }) }),
  listTemplates: (projectId: string, category?: string) => request<DesignTemplate[]>(`/projects/${encodeURIComponent(projectId)}/templates${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  instantiateTemplate: (projectId: string, templateId: string, payload?: Record<string, unknown>) => request<DesignDocument>(`/projects/${encodeURIComponent(projectId)}/templates/${encodeURIComponent(templateId)}/instantiate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) }),
  listDocuments: (projectId: string) => request<DesignDocument[]>(`/projects/${encodeURIComponent(projectId)}/documents`),
  saveDocumentVersion: (projectId: string, documentId: string, payload: { title?: string; canvasJson: string; changeNote?: string }) => request<DesignDocument>(`/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  restoreDocumentVersion: (projectId: string, documentId: string, version: number) => request<DesignDocument>(`/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/versions/${version}/restore`, { method: 'POST' }),
  listAssets: (projectId: string, params?: { search?: string; category?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.category && params.category !== 'ALL') qs.set('category', params.category);
    return request<BrandAsset[]>(`/projects/${encodeURIComponent(projectId)}/assets${qs.toString() ? `?${qs.toString()}` : ''}`);
  },
  renameAsset: (projectId: string, assetId: string, name: string) => request<BrandAsset>(`/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }),
  duplicateAsset: (projectId: string, assetId: string) => request<BrandAsset>(`/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/duplicate`, { method: 'POST' }),
  deleteAsset: (projectId: string, assetId: string) => request<{ deleted: boolean; id: string }>(`/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`, { method: 'DELETE' }),
  listMockupTemplates: (projectId: string, params?: { category?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category && params.category !== 'ALL') qs.set('category', params.category);
    if (params?.search) qs.set('search', params.search);
    return request<MockupTemplate[]>(`/projects/${encodeURIComponent(projectId)}/mockup-templates${qs.toString() ? `?${qs.toString()}` : ''}`);
  },
  toggleMockupTemplateFavorite: (projectId: string, templateId: string) => request<MockupTemplate>(`/projects/${encodeURIComponent(projectId)}/mockup-templates/${encodeURIComponent(templateId)}/favorite`, { method: 'PATCH' }),
  listMockups: (projectId: string) => request<MockupDocument[]>(`/projects/${encodeURIComponent(projectId)}/mockups`),
  createMockup: (projectId: string, payload: Record<string, unknown>) => request<MockupDocument>(`/projects/${encodeURIComponent(projectId)}/mockups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  updateMockup: (projectId: string, mockupId: string, payload: Record<string, unknown>) => request<MockupDocument>(`/projects/${encodeURIComponent(projectId)}/mockups/${encodeURIComponent(mockupId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  generateAiMockup: (projectId: string, payload: Record<string, unknown>) => request<MockupRenderJob>(`/projects/${encodeURIComponent(projectId)}/mockups/ai-generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  listAiMockupJobs: (projectId: string) => request<MockupRenderJob[]>(`/projects/${encodeURIComponent(projectId)}/mockups/ai-jobs`),
  listGuidelines: (projectId: string) => request<BrandGuideline[]>(`/projects/${encodeURIComponent(projectId)}/guidelines`),
  generateGuidelines: (projectId: string, conceptId?: string) => request<BrandGuideline>(`/projects/${encodeURIComponent(projectId)}/guidelines/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conceptId }) }),
  updateGuidelineSection: (projectId: string, guidelineId: string, sectionId: string, payload: Record<string, unknown>) => request<BrandGuideline>(`/projects/${encodeURIComponent(projectId)}/guidelines/${encodeURIComponent(guidelineId)}/sections/${encodeURIComponent(sectionId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  listPresentations: (projectId: string) => request<BrandPresentation[]>(`/projects/${encodeURIComponent(projectId)}/presentations`),
  generatePresentation: (projectId: string, conceptId?: string) => request<BrandPresentation>(`/projects/${encodeURIComponent(projectId)}/presentations/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conceptId }) }),
  updatePresentationSlide: (projectId: string, presentationId: string, slideId: string, payload: Record<string, unknown>) => request<BrandPresentation>(`/projects/${encodeURIComponent(projectId)}/presentations/${encodeURIComponent(presentationId)}/slides/${encodeURIComponent(slideId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  addPresentationSlide: (projectId: string, presentationId: string, payload: Record<string, unknown>) => request<BrandPresentation>(`/projects/${encodeURIComponent(projectId)}/presentations/${encodeURIComponent(presentationId)}/slides`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  deletePresentationSlide: (projectId: string, presentationId: string, slideId: string) => request<BrandPresentation>(`/projects/${encodeURIComponent(projectId)}/presentations/${encodeURIComponent(presentationId)}/slides/${encodeURIComponent(slideId)}`, { method: 'DELETE' }),
};
