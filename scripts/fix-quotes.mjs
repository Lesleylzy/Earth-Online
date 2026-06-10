const URL = 'https://iwndbljpyfbluttcnqvq.supabase.co'
const KEY = process.env.SK
if (!KEY) { console.error('Set SK'); process.exit(1) }

async function fixQuotes() {
  const res = await fetch(`${URL}/rest/v1/public_tasks?select=id,content_cn,content_en`, {
    headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` },
  })
  const tasks = await res.json()
  let fixed = 0

  for (const t of tasks) {
    let newCn = t.content_cn
    let newEn = t.content_en
    let changed = false

    // Fix Chinese content: replace ASCII " with Chinese ""
    if (newCn && newCn.includes('"')) {
      let count = 0
      newCn = newCn.replace(/"/g, () => (count++ % 2 === 0) ? '\u201c' : '\u201d')
      changed = true
    }

    // Fix English content: replace ASCII " with smart quotes ""
    if (newEn && newEn.includes('"')) {
      let count = 0
      newEn = newEn.replace(/"/g, () => (count++ % 2 === 0) ? '\u201c' : '\u201d')
      changed = true
    }

    if (changed) {
      const upd = await fetch(`${URL}/rest/v1/public_tasks?id=eq.${t.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': KEY,
          'Authorization': `Bearer ${KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ content_cn: newCn, content_en: newEn }),
      })
      if (upd.ok) {
        fixed++
        console.log(`Fixed: ${newCn} | ${newEn}`)
      } else {
        console.error(`Error fixing ${t.id}:`, await upd.text())
      }
    }
  }
  console.log(`\nTotal fixed: ${fixed}`)
}

fixQuotes()
