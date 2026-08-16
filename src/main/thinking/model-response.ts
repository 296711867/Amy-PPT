import { createMiddleware } from 'langchain'
export { normalizeModelResponse as normalizeThinkingModelResponse } from '../agent-runtime/model/response'
import { normalizeModelResponse } from '../agent-runtime/model/response'

export function createThinkingToolAllowlistMiddleware(allowedToolNames: Set<string>) {
  return createMiddleware({
    name: 'thinkingToolAllowlist',
    wrapModelCall: async (request, handler) => {
      const tools = request.tools?.filter((tool) => allowedToolNames.has(String(tool.name || '')))
      const response = await handler({ ...request, tools })
      return normalizeModelResponse(response) as typeof response
    }
  })
}
