import { describe, expect, it } from 'vitest'
import { addGroup, mutateProject, permissionFor, removeGroup, setPermission, toggleFeature, renameProject, setTargetSchema, renameGroup, moveGroup, reorderGroup, setRestricted, replaceDecision } from './model'
import { bundledCatalog, staticDemoProject } from '../data'
import { initialState } from './reducer'

function expectDraftShape(project: typeof initialState.project): void {
  expect(Object.keys(project).sort()).toEqual([
    'bundle', 'extensions', 'id', 'name', 'project_schema_version',
    'target_schema_version', 'workbook',
  ])
  expect(project.bundle).toEqual(expect.objectContaining({
    profile: expect.any(Object), manifest: expect.any(Object),
    resource_ownership: expect.any(Object), feature_state: expect.any(Object),
  }))
  expect(project.workbook).toEqual(expect.objectContaining({
    organization: expect.any(Object), capability_decisions: expect.any(Object),
    services: expect.any(Array), policies: expect.any(Object), uat: expect.any(Object),
  }))
}

describe('editor mutation invariants', () => {
  it('creates a unique leaf and removes its dependent resources with it', () => {
    const project = initialState.project
    const added = addGroup(project, 'leaf', 'student_services')
    expect(added.project.project_schema_version).toBe('2.0')
    expect(added.project.bundle.manifest.groups.some((group) => group.key === added.key)).toBe(true)
    expect(added.project.bundle.manifest.users.agents.some((agent) => agent.key === added.key)).toBe(true)
    const removed = removeGroup(added.project, added.key)
    expect(removed.project_schema_version).toBe('2.0')
    expect(removed.bundle.manifest.groups.some((group) => group.key === added.key)).toBe(false)
    expect(removed.bundle.manifest.users.agents.some((agent) => agent.key === added.key)).toBe(false)
  })

  it('keeps V2 metadata while mutating its bundle', () => {
    const project = mutateProject(initialState.project, (draft) => {
      draft.name = 'Renamed configuration'
      draft.workbook.organization.operating_model = 'centralized'
      draft.bundle.manifest.tags.push('queuewright/test')
    })
    expect(project.project_schema_version).toBe('2.0')
    expect(project).not.toHaveProperty('profile')
    expect(project.bundle.profile.display_name).toBe('Renamed configuration')
    expect(project.workbook.organization.operating_model).toBe('centralized')
    expect(project.bundle.manifest.tags).toContain('queuewright/test')
  })

  it('gives each new service a unique group and role name', () => {
    const once = addGroup(initialState.project, 'leaf').project
    const twice = addGroup(once, 'leaf').project
    for (const names of [twice.bundle.manifest.groups.map((g) => g.name.toLowerCase()), twice.bundle.manifest.roles.map((r) => r.name.toLowerCase())]) {
      expect(new Set(names).size).toBe(names.length)
    }
  })

  it('removes resources of a feature switched on and off before the next compile', () => {
    for (const [feature, collection, key] of [
      ['scheduled_reviews', 'jobs', 'weekly_review'],
      ['sensitive_area_handling', 'triggers', 'mark_sensitive'],
      ['cross_department_handoff', 'triggers', 'record_handoff'],
    ] as const) {
      const off = toggleFeature(initialState.project, feature, false, bundledCatalog)
      const flipped = toggleFeature(toggleFeature(off, feature, true, bundledCatalog), feature, false, bundledCatalog)
      expect(flipped.bundle.manifest[collection].map((item) => item.key)).not.toContain(key)
      expect(flipped.bundle.manifest.tags).toEqual(off.bundle.manifest.tags)
    }
  })

  it('keeps canonical-shaped drafts through bundle, feature, governance, and access edits', () => {
    const source = initialState.project
    const bundleEdited = addGroup(source, 'leaf', 'student_services').project
    const featureEdited = toggleFeature(bundleEdited, 'scheduled_reviews', true, bundledCatalog)
    const governanceEdited = replaceDecision(featureEdited, 'service-topology', { completion: 'ready' })
    const accessEdited = setPermission(governanceEdited, 'student_services', 'student_services', 'read')

    expectDraftShape(accessEdited)
    expect(accessEdited.bundle.manifest.groups.length).toBeGreaterThan(source.bundle.manifest.groups.length)
    expect(accessEdited.bundle.feature_state.scheduled_reviews.enabled).toBe(true)
    expect(accessEdited.workbook.capability_decisions['service-topology']?.completion).toBe('ready')
    expect(accessEdited.bundle.manifest.roles.find((role) => role.key === 'student_services')?.acl.read).toContain('student_services')
    expect(accessEdited.workbook.services).toEqual(source.workbook.services)
    expect(accessEdited.workbook.policies).toEqual(source.workbook.policies)
    expect(accessEdited.workbook.uat).toEqual(source.workbook.uat)
  })
})

