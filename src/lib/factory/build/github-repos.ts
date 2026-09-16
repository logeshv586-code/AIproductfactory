import { createLogger } from '@/lib/structured-logging'

export async function fetchRepoCandidates(idea: string, logger: ReturnType<typeof createLogger>) {
  const githubToken = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'AI-Product-Factory/1.0',
  }
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`

  const searchQuery = encodeURIComponent(`${idea.split(' ').slice(0, 3).join(' ')} stars:>100`)
  const githubRes = await fetch(
    `https://api.github.com/search/repositories?q=${searchQuery}&sort=stars&order=desc&per_page=10`,
    { headers, next: { revalidate: 300 } }
  )
  const githubData = await githubRes.json()
  const repos = (githubData.items || []).map((item: any) => ({
    name: item.name,
    full_name: item.full_name,
    description: item.description || '',
    stars: item.stargazers_count,
    language: item.language || '',
    topics: item.topics || [],
    url: item.html_url,
    cloneUrl: item.clone_url,
  }))
  logger.info('factory.repos_loaded', { count: repos.length })
  return repos
}
