import { BaseAgent } from './base-agent'
import {
  BrandMonitorAgent,
  CompetitorAnalystAgent,
  KeywordExpertAgent,
  ReportBuilderAgent,
  AuditAgent,
} from './specialized-agents'

const agentRegistry = new Map<string, BaseAgent>()

function registerAgent(agent: BaseAgent): void {
  agentRegistry.set(agent.id, agent)
}

registerAgent(new BrandMonitorAgent())
registerAgent(new CompetitorAnalystAgent())
registerAgent(new KeywordExpertAgent())
registerAgent(new ReportBuilderAgent())
registerAgent(new AuditAgent())

export function getAgent(agentId: string): BaseAgent | undefined {
  return agentRegistry.get(agentId)
}

export function getAllAgents(): BaseAgent[] {
  return Array.from(agentRegistry.values())
}

export function getAgentNames(): Record<string, { name: string; description: string }> {
  const result: Record<string, { name: string; description: string }> = {}
  for (const [id, agent] of agentRegistry) {
    result[id] = { name: agent.name, description: agent.description }
  }
  return result
}