describe('structural sharing', () => {
  it('copies only the edited ACL role and preserves unrelated resources and workbook', () => {
    const source = initialState.project
    const before = JSON.stringify(source)
    const role = source.bundle.manifest.roles[0]!
    const updated = setPermission(source, role.key, 'student_services', 'read')
    expect(JSON.stringify(source)).toBe(before)
    expect(updated.workbook).toBe(source.workbook)
    expect(updated.bundle.profile).toBe(source.bundle.profile)
    expect(updated.bundle.manifest.groups).toBe(source.bundle.manifest.groups)
    expect(updated.bundle.manifest.roles[0]).not.toBe(role)
    expect(updated.bundle.manifest.roles[1]).toBe(source.bundle.manifest.roles[1])
  })
})


it('keeps optimized metadata and group edits equivalent to finalized mutation callbacks', () => {
  const source = initialState.project
  const before = JSON.stringify(source)
  const renamed = renameProject(source, 'New name')
  expect(renamed).toEqual(mutateProject(source, (draft) => { draft.name = 'New name' }))
  expect(renamed.bundle.manifest).toBe(source.bundle.manifest)
  expect(renamed.bundle.profile.presentation).toBe(source.bundle.profile.presentation)
  expect(setTargetSchema(source, '1.0')).toEqual(mutateProject(source, (draft) => { draft.target_schema_version = '1.0' }))
  const leaf = source.bundle.manifest.groups.find((group) => group.kind === 'leaf')!
  expect(setRestricted(source, leaf.key, true)).toEqual(mutateProject(source, (draft) => {
    draft.bundle.manifest.groups.find((group) => group.key === leaf.key)!.restricted = true
  }))
  expect(renameGroup(source, leaf.key, 'New service')).toEqual(mutateProject(source, (draft) => {
    draft.bundle.manifest.groups.find((group) => group.key === leaf.key)!.name = `${source.bundle.manifest.managed_prefix} New service`
    const role = draft.bundle.manifest.roles.find((item) => item.key === leaf.key)
    if (role) role.name = `${source.bundle.manifest.managed_prefix} Role · New service`
  }))
  expect(moveGroup(source, 'missing', 'missing')).toBe(source)
  expect(reorderGroup(source, leaf.key, leaf.key)).toBe(source)
  expect(JSON.stringify(source)).toBe(before)
})

describe('access matrix keeps every role usable', () => {
  it('refuses to remove the last service a role can access', async () => {
    const { isLastGroupAccess } = await import('./model')
    const project = staticDemoProject('blank')
    const role = project.bundle.manifest.roles[0]!
    const groups = [...new Set(Object.values(role.acl).flat())]
    expect(groups).toHaveLength(1)
    expect(isLastGroupAccess(role, groups[0]!)).toBe(true)
    const edited = setPermission(project, role.key, groups[0]!, 'none')
    expect(edited.bundle.manifest.roles[0]!.acl).toEqual(role.acl)
    // Changing the level on that last service is still allowed.
    expect(setPermission(project, role.key, groups[0]!, 'read').bundle.manifest.roles[0]!.acl).toEqual({ read: groups })
  })

  it('still removes a service from a role that keeps another one', async () => {
    const { isLastGroupAccess } = await import('./model')
    const blank = staticDemoProject('blank')
    const source = blank.bundle.manifest.roles[0]!
    const group = Object.values(source.acl).flat()[0]!
    const added = addGroup(blank, 'leaf', 'service')
    const project = setPermission(added.project, source.key, added.key, 'read')
    const role = project.bundle.manifest.roles.find((item) => item.key === source.key)!
    expect(isLastGroupAccess(role, group)).toBe(false)
    const edited = setPermission(project, role.key, group, 'none')
    expect(Object.values(edited.bundle.manifest.roles.find((item) => item.key === role.key)!.acl).flat()).not.toContain(group)
  })
})

describe('Access matrix permission display', () => {
  it('shows every ACL key that grants a group, including change and overview, as access', () => {
    expect(permissionFor({ key: 'r', name: 'R', acl: { change: ['it'] } } as never, 'it')).toBe('read')
    expect(permissionFor({ key: 'r', name: 'R', acl: { overview: ['it'] } } as never, 'it')).toBe('read')
    expect(permissionFor({ key: 'r', name: 'R', acl: { full: ['it'], overview: ['it'] } } as never, 'it')).toBe('work')
    expect(permissionFor({ key: 'r', name: 'R', acl: { change: ['hr'] } } as never, 'it')).toBe('none')
  })
})
