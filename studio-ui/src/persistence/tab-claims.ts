/** Cross-tab project ownership: the tab that claimed a project last owns its draft. */
export interface TabClaims {
  claim(projectId: string): void
  onSuperseded(listener: (projectId: string) => void): () => void
  close(): void
}

interface ClaimMessage { type: 'claim'; projectId: string; tabId: string }

export function createTabClaims(tabId: string = crypto.randomUUID()): TabClaims {
  if (typeof BroadcastChannel === 'undefined') return { claim() {}, onSuperseded: () => () => {}, close() {} }
  const channel = new BroadcastChannel('queuewright-studio')
  return {
    claim: (projectId) => channel.postMessage({ type: 'claim', projectId, tabId } satisfies ClaimMessage),
    onSuperseded(listener) {
      const handler = (event: MessageEvent<ClaimMessage>) => {
        const message = event.data
        if (message?.type === 'claim' && typeof message.projectId === 'string' && message.tabId !== tabId) listener(message.projectId)
      }
      channel.addEventListener('message', handler)
      return () => channel.removeEventListener('message', handler)
    },
    close: () => channel.close(),
  }
}
