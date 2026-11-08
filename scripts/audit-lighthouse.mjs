import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

mkdirSync('reports/lighthouse', { recursive: true })
const targets = ['/', '/nft/nft-1']
const base = process.env.LIGHTHOUSE_BASE_URL || 'http://localhost:4173'
const cli = resolve('node_modules/lighthouse/cli/index.js')
const categories = ['performance', 'accessibility', 'best-practices', 'seo']
const summaries = []
let failed = false

if (!existsSync(cli)) {
  console.error('Lighthouse não encontrado. Execute npm ci antes da auditoria.')
  process.exit(1)
}
const median = values => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

for (const path of targets) {
  for (const profile of ['mobile', 'desktop']) {
    const reports = []
    for (let run = 1; run <= 3; run++) {
      const name = `${path === '/' ? 'home' : 'detail'}-${profile}-${run}`
      const output = resolve(`reports/lighthouse/${name}.json`)
      console.log(`Executando ${name}...`)
      const args = [
        cli, base + path, '--quiet',
        '--chrome-flags=--headless --no-sandbox',
        `--output-path=${output}`, '--output=json',
        '--only-categories=performance,accessibility,best-practices,seo',
      ]
      if (profile === 'desktop') args.push('--preset=desktop')
      const result = spawnSync(process.execPath, args, { stdio: 'inherit', shell: false, timeout: 180000 })
      if (result.status !== 0 || result.error) {
        failed = true
        console.error(`Falhou ${name}: ${result.error?.message ?? `código ${result.status}`}`)
        console.error('Verifique npm run preview, o Chrome e o relatório de erros.')
        continue
      }
      try {
        const report = JSON.parse(readFileSync(output, 'utf8'))
        const scores = Object.fromEntries(categories.map(category => [category, Math.round((report.categories[category]?.score ?? 0) * 100)]))
        const metrics = {
          lcpMs: report.audits['largest-contentful-paint']?.numericValue ?? null,
          cls: report.audits['cumulative-layout-shift']?.numericValue ?? null,
          tbtMs: report.audits['total-blocking-time']?.numericValue ?? null,
        }
        reports.push({ name, scores, metrics, environment: { lighthouseVersion: report.lighthouseVersion, userAgent: report.userAgent, fetchTime: report.fetchTime } })
        console.log(`${name}: ${Object.entries(scores).map(([key, value]) => `${key}=${value}`).join(' | ')}`)
      } catch (error) {
        failed = true
        console.error(`Falha ao ler ${output}:`, error)
      }
    }
    if (reports.length === 3) {
      const scores = Object.fromEntries(categories.map(key => [key, median(reports.map(r => r.scores[key]))]))
      const metrics = Object.fromEntries(['lcpMs', 'cls', 'tbtMs'].map(key => [key, (reports.some(r => typeof r.metrics[key] === 'number') ? median(reports.map(r => r.metrics[key]).filter(v => typeof v === 'number')) : null)]))
      summaries.push({ path, profile, scores, metrics, reports })
      console.log(`MEDIANA ${path} ${profile}:`, scores, metrics)
    } else {
      failed = true
    }
  }
}
writeFileSync('reports/lighthouse/summary.json', JSON.stringify({ base, generatedAt: new Date().toISOString(), summaries }, null, 2))
if (failed) process.exitCode = 1
