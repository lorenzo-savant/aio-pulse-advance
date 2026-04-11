import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { generateId } from '@/lib/utils'
import type { AnalysisResult, ScanHistoryEntry, EngineId, ModelId } from '@/types'

// ─── State Shape ──────────────────────────────────────────────────────────────

interface AppStore {
  // ── User ─────────────────────────────────────────────────────────────────
  userId: string | null
  setUserId: (id: string | null) => void

  // ── Share stats ───────────────────────────────────────────────────────────
  shareStats: { copies: number; shares: number }
  incrementCopies: () => void
  incrementShares: () => void

  // ── Scan history ──────────────────────────────────────────────────────────
  scanHistory: ScanHistoryEntry[]
  scanHistoryLoading: boolean
  loadScanHistory: () => Promise<void>
  addScan: (result: AnalysisResult, engine: EngineId, model: ModelId) => Promise<ScanHistoryEntry>
  removeScan: (id: string) => void
  clearHistory: () => void

  // ── UI state ──────────────────────────────────────────────────────────────
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
  devtools(
    (set, get) => ({
      // User
      userId: null,
      setUserId: (id) => set({ userId: id }),

      // Share stats
      shareStats: { copies: 0, shares: 0 },
      incrementCopies: () =>
        set((s) => ({ shareStats: { ...s.shareStats, copies: s.shareStats.copies + 1 } })),
      incrementShares: () =>
        set((s) => ({ shareStats: { ...s.shareStats, shares: s.shareStats.shares + 1 } })),

      // Scan history
      scanHistory: [],
      scanHistoryLoading: false,

      loadScanHistory: async () => {
        set({ scanHistoryLoading: true })
        try {
          const res = await fetch('/api/scans')
          const json = await res.json()

          if (json.success && json.data) {
            const entries: ScanHistoryEntry[] = (json.data as Record<string, unknown>[]).map((row) => ({
              id: row.id as string,
              source: row.source as string,
              type: row.type as 'text' | 'url',
              summary: (row.summary as string) || '',
              visibilityScore: row.visibility_score as number,
              engineBreakdown: [],
              suggestions: [],
              keywords: [],
              analyzedText: '',
              intent: (row.intent as AnalysisResult['intent']) || 'Informational',
              intentConfidence: (row.intent_confidence as number) || 0,
              intentSignals: [],
              contentType: (row.content_type as string) || 'article',
              contentTypeConfidence: 0,
              tone: (row.tone as string) || 'neutral',
              toneConfidence: 0,
              readingLevel: (row.reading_level as string) || 'intermediate',
              audience: '',
              timestamp: new Date(row.created_at as string).getTime(),
              engine: row.engine as EngineId,
              model: row.model as ModelId,
            }))
            set({ scanHistory: entries })
          }
        } catch (err) {
          console.error('[store] Failed to load scan history:', err)
        } finally {
          set({ scanHistoryLoading: false })
        }
      },

      addScan: async (result, engine, model) => {
        const entry: ScanHistoryEntry = {
          ...result,
          id: generateId('scan'),
          engine,
          model,
          timestamp: Date.now(),
        }

        // Update local state immediately
        set((s) => ({
          scanHistory: [entry, ...s.scanHistory].slice(0, 50),
        }))

        // Persist via API
        try {
          const res = await fetch('/api/scans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source: result.source,
              type: result.type,
              summary: result.summary,
              visibility_score: result.visibilityScore,
              engine,
              model,
              intent: result.intent,
              intent_confidence: result.intentConfidence,
              content_type: result.contentType,
              tone: result.tone,
              reading_level: result.readingLevel,
            }),
          })

          const json = await res.json()
          if (json.success && json.data?.id) {
            // Update local entry with DB id
            set((s) => ({
              scanHistory: s.scanHistory.map((e) =>
                e.id === entry.id ? { ...e, id: json.data.id } : e,
              ),
            }))
          }
        } catch (err) {
          console.error('[store] Failed to persist scan:', err)
        }

        return entry
      },

      removeScan: (id) => {
        set((s) => ({ scanHistory: s.scanHistory.filter((e) => e.id !== id) }))
        // Delete from DB via API
        fetch(`/api/scans?id=${id}`, { method: 'DELETE' }).catch((err) =>
          console.error('[store] Failed to delete scan:', err),
        )
      },

      clearHistory: () => set({ scanHistory: [] }),

      // UI
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    { name: 'AIOPulseStore' },
  ),
)

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectScanHistory = (s: AppStore) => s.scanHistory
export const selectShareStats = (s: AppStore) => s.shareStats
export const selectSidebarOpen = (s: AppStore) => s.sidebarOpen
