'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Task {
  id: string
  content_en: string
  content_cn: string
  category: string
  created_at: string
}

interface PendingTask {
  id: string
  user_id: string | null
  content: string
  description: string | null
  submitted_language: string
  status: string
  submitted_at: string
}

interface Stats {
  totalTasks: number
  categories: Record<string, number>
  totalUsers: number
  totalCompletions: number
  pendingCount: number
}

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || '2799786996@qq.com'

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'add' | 'bulk' | 'list' | 'pending' | 'stats'>('add')

  // Add single
  const [addEn, setAddEn] = useState('')
  const [addCn, setAddCn] = useState('')
  const [addCat, setAddCat] = useState('general')
  const [addMsg, setAddMsg] = useState('')

  // Bulk
  const [bulkText, setBulkText] = useState('')
  const [bulkMsg, setBulkMsg] = useState('')

  // List
  const [tasks, setTasks] = useState<Task[]>([])
  const [listPage, setListPage] = useState(0)
  const [listFilter, setListFilter] = useState('')
  const [listSearch, setListSearch] = useState('')
  const [editTask, setEditTask] = useState<Task | null>(null)

  // Pending
  const [pendings, setPendings] = useState<PendingTask[]>([])
  const [pendingTab, setPendingTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [reviewData, setReviewData] = useState<Record<string, { translation: string; category: string }>>({})

  // Stats
  const [stats, setStats] = useState<Stats>({ totalTasks: 0, categories: {}, totalUsers: 0, totalCompletions: 0, pendingCount: 0 })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email === ADMIN_EMAIL) {
        setAuthed(true)
      }
      setLoading(false)
    })
  }, [])

  const loadTasks = useCallback(async () => {
    let query = supabase.from('public_tasks').select('*').order('created_at', { ascending: false })
    if (listFilter) query = query.eq('category', listFilter)
    if (listSearch) query = query.or(`content_en.ilike.%${listSearch}%,content_cn.ilike.%${listSearch}%`)
    query = query.range(listPage * 50, (listPage + 1) * 50 - 1)
    const { data } = await query
    if (data) setTasks(data)
  }, [listPage, listFilter, listSearch])

  const loadPendings = useCallback(async () => {
    const { data } = await supabase.from('pending_tasks').select('*').eq('status', pendingTab).order('submitted_at', { ascending: false })
    if (data) setPendings(data)
  }, [pendingTab])

  const loadStats = useCallback(async () => {
    const { count: taskCount } = await supabase.from('public_tasks').select('*', { count: 'exact', head: true })
    const { data: cats } = await supabase.from('public_tasks').select('category')
    const catMap: Record<string, number> = {}
    cats?.forEach(c => { catMap[c.category] = (catMap[c.category] || 0) + 1 })
    const { count: pubComp } = await supabase.from('public_completions').select('*', { count: 'exact', head: true })
    const { count: custComp } = await supabase.from('custom_completions').select('*', { count: 'exact', head: true })
    const { count: pendCount } = await supabase.from('pending_tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    setStats({
      totalTasks: taskCount || 0,
      categories: catMap,
      totalUsers: 0,
      totalCompletions: (pubComp || 0) + (custComp || 0),
      pendingCount: pendCount || 0,
    })
  }, [])

  useEffect(() => {
    if (!authed) return
    if (tab === 'list') loadTasks()
    if (tab === 'pending') loadPendings()
    if (tab === 'stats') loadStats()
  }, [authed, tab, loadTasks, loadPendings, loadStats])

  if (loading) return <div style={{ padding: 40, color: '#fff', fontFamily: "'Space Grotesk', sans-serif" }}>Loading...</div>
  if (!authed) return (
    <div style={{ padding: 40, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", background: '#22353d', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>403 — Admin Only</h1>
      <p>Please sign in with the admin account.</p>
      <button onClick={() => window.location.href = '/'} style={{ marginTop: 16, padding: '8px 24px', background: '#fff', color: '#22353d', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
        Go Home
      </button>
    </div>
  )

  async function addSingle() {
    if (!addEn.trim() || !addCn.trim()) { setAddMsg('Fill both fields'); return }
    const { error } = await supabase.from('public_tasks').insert({ content_en: addEn.trim(), content_cn: addCn.trim(), category: addCat })
    if (error) { setAddMsg(error.message); return }
    setAddMsg('Task added!')
    setAddEn(''); setAddCn(''); setAddCat('general')
    setTimeout(() => setAddMsg(''), 2000)
  }

  async function bulkImport() {
    const lines = bulkText.trim().split('\n').filter(l => l.trim())
    let success = 0
    const errors: string[] = []
    for (const line of lines) {
      const parts = line.split('|').map(s => s.trim())
      if (parts.length < 2) { errors.push(line); continue }
      const { error } = await supabase.from('public_tasks').insert({
        content_cn: parts[0], content_en: parts[1], category: parts[2] || 'general',
      })
      if (error) errors.push(line + ' — ' + error.message)
      else success++
    }
    setBulkMsg(`Imported ${success} tasks.${errors.length ? '\nErrors:\n' + errors.join('\n') : ''}`)
  }

  async function deleteTask(id: string) {
    await supabase.from('public_tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  async function saveEdit() {
    if (!editTask) return
    await supabase.from('public_tasks').update({
      content_en: editTask.content_en,
      content_cn: editTask.content_cn,
      category: editTask.category,
    }).eq('id', editTask.id)
    setTasks(prev => prev.map(t => t.id === editTask.id ? editTask : t))
    setEditTask(null)
  }

  async function approvePending(p: PendingTask) {
    const rd = reviewData[p.id]
    if (!rd?.translation?.trim()) return
    const isCn = p.submitted_language === 'cn'
    await supabase.from('public_tasks').insert({
      content_cn: isCn ? p.content : rd.translation,
      content_en: isCn ? rd.translation : p.content,
      category: rd.category || 'general',
    })
    await supabase.from('pending_tasks').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', p.id)
    setPendings(prev => prev.filter(t => t.id !== p.id))
  }

  async function rejectPending(id: string) {
    await supabase.from('pending_tasks').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id)
    setPendings(prev => prev.filter(t => t.id !== id))
  }

  const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', padding: '8px 12px', fontFamily: 'inherit', fontSize: 14, width: '100%', marginBottom: 8 }
  const btnStyle: React.CSSProperties = { background: '#4ade80', color: '#22353d', padding: '8px 20px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, letterSpacing: '.1em' }

  return (
    <div style={{ background: '#22353d', minHeight: '100vh', color: '#fff', fontFamily: "'Space Grotesk', sans-serif", padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '.1em' }}>ADMIN PANEL</h1>
        <a href="/" style={{ color: 'rgba(255,255,255,.5)', fontSize: 13 }}>← Back to site</a>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['add', 'bulk', 'list', 'pending', 'stats'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
            background: tab === t ? 'rgba(74,222,128,.3)' : 'rgba(255,255,255,.05)',
            border: `1px solid ${tab === t ? '#4ade80' : 'rgba(255,255,255,.15)'}`,
            color: '#fff', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase',
          }}>
            {t === 'add' ? 'Add Task' : t === 'bulk' ? 'Bulk Import' : t === 'list' ? 'Task List' : t === 'pending' ? 'Review Pending' : 'Stats'}
          </button>
        ))}
      </div>

      {/* ADD SINGLE */}
      {tab === 'add' && (
        <div style={{ maxWidth: 600 }}>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '.1em', fontWeight: 700 }}>中文</label>
          <input style={inputStyle} value={addCn} onChange={e => setAddCn(e.target.value)} placeholder="中文任务内容" />
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '.1em', fontWeight: 700 }}>English</label>
          <input style={inputStyle} value={addEn} onChange={e => setAddEn(e.target.value)} placeholder="English task content" />
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '.1em', fontWeight: 700 }}>Category</label>
          <input style={inputStyle} value={addCat} onChange={e => setAddCat(e.target.value)} placeholder="general" />
          <button style={btnStyle} onClick={addSingle}>ADD TASK</button>
          {addMsg && <div style={{ marginTop: 8, color: '#4ade80', fontSize: 13 }}>{addMsg}</div>}
        </div>
      )}

      {/* BULK IMPORT */}
      {tab === 'bulk' && (
        <div style={{ maxWidth: 700 }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 8 }}>
            Each line: 中文内容 | English content | category
          </p>
          <textarea
            style={{ ...inputStyle, height: 200, resize: 'vertical' }}
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder={'出门散步十分钟 | Take a 10-minute walk | wellness\n给朋友发条消息 | Send a message to a friend | social'}
          />
          <button style={btnStyle} onClick={bulkImport}>BULK IMPORT</button>
          {bulkMsg && <pre style={{ marginTop: 8, color: '#4ade80', fontSize: 12, whiteSpace: 'pre-wrap' }}>{bulkMsg}</pre>}
        </div>
      )}

      {/* TASK LIST */}
      {tab === 'list' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <input style={{ ...inputStyle, width: 200, marginBottom: 0 }} placeholder="Search..." value={listSearch} onChange={e => { setListSearch(e.target.value); setListPage(0) }} />
            <select style={{ ...inputStyle, width: 150, marginBottom: 0 }} value={listFilter} onChange={e => { setListFilter(e.target.value); setListPage(0) }}>
              <option value="">All categories</option>
              {Object.keys(stats.categories).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button style={{ ...btnStyle, fontSize: 11 }} onClick={loadTasks}>Refresh</button>
          </div>

          {editTask && (
            <div style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.2)', padding: 16, marginBottom: 16 }}>
              <h3 style={{ marginBottom: 8, fontSize: 14 }}>Edit Task</h3>
              <input style={inputStyle} value={editTask.content_cn} onChange={e => setEditTask({ ...editTask, content_cn: e.target.value })} />
              <input style={inputStyle} value={editTask.content_en} onChange={e => setEditTask({ ...editTask, content_en: e.target.value })} />
              <input style={inputStyle} value={editTask.category} onChange={e => setEditTask({ ...editTask, category: e.target.value })} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnStyle} onClick={saveEdit}>Save</button>
                <button style={{ ...btnStyle, background: 'rgba(255,255,255,.1)', color: '#fff' }} onClick={() => setEditTask(null)}>Cancel</button>
              </div>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.2)' }}>
                <th style={{ textAlign: 'left', padding: 8, color: 'rgba(255,255,255,.4)', fontSize: 11 }}>#</th>
                <th style={{ textAlign: 'left', padding: 8, color: 'rgba(255,255,255,.4)', fontSize: 11 }}>中文</th>
                <th style={{ textAlign: 'left', padding: 8, color: 'rgba(255,255,255,.4)', fontSize: 11 }}>English</th>
                <th style={{ textAlign: 'left', padding: 8, color: 'rgba(255,255,255,.4)', fontSize: 11 }}>Cat</th>
                <th style={{ textAlign: 'left', padding: 8, color: 'rgba(255,255,255,.4)', fontSize: 11 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <td style={{ padding: 8, color: 'rgba(255,255,255,.3)' }}>{listPage * 50 + i + 1}</td>
                  <td style={{ padding: 8, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.content_cn}</td>
                  <td style={{ padding: 8, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.content_en}</td>
                  <td style={{ padding: 8, color: 'rgba(255,255,255,.5)' }}>{t.category}</td>
                  <td style={{ padding: 8 }}>
                    <span style={{ cursor: 'pointer', color: '#7dd3fc', marginRight: 12 }} onClick={() => setEditTask(t)}>Edit</span>
                    <span style={{ cursor: 'pointer', color: '#fca5a5' }} onClick={() => deleteTask(t.id)}>Del</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button style={{ ...btnStyle, fontSize: 11, opacity: listPage === 0 ? .3 : 1 }} onClick={() => listPage > 0 && setListPage(listPage - 1)} disabled={listPage === 0}>← Prev</button>
            <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 12, padding: '8px 0' }}>Page {listPage + 1}</span>
            <button style={{ ...btnStyle, fontSize: 11 }} onClick={() => setListPage(listPage + 1)}>Next →</button>
          </div>
        </div>
      )}

      {/* PENDING REVIEW */}
      {tab === 'pending' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            {(['pending', 'approved', 'rejected'] as const).map(s => (
              <button key={s} onClick={() => setPendingTab(s)} style={{
                padding: '6px 14px', fontSize: 11, fontWeight: 700,
                background: pendingTab === s ? 'rgba(74,222,128,.2)' : 'transparent',
                border: `1px solid ${pendingTab === s ? '#4ade80' : 'rgba(255,255,255,.15)'}`,
                color: '#fff', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase',
              }}>
                {s}
              </button>
            ))}
          </div>

          {pendings.length === 0 && <p style={{ color: 'rgba(255,255,255,.3)', fontSize: 13 }}>No {pendingTab} tasks.</p>}

          {pendings.map(p => (
            <div key={p.id} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.1)', padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 4 }}>
                {p.user_id ? `User: ${p.user_id.slice(0, 8)}...` : 'Anonymous'} · {p.submitted_language?.toUpperCase()} · {new Date(p.submitted_at).toLocaleDateString()}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{p.content}</div>
              {p.description && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>{p.description}</div>}

              {pendingTab === 'pending' && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
                    {p.submitted_language === 'cn' ? 'English translation' : '中文翻译'}
                  </label>
                  <input
                    style={{ ...inputStyle, marginTop: 4 }}
                    value={reviewData[p.id]?.translation || ''}
                    onChange={e => setReviewData(prev => ({ ...prev, [p.id]: { ...prev[p.id], translation: e.target.value, category: prev[p.id]?.category || 'general' } }))}
                    placeholder={p.submitted_language === 'cn' ? 'English translation...' : '中文翻译...'}
                  />
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>Category</label>
                  <input
                    style={{ ...inputStyle, marginTop: 4, width: 200 }}
                    value={reviewData[p.id]?.category || 'general'}
                    onChange={e => setReviewData(prev => ({ ...prev, [p.id]: { ...prev[p.id], category: e.target.value, translation: prev[p.id]?.translation || '' } }))}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button style={btnStyle} onClick={() => approvePending(p)}>Approve</button>
                    <button style={{ ...btnStyle, background: '#fca5a5', color: '#22353d' }} onClick={() => rejectPending(p.id)}>Reject</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* STATS */}
      {tab === 'stats' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.1)', padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#4ade80' }}>{stats.totalTasks}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '.1em', marginTop: 4 }}>TOTAL TASKS</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.1)', padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#7dd3fc' }}>{stats.totalCompletions}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '.1em', marginTop: 4 }}>TOTAL COMPLETIONS</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.1)', padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#fde68a' }}>{stats.pendingCount}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '.1em', marginTop: 4 }}>PENDING REVIEW</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.1)', padding: 20 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '.1em', marginBottom: 8 }}>CATEGORIES</div>
            {Object.entries(stats.categories).map(([cat, count]) => (
              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span>{cat}</span>
                <span style={{ color: 'rgba(255,255,255,.5)' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
