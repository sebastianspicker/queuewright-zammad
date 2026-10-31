import type {
  CapabilityDecision,
  StudioProjectV2,
} from '../../contracts'

function copiedDecisions(
  project: StudioProjectV2,
): Map<string, CapabilityDecision> {
  return new Map(
    Object.entries(project.workbook.capability_decisions).map(([key, decision]) => [
      key,
      { ...decision },
    ]),
  )
}

function decisionFor(
  decisions: ReadonlyMap<string, CapabilityDecision>,
  capabilityId: string,
): CapabilityDecision | undefined {
  return decisions.get(capabilityId)
}

function disableDecision(
  decisions: Map<string, CapabilityDecision>,
  capabilityId: string,
): void {
  const decision = decisionFor(decisions, capabilityId)
  if (!decision) return
  decision.enabled = false
  decision.completion = decision.delivery === 'unsupported' ? 'blocked' : 'decision_required'
  for (const [dependentId, dependent] of decisions) {
    if (dependent.dependencies.includes(capabilityId)) {
      disableDecision(decisions, dependentId)
    }
  }
}

function enableDecision(
  decisions: Map<string, CapabilityDecision>,
  capabilityId: string,
): void {
  const decision = decisionFor(decisions, capabilityId)
  if (!decision) return
  decision.enabled = true
  for (const dependency of decision.dependencies) {
    enableDecision(decisions, dependency)
  }
  if (decision.delivery === 'unsupported') decision.completion = 'blocked'
}

/**
 * Capabilities the current design cannot exclude, mirroring the compiler's graph rules:
 * every planned resource needs its capability, and an enabled capability needs its dependencies.
 */
export function requiredCapabilities(project: StudioProjectV2): Set<string> {
  const { manifest } = project.bundle
  const fields = manifest.object_manager
  const used = new Map<string, boolean>([
    ['service-topology', manifest.groups.length > 0],
    ['organizations-customers', manifest.organizations.length > 0],
    ['roles-acl', manifest.roles.length > 0],
    ['tags', manifest.tags.length > 0],
    ['fields-core-workflows', [fields.ticket_fields, fields.user_fields, fields.organization_fields,
      fields.group_fields, fields.core_workflows].some((items) => items.length > 0)],
    ['uat-evidence', manifest.users.agents.length + manifest.users.customers.length > 0],
    ['overviews-macros-templates-text-modules-checklists',
      manifest.overviews.length + manifest.macros.length + manifest.checklist_templates.length > 0],
    ['triggers-schedulers-report-profiles',
      manifest.triggers.length + manifest.jobs.length + manifest.report_profiles.length > 0],
  ])
  const decisions = copiedDecisions(project)
  const required = new Set<string>()
  const require = (id: string) => {
    const decision = decisionFor(decisions, id)
    if (!decision || required.has(id)) return
    required.add(id)
    for (const dependency of decision.dependencies) require(dependency)
  }
  for (const [id, inUse] of used) if (inUse) require(id)
  return required
}

export function replaceDecision(
  project: StudioProjectV2,
  id: string,
  patch: Partial<Pick<CapabilityDecision, 'enabled' | 'completion'>>,
): StudioProjectV2 {
  const source = project.workbook.capability_decisions
  if (!Object.hasOwn(source, id)) return project
  const decisions = copiedDecisions(project)
  const updatedTarget = decisionFor(decisions, id)
  // Excluding a capability the design still uses would only produce a rejected draft.
  if (patch.enabled === false && requiredCapabilities(project).has(id)) patch = { ...patch, enabled: undefined }
  if (patch.enabled !== undefined) {
    if (patch.enabled) enableDecision(decisions, id)
    else disableDecision(decisions, id)
  }
  if (patch.completion !== undefined && updatedTarget) {
    updatedTarget.completion = patch.completion
  }
  return {
    ...project,
    workbook: {
      ...project.workbook,
      capability_decisions: Object.fromEntries(decisions),
    },
  }
}

export function replaceOrganizationValue(
  project: StudioProjectV2,
  key: string,
  value: string,
): StudioProjectV2 {
  return {
    ...project,
    workbook: {
      ...project.workbook,
      organization: {
        ...project.workbook.organization,
        [key]: value,
      },
    },
  }
}
