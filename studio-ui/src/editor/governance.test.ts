import { describe, expect, it } from 'vitest'
import { replaceDecision, requiredCapabilities } from './model'
import { staticDemoProject } from '../data'

const enabled = (project: ReturnType<typeof staticDemoProject>, id: string) =>
  project.workbook.capability_decisions[id]?.enabled

describe('governance decisions the design depends on', () => {
  it('derives the capabilities the planned resources need, with their dependencies', () => {
    const required = requiredCapabilities(staticDemoProject())
    for (const id of ['organization', 'service-topology', 'roles-acl', 'tags', 'fields-core-workflows', 'uat-evidence',
      'overviews-macros-templates-text-modules-checklists', 'triggers-schedulers-report-profiles', 'organizations-customers']) {
      expect(required.has(id), id).toBe(true)
    }
    for (const id of ['identity-security', 'knowledge-base', 'calendars-sla', 'time-accounting', 'platform-dr']) {
      expect(required.has(id), id).toBe(false)
    }
  })

  it('refuses to exclude a capability that planned resources need', () => {
    const project = staticDemoProject()
    for (const id of ['fields-core-workflows', 'organization', 'uat-evidence']) {
      const edited = replaceDecision(project, id, { enabled: false })
      expect(edited.workbook.capability_decisions).toEqual(project.workbook.capability_decisions)
    }
  })

  it('still applies completion changes to a required capability', () => {
    const edited = replaceDecision(staticDemoProject(), 'fields-core-workflows', { enabled: false, completion: 'blocked' })
    expect(edited.workbook.capability_decisions['fields-core-workflows']).toMatchObject({ enabled: true, completion: 'blocked' })
  })

  it('excludes an unused capability with its unused dependents and re-includes it', () => {
    const project = staticDemoProject()
    const excluded = replaceDecision(project, 'identity-security', { enabled: false })
    expect(enabled(excluded, 'identity-security')).toBe(false)
    expect(enabled(excluded, 'privacy-retention')).toBe(false)
    expect(enabled(excluded, 'fields-core-workflows')).toBe(true)
    expect(enabled(replaceDecision(excluded, 'identity-security', { enabled: true }), 'identity-security')).toBe(true)
  })

  it('lets a required capability that is currently excluded be included again', () => {
    const project = staticDemoProject()
    const decisions = project.workbook.capability_decisions
    const broken = { ...project, workbook: { ...project.workbook, capability_decisions: {
      ...decisions, 'fields-core-workflows': { ...decisions['fields-core-workflows']!, enabled: false },
    } } }
    expect(enabled(replaceDecision(broken, 'fields-core-workflows', { enabled: true }), 'fields-core-workflows')).toBe(true)
  })
})
