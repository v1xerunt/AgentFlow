import { t } from '@agentflow/core/localization'
import { z } from 'zod'
import { graphDefinitionSchema, projectDefinitionSchema, workspaceBindingSchema } from '@agentflow/schema'

const id = z.string().min(1)
const time = z.string().datetime()
const responsePart = z.object({ type: z.enum(['output_text', 'reasoning_summary', 'reasoning']), text: z.string() })
const providerState = z.object({ format: z.enum(['openai-responses', 'anthropic-content', 'gemini-parts', 'openai-reasoning-details']), data: z.unknown() })
const outputFile = z.object({ name: z.string(), relativePath: z.string(), mimeType: z.string(), size: z.number(), mode: z.enum(['text', 'attachment']), content: z.string().optional(), dataBase64: z.string().optional(), extractionError: z.string().optional() })
const artifact = z.object({
  id, runId: id, nodeId: id, version: z.number().int().positive(), content: z.string(),
  parentArtifacts: z.array(id), sourceInputs: z.array(id), createdAt: time,
  files: z.array(outputFile).optional(), parts: z.array(responsePart).optional(), providerState: providerState.optional()
})
const eventBase = { runId: id, at: time, message: z.string() }
const event = z.discriminatedUnion('type', [
  z.object({ ...eventBase, type: z.literal('run.started') }),
  z.object({ ...eventBase, type: z.literal('run.completed') }),
  z.object({ ...eventBase, type: z.literal('run.cancelled') }),
  z.object({ ...eventBase, type: z.literal('run.paused') }),
  z.object({ ...eventBase, type: z.literal('node.status'), nodeId: id, status: z.enum(['idle', 'waiting', 'running', 'completed', 'failed', 'cancelled', 'paused']) }),
  z.object({ ...eventBase, type: z.literal('artifact.created'), nodeId: id, artifact })
])

export const flowProjectSchema = z.object({
  format: z.literal('agentflow-project'),
  version: z.literal(1),
  state: z.object({
    schemaVersion: z.literal(1),
    projects: z.array(projectDefinitionSchema).length(1),
    graphs: z.array(z.object({
      id, projectId: id, revision: z.number().int().positive(), definition: graphDefinitionSchema,
      createdAt: time, updatedAt: time
    })).min(1),
    sessions: z.array(z.object({
      id, title: z.string().optional(), origin: z.enum(['graph', 'temporary-conversation']).optional(),
      projectId: id, graphId: id, agentNodeId: id,
      connector: z.enum(['model', 'agent-tool', 'subscription']),
      externalSessionId: z.string().optional(), isActive: z.boolean(),
      status: z.enum(['idle', 'running', 'failed', 'archived']), workspaceSnapshot: workspaceBindingSchema,
      messages: z.array(z.object({ id, role: z.enum(['user', 'assistant']), content: z.string(), createdAt: time.optional(), parentId: id.optional(), parts: z.array(responsePart).optional(), providerState: providerState.optional(), externalSessionId: z.string().optional(), manual: z.boolean().optional() })),
      activeLeafMessageId: id.optional(),
      createdAt: time, updatedAt: time
    })),
    runs: z.array(z.object({
      id, name: z.string().optional(), projectId: id, graphId: id, graphRevision: z.number().int().positive(),
      sessionBindings: z.record(z.string(), z.string()), workspaceSnapshot: workspaceBindingSchema,
      artifacts: z.array(artifact), events: z.array(event), createdAt: time, completedAt: time.optional(), status: z.literal('completed').optional(), graphSnapshot: graphDefinitionSchema.optional(), parentRunId: id.optional(), artifactBindings: z.record(z.string(), z.string()).optional(), batchId: id.optional(), batchIndex: z.number().int().nonnegative().optional(), batchSize: z.number().int().positive().optional()
    })),
    artifacts: z.array(artifact.extend({ projectId: id, graphId: id, origin: z.enum(['run', 'chat-reply', 'chat-transcript']).optional(), label: z.string().optional() })).default([]),
    workingArtifactIds: z.record(z.string(), z.record(z.string(), z.string())).default({}),
    workingBaseRunIds: z.record(z.string(), z.string()).default({}),
    activeHistoryRunIds: z.record(z.string(), z.string()).default({}),
    archivedProjectIds: z.array(id), pinnedProjectIds: z.array(id), pinnedGraphIds: z.array(id),
    activeProjectId: id, activeGraphId: id, updatedAt: time,
    suppressedSessionAgentIds: z.array(id).optional()
  }).superRefine((state, context) => {
    const projectId = state.projects[0]?.id
    const graphIds = new Set(state.graphs.map((graph) => graph.id))
    const valid = state.graphs.every((graph) => graph.projectId === projectId)
      && state.sessions.every((session) => session.projectId === projectId && graphIds.has(session.graphId))
      && state.runs.every((run) => run.projectId === projectId && graphIds.has(run.graphId))
      && state.activeProjectId === projectId && graphIds.has(state.activeGraphId)
      && graphIds.size === state.graphs.length
    if (!valid) context.addIssue({ code: z.ZodIssueCode.custom, message: t("Flow or record ownership does not match the project") })
  })
})
