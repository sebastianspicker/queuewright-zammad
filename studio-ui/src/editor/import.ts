import { api } from '../api/client'
import type { ManifestDocument, ProfileDocument, RawBundle, StudioProjectV2 } from '../contracts'
import { isRecord, isV1Project, isV2Project } from '../contracts/runtime'

export function readFile(file: Blob): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? '')); reader.onerror = () => reject(reader.error ?? new Error('Unable to read import file')); reader.readAsText(file) })
}

export function profileValue(value: unknown): ProfileDocument | undefined { return typeof value === 'object' && value !== null && typeof (value as { profile_key?: unknown }).profile_key === 'string' ? value as ProfileDocument : undefined }
export function manifestValue(value: unknown): ManifestDocument | undefined { return typeof value === 'object' && value !== null && typeof (value as { manifest_key?: unknown }).manifest_key === 'string' ? value as ManifestDocument : undefined }

export function findBundle(values: unknown[]): RawBundle | undefined {
  const bundle = values.find((value) => typeof value === 'object' && value !== null && profileValue((value as { profile?: unknown }).profile) && manifestValue((value as { manifest?: unknown }).manifest)) as RawBundle | undefined
  if (bundle) return bundle
  const profile = values.map(profileValue).find(Boolean)
  const manifest = values.map(manifestValue).find(Boolean)
  return profile && manifest ? { profile, manifest } : undefined
}

/** The only part of a Blueprint that editableV2Draft reads before the server validates the rest. */
function hasDecisionRecords(value: object): boolean {
  const workbook = (value as { workbook?: unknown }).workbook
  return isRecord(workbook) && isRecord(workbook.capability_decisions) && Object.values(workbook.capability_decisions).every(isRecord)
}

export async function importValues(values: unknown[]): Promise<StudioProjectV2> {
  const v2 = values.find(isV2Project)
  if (v2 && !hasDecisionRecords(v2)) throw new Error('The Blueprint file is incomplete or malformed: workbook.capability_decisions must be an object of decisions.')
  if (v2) return (await api.compile(v2)).project
  const v1 = values.find(isV1Project)
  if (v1) return (await api.compile(v1)).project
  const bundle = findBundle(values)
  if (!bundle) throw new Error('A profile and desired-state manifest are both required.')
  return (await api.compile(bundle)).project
}

export async function importFilesIntoStudio(input: FileList | File[]): Promise<StudioProjectV2> {
  const files = [...input]
  if (files.length < 1 || files.length > 2) throw new Error('Choose one project or bundle file, or a profile and manifest pair.')
  if (files.some((file) => file.size > 2 * 1024 * 1024)) throw new Error('Each import file must be 2 MiB or smaller.')
  return importValues(await Promise.all(files.map(async (file) => JSON.parse(await readFile(file)))))
}
