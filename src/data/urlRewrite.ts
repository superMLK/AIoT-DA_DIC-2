export interface RewriteResult {
  url: string
  rewritten: boolean
  kind?: 'github' | 'google-sheets'
}

/** 把常見的「檔案頁面」網址改成可直接下載 CSV 的網址。 */
export function rewriteCsvUrl(input: string): RewriteResult {
  const trimmed = input.trim()
  let u: URL
  try {
    u = new URL(trimmed)
  } catch {
    return { url: trimmed, rewritten: false }
  }

  if (u.hostname === 'github.com' || u.hostname === 'www.github.com') {
    const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/)
    if (m) {
      return {
        url: `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`,
        rewritten: true,
        kind: 'github',
      }
    }
  }

  if (u.hostname === 'docs.google.com') {
    const m = u.pathname.match(/^\/spreadsheets\/d\/([^/]+)/)
    if (m && !u.pathname.endsWith('/export')) {
      const gid = u.searchParams.get('gid') ?? new URLSearchParams(u.hash.slice(1)).get('gid')
      const url = `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ''}`
      return { url, rewritten: true, kind: 'google-sheets' }
    }
  }

  return { url: trimmed, rewritten: false }
}
