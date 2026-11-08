import { describe, expect, it } from 'vitest'
import { staticDemoProject } from '../data'
import { shouldSaveDraft } from './effects'
import { initialState, studioReducer, type State } from './reducer'
import { createTabClaims } from '../persistence/tab-claims'

const wait = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('tab claims', () => {
  it('notifies other tabs but not the claiming tab', async () => {
    const a = createTabClaims('a')
    const b = createTabClaims('b')
    const heardByA: string[] = []
    const heardByB: string[] = []
    a.onSuperseded((id) => heardByA.push(id))
    b.onSuperseded((id) => heardByB.push(id))
    a.claim('p1')
    await wait()
    expect(heardByB).toEqual(['p1'])
    expect(heardByA).toEqual([])
    a.close(); b.close()
  })

  it('makes tab B read-only and stops its saves when tab A claims the same project', async () => {
    const a = createTabClaims('a')
    const b = createTabClaims('b')
    let state: State = { ...initialState, hydrated: true }
    expect(shouldSaveDraft(state, false)).toBe(true)
    b.onSuperseded((projectId) => { state = studioReducer(state, { type: 'tab:superseded', projectId }) })
    a.claim(state.project.id)
    await wait()
    expect(shouldSaveDraft(state, false)).toBe(false)
    a.close(); b.close()
  })
})

describe('superseded reducer', () => {
  const superseded = studioReducer({ ...initialState, hydrated: true }, { type: 'tab:superseded', projectId: initialState.project.id })

  it('ignores a claim for a different project', () => {
    expect(studioReducer({ ...initialState, hydrated: true }, { type: 'tab:superseded', projectId: 'other' }).supersededProjectId).toBeUndefined()
  })

  it('ignores edits and same-project replacements', () => {
    expect(studioReducer(superseded, { type: 'project:edit', edit: (p) => ({ ...p, name: 'changed' }) })).toBe(superseded)
    expect(studioReducer(superseded, { type: 'project:replace', project: { ...superseded.project, name: 'changed' } })).toBe(superseded)
  })

  it('lets the tab open a different project, which clears read-only', () => {
    const other = { ...staticDemoProject(), id: 'other-project' }
    const next = studioReducer(superseded, { type: 'project:replace', project: other })
    expect(next.project.id).toBe('other-project')
    expect(shouldSaveDraft(next, false)).toBe(true)
  })
})
