export interface UserCredits {
  userId: string
  totalCredits: number
  usedCredits: number
  availableCredits: number
  lastUpdated: string
}

export interface CreditTransaction {
  id: string
  userId: string
  amount: number
  type: 'deduction' | 'addition' | 'bonus' | 'refund'
  description: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export const DEFAULT_CREDITS = 500
export const QUERY_COST = 10
export const FREE_AUTO_START = true

export function calculateCreditsAvailable(total: number, used: number): number {
  return Math.max(0, total - used)
}

export function canAfford(available: number, amount: number): boolean {
  return available >= amount
}

export function deductCredits(current: number, amount: number): number {
  return Math.max(0, current - amount)
}

export function addCredits(current: number, amount: number): number {
  return current + amount
}
