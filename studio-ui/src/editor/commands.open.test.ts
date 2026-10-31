import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ compile: vi.fn(), loadDraft: vi.fn() }))
vi.mock('../api/client', async (importOriginal) => ({ ...await importOriginal<typeof import('../api/client')>(), api: { compile: mocks.compile } }))
vi.mock('../persistence/drafts', () => ({ loadDraft: mocks.loadDraft }))

import { StudioApiError } from '../api/client'
import { staticDemoProject } from '../data'
import { openStoredProject } from './commands'

const rejection = () => new StudioApiError(422, { code: 'invalid_project', path: 'project', message: 'graph rejected' })

describe('opening a stored library project', () => {
  beforeEach(() => { mocks.compile.mockReset(); mocks.loadDraft.mockReset() })

  it('returns the server-canonical project when the stored draft validates', async () => {
    const stored = staticDemoProject()
    const canonical = { ...stored, name: 'Canonical' }
    mocks.loadDraft.mockResolvedValue(stored)
    mocks.compile.mockResolvedValue({ project: canonical })
    await expect(openStoredProject(stored.id, new AbortController().signal)).resolves.toEqual({ project: canonical })
  })

  it('opens a draft the compiler rejects as stored, so it can be fixed', async () => {
    const stored = { ...staticDemoProject(), id: 'rejected-draft' }
    mocks.loadDraft.mockResolvedValue(stored)
    mocks.compile.mockRejectedValue(rejection())
    await expect(openStoredProject(stored.id, new AbortController().signal)).resolves.toEqual({ project: stored })
  })

  it('refuses unreadable records and unavailable compilers', async () => {
    mocks.loadDraft.mockResolvedValue({ project_schema_version: '2.0', id: 'broken' })
    mocks.compile.mockRejectedValue(rejection())
    await expect(openStoredProject('broken', new AbortController().signal)).rejects.toBeInstanceOf(StudioApiError)
    const { manifest } = staticDemoProject().bundle
    mocks.loadDraft.mockResolvedValue({ ...staticDemoProject(), id: 'shallow', bundle: { ...staticDemoProject().bundle, manifest: { ...manifest, macros: undefined } } })
    await expect(openStoredProject('shallow', new AbortController().signal)).rejects.toBeInstanceOf(StudioApiError)
    mocks.loadDraft.mockResolvedValue({ ...staticDemoProject(), id: 'other-record' })
    await expect(openStoredProject('requested-key', new AbortController().signal)).rejects.toBeInstanceOf(StudioApiError)
    mocks.loadDraft.mockResolvedValue(staticDemoProject())
    mocks.compile.mockRejectedValue(new TypeError('fetch failed'))
    await expect(openStoredProject('x', new AbortController().signal)).rejects.toBeInstanceOf(TypeError)
  })
})
