import { composeProductSystem } from '../src/lib/factory/core/product-system-composer'
import { runDeepResearchV12 } from '../src/lib/factory/deep-research-v12'
import { BuildRequestSchema, type FactoryBuildRequest } from '../src/lib/factory/build/schemas'
import { makeBuildId, currentProgress, resolveBuildIndustry } from '../src/lib/factory/build/utils'
import { normalizePythonResult } from '../src/lib/factory/build/normalizers'
import { EXAMPLES, PRIORITIES } from '../src/components/factory/studio/constants'

async function verifyAllDecomposedModules() {
  console.log('=== Starting Verification of Decomposed Modules ===\n')

  // 1. Verify product-system-composer
  console.log('1. Testing product-system-composer module...')
  const system = await composeProductSystem({
    industry: 'healthcare',
    idea: 'AI Patient Intake Platform',
    fields: ['healthcare', 'intake', 'ai'],
    maxRepos: 3,
  })
  if (!system || typeof system !== 'object') {
    throw new Error('composeProductSystem returned invalid response')
  }
  console.log('   ✓ composeProductSystem returned valid system architecture.')

  // 2. Verify deep-research-v12
  console.log('2. Testing deep-research-v12 module...')
  const research = await runDeepResearchV12('AI Agent Platform', {}, ['langchain', 'autogen'])
  if (!research || typeof research !== 'object') {
    throw new Error('runDeepResearchV12 returned invalid response')
  }
  console.log('   ✓ runDeepResearchV12 completed successfully.')

  // 3. Verify build route helpers & schemas
  console.log('3. Testing build route helpers & schemas...')
  const mockRequest: FactoryBuildRequest = {
    idea: 'Test Idea',
    mode: 'full',
    industry: 'tech',
    fields: ['ai', 'tech'],
    maxRepos: 5,
    outputFormat: 'pipeline',
  }
  const parsed = BuildRequestSchema.safeParse(mockRequest)
  if (!parsed.success) {
    throw new Error('BuildRequestSchema validation failed')
  }
  const buildId = makeBuildId()
  const progress = currentProgress('queued')
  const resolvedInd = resolveBuildIndustry(mockRequest)
  const normalizedPy = normalizePythonResult({ status: 'ok', selected_repos: [] }, 'req-123', 'run-456', 'full', buildId)
  if (!buildId || typeof progress !== 'number' || resolvedInd !== 'tech' || !normalizedPy) {
    throw new Error('Build route helpers returned unexpected values')
  }
  console.log('   ✓ Build route schemas, helpers, and normalizers working correctly.')

  // 4. Verify Studio V10 exports
  console.log('4. Testing Studio V10 exports...')
  if (!Array.isArray(EXAMPLES) || EXAMPLES.length === 0 || !Array.isArray(PRIORITIES)) {
    throw new Error('Studio V10 constants are missing or invalid')
  }
  console.log('   ✓ Studio V10 constants and types verified.')

  console.log('\n=== ALL DECOMPOSED MODULES VERIFIED SUCCESSFULLY ===')
}

verifyAllDecomposedModules().catch((err) => {
  console.error('\n❌ Verification Failed:', err)
  process.exit(1)
})
