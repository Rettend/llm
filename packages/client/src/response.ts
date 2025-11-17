export interface LLMClientResponse<T> {
  data: T | null
  error: Error | null
  cached: boolean
}
