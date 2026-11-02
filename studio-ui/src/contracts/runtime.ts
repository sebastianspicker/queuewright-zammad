import type { CatalogFeature, FeatureDefinition, StudioProjectV1, StudioProjectV2 } from '.'

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function isV1Project(value: unknown): value is StudioProjectV1 {
  return typeof value === 'object' && value !== null
    && (value as { project_schema_version?: unknown }).project_schema_version === '1.0'
}

export function isV2Project(value: unknown): value is StudioProjectV2 {
  return typeof value === 'object' && value !== null
    && (value as { project_schema_version?: unknown }).project_schema_version === '2.0'
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Shape check for a draft the editor itself saved, so a compiler-rejected one can be opened for fixing. */
export function isEditableV2Draft(value: unknown): value is StudioProjectV2 {
  if (!isV2Project(value)) return false
  const { id, name, workbook, bundle } = value as unknown as Record<string, unknown>
  if (typeof id !== 'string' || typeof name !== 'string' || !isRecord(workbook) || !isRecord(bundle)) return false
  const { manifest } = bundle
  if (!isRecord(workbook.organization) || !isRecord(workbook.capability_decisions)
    || !isRecord(bundle.profile) || !isRecord(bundle.feature_state) || !isRecord(bundle.resource_ownership)
    || !isRecord(manifest) || !isRecord(manifest.object_manager) || !isRecord(manifest.users)) return false
  // Every collection the editor screens and model iterate over.
  const { object_manager: fields, users } = manifest
  const lists = [
    manifest.groups, manifest.roles, manifest.organizations, manifest.tags, manifest.overviews,
    manifest.macros, manifest.checklist_templates, manifest.triggers, manifest.jobs, manifest.report_profiles,
    users.agents, users.customers, fields.ticket_fields, fields.user_fields, fields.organization_fields,
    fields.group_fields, fields.core_workflows,
  ]
  return lists.every(Array.isArray)
    && (manifest.roles as unknown[]).every((role) => isRecord(role) && isRecord(role.acl))
    && Object.values(workbook.capability_decisions).every((decision) => isRecord(decision)
      && typeof decision.enabled === 'boolean' && Array.isArray(decision.dependencies))
}

/** Map a snake_case catalog entry (API response or bundled JSON) to the editor's definition. */
export function featureDefinition(feature: CatalogFeature): FeatureDefinition {
  return {
    id: feature.id, name: feature.name, description: feature.description,
    category: feature.category, dependencies: [...feature.dependencies],
    lockedAssurances: [...feature.locked_assurances], locked: feature.locked,
    defaultEnabled: feature.default_enabled, defaultSettings: cloneJson(feature.settings),
  }
}
