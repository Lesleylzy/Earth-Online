'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { TX, NEXT_MISSION_SUBS, NEXT_MISSION_BTNS, CELEB_MSGS, JRN_MONTHS, JRN_WDAYS } from '@/lib/translations'
import { CRITTERS } from '@/lib/critters'
import { PublicTask, CustomTask } from '@/lib/store'
import { fetchMonthRatings, upsertRating, todayStr, dateStr, isToday, isFuture, RatingsMap } from '@/lib/ratings'
import Clouds from './Clouds'
import Monitor from './Monitor'
import Tags from './Tags'

const EARTH_ICON_B64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAr0lEQVR4nGNkwAHkrLr+I/MfHStjxKaOBZdGWY8cdKn/2AxC4chZdf3HohEFPN4xBcUQOAOm+blzBlyx5N4ZBA1hxKUZ2RBshsIMYUJXjI/PwMCAYQkjNn8/d87A0IzLFUzICmCKcPkdmxwLPkli5JgIKSAEUGIBGRCKTqyxgE8zchghAxYGBnjyhKcFQt7BSEgwQFFSRjaEgQEzMz3eMYUBybVwgDWLIhsEA7iyMwDejW7oXbiD6AAAAABJRU5ErkJggg=='

const BUBBLE_ICON_B64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAV0lEQVR4nM2SSwoAIAhEm+j+V7ZdiD/UCJqVRs8mnDEuBd4QEaUgAOowC5t3K7BkZhWUUgO4G6927VT07gttddfoBgkAvKE8SCt6yUxcZKuzjQO3wC+0AUElQ9vaFJA7AAAAAElFTkSuQmCC'

export default function Game() {
  const [lang, setLang] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('eo_lang') || 'en'
    return 'en'
  })
  const [screen, setScreen] = useState('home')
  const [customMode, setCustomMode] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('eo_customMode') === 'true'
    return false
  })
  const [user, setUser] = useState<{ id: string; email: string; username: string } | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [verifiedBanner, setVerifiedBanner] = useState(false)

  const [publicTasks, setPublicTasks] = useState<PublicTask[]>([])
  const [customTasks, setCustomTasks] = useState<CustomTask[]>([])

  const [completedPublic, setCompletedPublic] = useState<string[]>([])
  const [completedCustom, setCompletedCustom] = useState<string[]>([])
  const [skippedPublic, setSkippedPublic] = useState<string[]>([])
  const [skippedCustom, setSkippedCustom] = useState<string[]>([])

  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [hasPlayed, setHasPlayed] = useState(false)

  // Boot
  const [bootText, setBootText] = useState('')
  const bootTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Next mission
  const [nextCritter, setNextCritter] = useState('')
  const [nextSub, setNextSub] = useState('')
  const [nextBtnText, setNextBtnText] = useState('')

  // Auth
  const [authMode, setAuthMode] = useState<'si' | 'rg'>('si')
  const [authMsg, setAuthMsg] = useState('')
  const [authMsgColor, setAuthMsgColor] = useState('#f87171')

  // Offer
  const [offerFlying, setOfferFlying] = useState(false)
  const [offerSent, setOfferSent] = useState(false)

  // Customize
  const [custInput, setCustInput] = useState('')

  // Stat list
  const [statListType, setStatListType] = useState<'done' | 'remaining' | 'skipped'>('done')

  // Fireworks
  const fwCanvasRef = useRef<HTMLCanvasElement>(null)
  const fwRunIdRef = useRef(0)
  const fwAnimRef = useRef<number | null>(null)

  // Forgot password
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [showPw, setShowPw] = useState(false)

  // Busy flags for debouncing
  const [savingCust, setSavingCust] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)

  // Journal / ratings
  const [jViewYear, setJViewYear] = useState(() => new Date().getFullYear())
  const [jViewMonth, setJViewMonth] = useState(() => new Date().getMonth())
  const [jRatings, setJRatings] = useState<RatingsMap>({})
  const [jLoading, setJLoading] = useState(false)

  // Day detail
  const [dCurrentDate, setDCurrentDate] = useState<string | null>(null)
  const [dCurrentStars, setDCurrentStars] = useState(0)
  const [dComment, setDComment] = useState('')
  const [dAuthMsg, setDAuthMsg] = useState<{ key: string; color: string } | null>(null)

  // Rating prompt modal
  const [ratePromptOpen, setRatePromptOpen] = useState(false)

  const t = useCallback((k: string) => TX[lang]?.[k] || k, [lang])

  // Persist lang & customMode
  useEffect(() => { localStorage.setItem('eo_lang', lang) }, [lang])
  useEffect(() => { localStorage.setItem('eo_customMode', String(customMode)) }, [customMode])

  // Check for email verification redirect
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('verified=1')) {
      setVerifiedBanner(true)
      window.history.replaceState({}, '', '/')
      setTimeout(() => setVerifiedBanner(false), 5000)
    }
  }, [])

  // Load public tasks
  const [tasksLoaded, setTasksLoaded] = useState(false)
  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('public_tasks').select('*')
      if (data) setPublicTasks(data)
      setTasksLoaded(true)
    }
    load()
  }, [])

  // Check auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || '',
        })
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || '',
        })
      } else {
        setUser(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // When user logs in (or page refreshes with session), load data from DB
  const dataLoadedRef = useRef(false)
  useEffect(() => {
    if (!user) { dataLoadedRef.current = false; return }
    if (dataLoadedRef.current) return
    dataLoadedRef.current = true

    async function syncFromDB() {
      const [pubComp, custComp, pubSkip, custSkip, ct] = await Promise.all([
        supabase.from('public_completions').select('task_id').eq('user_id', user!.id),
        supabase.from('custom_completions').select('task_id').eq('user_id', user!.id),
        supabase.from('public_skips').select('task_id').eq('user_id', user!.id),
        supabase.from('custom_skips').select('task_id').eq('user_id', user!.id),
        supabase.from('custom_tasks').select('*').eq('user_id', user!.id),
      ])

      if (pubComp.data) setCompletedPublic(prev => Array.from(new Set([...prev, ...pubComp.data!.map(r => r.task_id)])))
      if (custComp.data) setCompletedCustom(prev => Array.from(new Set([...prev, ...custComp.data!.map(r => r.task_id)])))
      if (pubSkip.data) setSkippedPublic(prev => Array.from(new Set([...prev, ...pubSkip.data!.map(r => r.task_id)])))
      if (custSkip.data) setSkippedCustom(prev => Array.from(new Set([...prev, ...custSkip.data!.map(r => r.task_id)])))
      if (ct.data) {
        setCustomTasks(prev => {
          const existing = new Set(prev.map(t => t.id))
          return [...prev, ...ct.data!.filter(task => !existing.has(task.id)).map(task => ({ id: task.id, content: task.content }))]
        })
      }
    }
    syncFromDB()
  }, [user])

  // Sync temp data when user logs in
  const syncTempToDBRef = useRef(false)
  useEffect(() => {
    if (!user || syncTempToDBRef.current) return
    syncTempToDBRef.current = true
    async function syncTempToDB() {
      // Sync temp custom tasks
      for (const ct of customTasks) {
        if (!ct.id.startsWith('temp_')) continue
        const { data } = await supabase.from('custom_tasks').insert({ user_id: user!.id, content: ct.content }).select().single()
        if (data) {
          setCustomTasks(prev => prev.map(t => t.id === ct.id ? { id: data.id, content: data.content } : t))
        }
      }
      // Sync temp completions
      for (const taskId of completedPublic) {
        await supabase.from('public_completions').upsert({ user_id: user!.id, task_id: taskId }, { onConflict: 'user_id,task_id' })
      }
      for (const taskId of completedCustom) {
        if (!taskId.startsWith('temp_')) {
          await supabase.from('custom_completions').upsert({ user_id: user!.id, task_id: taskId }, { onConflict: 'user_id,task_id' })
        }
      }
    }
    syncTempToDB()
  }, [user, customTasks, completedPublic, completedCustom])

  // Helper: get task text for display
  function getTaskText(taskId: string): string {
    if (customMode) {
      const ct = customTasks.find(t => t.id === taskId)
      return ct?.content || ''
    }
    const pt = publicTasks.find(t => t.id === taskId)
    if (!pt) return ''
    return lang === 'cn' ? pt.content_cn : pt.content_en
  }

  function getPool() {
    return customMode ? customTasks.map(t => t.id) : publicTasks.map(t => t.id)
  }
  function getCompleted() {
    return customMode ? completedCustom : completedPublic
  }
  function getSkipped() {
    return customMode ? skippedCustom : skippedPublic
  }

  function pickTask(excludeCurrent = false): string | null {
    const pool = getPool()
    const comp = getCompleted()
    let avail = pool.filter(id => !comp.includes(id))
    if (avail.length === 0) return null
    if (excludeCurrent && currentTaskId && avail.length > 1) {
      avail = avail.filter(id => id !== currentTaskId)
    }
    return avail[Math.floor(Math.random() * avail.length)]
  }

  // Boot animation
  function startBoot() {
    // Don't start if public tasks haven't loaded yet (unless in custom mode with local tasks)
    if (!customMode && !tasksLoaded) return
    if (customMode && customTasks.length === 0) return

    setScreen('boot')
    setBootText('')
    const lines = ['TERMINAL_OS v2.4.1', 'LOADING TASK_ENGINE...', 'CONNECTING TO EARTH_DB...', 'SIGNAL ACQUIRED ██████ OK', '', 'READY.']
    let i = 0
    let text = ''
    if (bootTimerRef.current) clearInterval(bootTimerRef.current)
    bootTimerRef.current = setInterval(() => {
      if (i < lines.length) {
        text += (text ? '\n' : '') + lines[i]
        setBootText(text)
        i++
      } else {
        clearInterval(bootTimerRef.current!)
        bootTimerRef.current = null
        setTimeout(() => {
          const pool = getPool()
          const comp = getCompleted()
          const avail = pool.filter(id => !comp.includes(id))
          if (avail.length === 0) {
            showCelebration()
          } else {
            const tid = avail[Math.floor(Math.random() * avail.length)]
            setCurrentTaskId(tid)
            setScreen('task')
            setHasPlayed(true)
          }
        }, 500)
      }
    }, 280)
  }

  // SKIP — optimistic: update UI instantly, sync DB in background
  function doSkip() {
    if (!currentTaskId || actionBusy) return
    setActionBusy(true)
    const taskId = currentTaskId
    const setSkipped = customMode ? setSkippedCustom : setSkippedPublic
    setSkipped(prev => prev.includes(taskId) ? prev : [...prev, taskId])
    const next = pickTask(true)
    if (next) setCurrentTaskId(next)
    setActionBusy(false)
    // DB sync in background
    if (user) {
      const table = customMode ? 'custom_skips' : 'public_skips'
      supabase.from(table).insert({ user_id: user.id, task_id: taskId }).then(() => {})
    }
  }

  // DONE — optimistic: update UI instantly, sync DB in background
  function doDone() {
    if (!currentTaskId || actionBusy) return
    setActionBusy(true)
    const taskId = currentTaskId
    const setComp = customMode ? setCompletedCustom : setCompletedPublic
    const setSkipped = customMode ? setSkippedCustom : setSkippedPublic

    // Optimistic UI update
    setComp(prev => prev.includes(taskId) ? prev : [...prev, taskId])
    setSkipped(prev => prev.filter(id => id !== taskId))

    // Rating prompt: trigger on the 10th total completion (once per day)
    const alreadyCountedHere = getCompleted().includes(taskId)
    const prevTotal = completedPublic.length + completedCustom.length
    const newTotal = alreadyCountedHere ? prevTotal : prevTotal + 1
    if (newTotal === 10) {
      setTimeout(() => maybeShowRatePrompt(), 400)
    }

    // Check remaining with updated data
    const pool = getPool()
    const updatedComp = [...getCompleted(), taskId]
    const remaining = pool.filter(id => !updatedComp.includes(id))
    if (remaining.length === 0) {
      showCelebration()
    } else {
      showNextMission()
    }
    setActionBusy(false)
    // DB sync in background
    if (user) {
      const compTable = customMode ? 'custom_completions' : 'public_completions'
      const skipTable = customMode ? 'custom_skips' : 'public_skips'
      supabase.from(compTable).upsert({ user_id: user.id, task_id: taskId }, { onConflict: 'user_id,task_id' }).then(() => {})
      supabase.from(skipTable).delete().eq('user_id', user.id).eq('task_id', taskId).then(() => {})
    }
  }

  function showNextMission() {
    setNextCritter(CRITTERS[Math.floor(Math.random() * CRITTERS.length)])
    setNextSub(NEXT_MISSION_SUBS[lang][Math.floor(Math.random() * NEXT_MISSION_SUBS[lang].length)])
    setNextBtnText(NEXT_MISSION_BTNS[lang][Math.floor(Math.random() * NEXT_MISSION_BTNS[lang].length)])
    setScreen('next')
  }

  function confirmNext() {
    const next = pickTask(false)
    if (next) {
      setCurrentTaskId(next)
      setScreen('task')
    }
  }

  // Celebration / Fireworks
  function showCelebration() {
    setScreen('celebrate')
    stopFireworks()
    setTimeout(() => startFireworks(), 300)
  }

  function startFireworks() {
    stopFireworks()
    const cvs = fwCanvasRef.current
    if (!cvs) return
    const canvas = cvs
    const ctx = canvas.getContext('2d')!
    fwRunIdRef.current++
    const myRunId = fwRunIdRef.current
    const particles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }[] = []
    let lastBurst = 0
    let lastFrame = 0
    const colors = ['#fde68a', '#fca5a5', '#86efac', '#7dd3fc', '#f9a8d4', '#c4b5fd', '#fdba74']

    function burst(ts: number) {
      const cx = 80 + Math.random() * 340
      const cy = 40 + Math.random() * 120
      const color = colors[Math.floor(Math.random() * colors.length)]
      const n = 24 + Math.floor(Math.random() * 12)
      for (let i = 0; i < n; i++) {
        const angle = (Math.PI * 2 * i) / n
        const speed = 1.2 + Math.random() * 1.8
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 60 + Math.random() * 30,
          maxLife: 60 + Math.random() * 30,
          color, size: 3 + Math.floor(Math.random() * 2),
        })
      }
      lastBurst = ts
    }

    function loop(ts: number) {
      if (myRunId !== fwRunIdRef.current) return
      if (lastFrame === 0) lastFrame = ts
      const dt = Math.min(50, ts - lastFrame)
      lastFrame = ts
      const step = dt / 16.67

      ctx.fillStyle = 'rgba(34,53,61,0.25)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (ts - lastBurst > 500 + Math.random() * 400) burst(ts)

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx * step
        p.y += p.vy * step
        p.vy += 0.05 * step
        p.life -= step
        if (p.life <= 0) { particles.splice(i, 1); continue }
        const alpha = p.life / p.maxLife
        ctx.fillStyle = p.color
        ctx.globalAlpha = alpha
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size)
        ctx.globalAlpha = alpha * 0.3
        ctx.fillRect(Math.floor(p.x) - 1, Math.floor(p.y) - 1, p.size + 2, p.size + 2)
      }
      ctx.globalAlpha = 1
      fwAnimRef.current = requestAnimationFrame(loop)
    }

    burst(0)
    fwAnimRef.current = requestAnimationFrame(loop)
  }

  function stopFireworks() {
    fwRunIdRef.current++
    if (fwAnimRef.current) {
      cancelAnimationFrame(fwAnimRef.current)
      fwAnimRef.current = null
    }
    const canvas = fwCanvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  function goCelebHome() { stopFireworks(); setScreen('home') }
  function goCelebProgress() { stopFireworks(); setScreen('progress') }
  function playAgain() {
    stopFireworks()
    if (customMode) {
      setCompletedCustom([])
      setSkippedCustom([])
      if (user) {
        supabase.from('custom_completions').delete().eq('user_id', user.id).then(() => {})
        supabase.from('custom_skips').delete().eq('user_id', user.id).then(() => {})
      }
    } else {
      setCompletedPublic([])
      setSkippedPublic([])
      if (user) {
        supabase.from('public_completions').delete().eq('user_id', user.id).then(() => {})
        supabase.from('public_skips').delete().eq('user_id', user.id).then(() => {})
      }
    }
    setCurrentTaskId(null)
    startBoot()
  }

  // Custom tasks — optimistic + debounce
  function custSave() {
    const v = custInput.trim()
    if (!v || savingCust) return
    if (customTasks.some(t => t.content === v)) { setCustInput(''); return }

    setSavingCust(true)
    const tempId = 'temp_' + Date.now() + '_' + Math.random()
    // Optimistic: add to list immediately
    setCustomTasks(prev => [...prev, { id: tempId, content: v }])
    setCustInput('')

    if (user) {
      // Replace temp with real ID in background
      supabase.from('custom_tasks').insert({ user_id: user.id, content: v }).select().single().then(({ data }) => {
        if (data) {
          setCustomTasks(prev => prev.map(t => t.id === tempId ? { id: data.id, content: data.content } : t))
        }
        setSavingCust(false)
      })
    } else {
      setSavingCust(false)
    }
  }

  async function custRemove(id: string) {
    setCustomTasks(prev => prev.filter(t => t.id !== id))
    if (user && !id.startsWith('temp_')) {
      await supabase.from('custom_tasks').delete().eq('id', id).eq('user_id', user.id)
    }
  }

  function custDone() {
    const v = custInput.trim()
    if (v && !customTasks.some(t => t.content === v)) {
      if (user) {
        supabase.from('custom_tasks').insert({ user_id: user.id, content: v }).select().single().then(({ data }) => {
          if (data) setCustomTasks(prev => [...prev, { id: data.id, content: data.content }])
        })
      } else {
        setCustomTasks(prev => [...prev, { id: 'temp_' + Date.now(), content: v }])
      }
      setCustInput('')
    }
    startBoot()
  }

  function toggleCustom() {
    setCustomMode(prev => !prev)
    setCurrentTaskId(null)
  }

  // Progress
  function getProgressData() {
    const pool = getPool()
    const comp = getCompleted()
    const sk = getSkipped()
    const total = pool.length
    const done = pool.filter(id => comp.includes(id)).length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return { total, done, remaining: total - done, skipped: sk.length, pct }
  }

  function backToTask() {
    if (!hasPlayed) { setScreen('home'); return }
    const pool = getPool()
    const comp = getCompleted()
    const remaining = pool.filter(id => !comp.includes(id))
    if (remaining.length === 0) { showCelebration(); return }
    if (!currentTaskId || comp.includes(currentTaskId)) {
      const next = remaining[Math.floor(Math.random() * remaining.length)]
      setCurrentTaskId(next)
    }
    setScreen('task')
  }

  // Offer
  async function sendOffer() {
    const subjectEl = document.getElementById('offerSubject') as HTMLInputElement
    const descEl = document.getElementById('offerDesc') as HTMLTextAreaElement
    const subject = subjectEl?.value?.trim()
    if (!subject) return

    setOfferFlying(true)
    setTimeout(async () => {
      setOfferFlying(false)
      setOfferSent(true)

      // Detect language
      const isChinese = /[\u4e00-\u9fff]/.test(subject)
      await supabase.from('pending_tasks').insert({
        user_id: user?.id || null,
        content: subject,
        description: descEl?.value?.trim() || null,
        submitted_language: isChinese ? 'cn' : 'en',
      })

      subjectEl.value = ''
      descEl.value = ''
      setTimeout(() => setOfferSent(false), 2500)
    }, 1200)
  }

  // Auth
  async function doAuth() {
    const emailEl = document.getElementById('authEmail') as HTMLInputElement
    const pwEl = document.getElementById('authPw') as HTMLInputElement
    const email = emailEl?.value?.trim()
    const pw = pwEl?.value?.trim()

    if (!email || !pw) { setAuthMsg(t('fa')); setAuthMsgColor('#f87171'); return }
    if (!email.includes('@')) { setAuthMsg(t('be')); setAuthMsgColor('#f87171'); return }
    if (pw.length < 6) { setAuthMsg(t('sp')); setAuthMsgColor('#f87171'); return }

    if (authMode === 'rg') {
      const userEl = document.getElementById('authUser') as HTMLInputElement
      const username = userEl?.value?.trim()
      if (!username) { setAuthMsg(t('nn')); setAuthMsgColor('#f87171'); return }

      setAuthMsg(lang === 'en' ? 'Registering...' : '注册中...')
      setAuthMsgColor('rgba(255,255,255,.5)')
      const { error } = await supabase.auth.signUp({
        email,
        password: pw,
        options: {
          data: { username },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setAuthMsg(error.message)
        setAuthMsgColor('#f87171')
      } else {
        setAuthMsg(lang === 'en'
          ? `✉ Verification email sent to ${email}. Please check your inbox (and spam folder) and click the link to complete registration.`
          : `✉ 验证邮件已发送到 ${email}。请查看收件箱（以及垃圾邮件），点击链接完成注册。`)
        setAuthMsgColor('#4ade80')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
      if (error) {
        setAuthMsg(error.message)
        setAuthMsgColor('#f87171')
      } else {
        setAuthMsg(t('lo'))
        setAuthMsgColor('#4ade80')
        setTimeout(() => setScreen('home'), 1000)
      }
    }
  }

  async function doSignOut() {
    await supabase.auth.signOut()
    setUser(null)
    setShowUserMenu(false)
    // Reset to session-only state
    setCompletedPublic([])
    setCompletedCustom([])
    setSkippedPublic([])
    setSkippedCustom([])
    setCustomTasks([])
    setCurrentTaskId(null)
    setHasPlayed(false)
  }

  async function doForgotPassword() {
    if (!forgotEmail.includes('@')) return
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })
    setAuthMsg(t('resetSent'))
    setAuthMsgColor('#4ade80')
    setShowForgot(false)
  }

  // ═══ JOURNAL / RATINGS ═══
  const loadRatings = useCallback(async (y: number, m: number) => {
    setJLoading(true)
    const data = await fetchMonthRatings(user?.id || null, y, m)
    setJRatings(data)
    setJLoading(false)
  }, [user])

  function openJournal() {
    setScreen('journal')
    loadRatings(jViewYear, jViewMonth)
  }

  function jMonthChange(delta: number) {
    const t2 = new Date()
    const isCurrentMonth = jViewYear === t2.getFullYear() && jViewMonth === t2.getMonth()
    if (delta > 0 && isCurrentMonth) return
    let y = jViewYear
    let m = jViewMonth + delta
    if (m > 11) { m = 0; y++ }
    else if (m < 0) { m = 11; y-- }
    setJViewYear(y)
    setJViewMonth(m)
    loadRatings(y, m)
  }

  function openDetail(ds: string) {
    setDCurrentDate(ds)
    const r = jRatings[ds]
    setDCurrentStars(r?.stars || 0)
    setDComment(r?.comment || '')
    setDAuthMsg(null)
    setScreen('detail')
  }

  async function dSave() {
    if (!dCurrentDate) return
    if (dCurrentStars === 0) {
      setDAuthMsg({ key: 'dPickRating', color: '#f87171' })
      return
    }
    if (!user) {
      setDAuthMsg({ key: 'dSignIn', color: '#f87171' })
      return
    }
    const ok = await upsertRating(user.id, dCurrentDate, dCurrentStars, dComment)
    if (ok) {
      setJRatings(prev => ({
        ...prev,
        [dCurrentDate]: { date: dCurrentDate, stars: dCurrentStars, comment: dComment },
      }))
      setDAuthMsg({ key: 'dSaved', color: '#4ade80' })
      setTimeout(() => setDAuthMsg(null), 2000)
    } else {
      setDAuthMsg({ key: 'dFailed', color: '#f87171' })
    }
  }

  // Rating prompt modal
  function maybeShowRatePrompt() {
    const key = 'rating_prompted_' + todayStr()
    if (typeof window === 'undefined') return
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    setRatePromptOpen(true)
  }
  function rateClose() { setRatePromptOpen(false) }
  function rateAccept() {
    setRatePromptOpen(false)
    // Ensure we have the current month's ratings loaded for the detail save path
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const d = todayStr()
    setJViewYear(y)
    setJViewMonth(m)
    loadRatings(y, m)
    openDetail(d)
  }

  // Stat list items
  function getStatItems() {
    const pool = getPool()
    const comp = getCompleted()
    const sk = getSkipped()
    if (statListType === 'done') return comp
    if (statListType === 'remaining') return pool.filter(id => !comp.includes(id))
    return sk
  }

  function statColor() {
    if (statListType === 'done') return 'rgba(74,222,128,.7)'
    if (statListType === 'remaining') return 'rgba(255,255,255,.6)'
    return 'rgba(250,204,21,.6)'
  }

  // ═══════════ RENDER ═══════════
  const prog = getProgressData()

  return (
    <>
      <Clouds />
      <div className="crt1" />
      <div className="crt2" />

      {/* VERIFIED BANNER */}
      {verifiedBanner && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', padding: '12px 0', background: 'rgba(74,222,128,.2)', borderBottom: '1px solid rgba(74,222,128,.4)', textAlign: 'center', zIndex: 300, fontSize: 14, color: '#4ade80', fontWeight: 600, letterSpacing: '.05em' }}>
          {lang === 'en' ? '✓ Email verified! You can now sign in.' : '✓ 邮箱验证成功！请登录。'}
        </div>
      )}

      {/* HEADER */}
      <div className="hdr" style={{ position: 'fixed', top: 0, left: 0, width: '100%', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 }}>
        <div
          className="hdr-logo"
          style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.03em', color: 'rgba(255,255,255,.9)', cursor: 'pointer' }}
          onClick={() => { stopFireworks(); setScreen('home') }}
        >
          HOME
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            className="hdr-lang"
            onClick={() => setLang(lang === 'en' ? 'cn' : 'en')}
            style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', color: '#fff', cursor: 'pointer', padding: '5px 14px', border: '2px solid rgba(255,255,255,.6)', background: 'rgba(255,255,255,.15)', transition: 'all .15s' }}
          >
            {lang === 'en' ? 'EN' : '中文'}
          </div>
          <div
            className="bubble-btn"
            onClick={() => openJournal()}
            title={t('jrnTip')}
            aria-label={t('jrnTip')}
          >
            <img src={BUBBLE_ICON_B64} alt="Journal" width={24} height={24} />
          </div>
          {user ? (
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="hdr-user"
                style={{ fontSize: 18, fontWeight: 700, letterSpacing: '.15em', cursor: 'pointer' }}
              >
                {user.username.toUpperCase()}
              </div>
              {showUserMenu && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, background: '#22353d', border: '2px solid rgba(255,255,255,.3)', padding: '8px 16px', cursor: 'pointer', whiteSpace: 'nowrap', zIndex: 999 }} onClick={doSignOut}>
                  {t('signOut')}
                </div>
              )}
            </div>
          ) : (
            <div
              className="hdr-user"
              onClick={() => { setAuthMsg(''); setScreen('signin') }}
              style={{ fontSize: 18, fontWeight: 700, letterSpacing: '.15em', cursor: 'pointer' }}
            >
              {t('signIn')}
            </div>
          )}
        </div>
      </div>

      {/* ═══ HOME ═══ */}
      {screen === 'home' && (
        <div className="screen">
          <div className="home-title" style={{ fontSize: 'clamp(80px, 12vw, 144px)', fontWeight: 700, lineHeight: .85, letterSpacing: '-.04em', textAlign: 'center', marginBottom: 52, textShadow: '4px 4px 12px rgba(0,0,0,.5), 0 0 40px rgba(0,0,0,.2)' }}>
            EARTH<br />ONLINE
          </div>
          <div className="enter-group" onClick={startBoot} style={{ opacity: (!customMode && !tasksLoaded) ? 0.4 : 1, pointerEvents: (!customMode && !tasksLoaded) ? 'none' : 'auto' }}>
            <div className="enter-rodent" style={{ position: 'absolute', top: -36, right: 16 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, fontVariationSettings: "'FILL' 1" }}>pest_control_rodent</span>
            </div>
            <div className="enter-btn pxb" style={{ color: '#fff', padding: '20px 72px', fontSize: 28, fontWeight: 700, letterSpacing: '.2em', fontFamily: 'inherit' }}>
              {(!customMode && !tasksLoaded) ? '...' : 'ENTER'}
            </div>
          </div>
          <Tags lang={lang} onNavigate={setScreen} />
        </div>
      )}

      {/* ═══ BOOT ═══ */}
      {screen === 'boot' && (
        <div className="screen">
          <Monitor>
            <div style={{ justifyContent: 'flex-start', alignItems: 'flex-start', paddingTop: 32, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <pre style={{ color: 'rgba(74,222,128,.8)', fontSize: 14, fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.8, textShadow: '0 0 6px rgba(74,222,128,.3)', zIndex: 3 }}>{bootText}</pre>
              <span style={{ display: 'inline-block', width: 10, height: 16, background: 'rgba(74,222,128,.7)', marginLeft: 4, animation: 'blink 1s step-end infinite', zIndex: 3 }} />
            </div>
          </Monitor>
        </div>
      )}

      {/* ═══ TASK ═══ */}
      {screen === 'task' && (
        <div className="screen">
          <Monitor>
            <div className="task-text" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.6, marginBottom: 40, zIndex: 3, textShadow: '2px 2px 0 #000', maxWidth: 400 }}>
              {currentTaskId ? getTaskText(currentTaskId) : ''}
            </div>
            <div style={{ display: 'flex', gap: 28, zIndex: 3 }}>
              <button className="bo" onClick={doSkip}>
                <span style={{ position: 'relative', zIndex: 10, fontSize: 14, letterSpacing: '.15em' }}>[ {t('sk')} ]</span>
              </button>
              <button className="bs" onClick={doDone}>
                <span style={{ position: 'relative', zIndex: 10, fontSize: 14, letterSpacing: '.15em' }}>[ {t('dn')} ]</span>
              </button>
            </div>
          </Monitor>
          <Tags lang={lang} onNavigate={setScreen} />
        </div>
      )}

      {/* ═══ NEXT MISSION ═══ */}
      {screen === 'next' && (
        <div className="screen">
          <Monitor>
            <div style={{ marginBottom: 16, zIndex: 3, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              dangerouslySetInnerHTML={{ __html: nextCritter }} />
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '.15em', marginBottom: 12, zIndex: 3, textShadow: '2px 2px 0 #000' }}>
              {lang === 'en' ? 'NEXT MISSION' : '下一个任务'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '.1em', marginBottom: 32, zIndex: 3 }}>
              {nextSub}
            </div>
            <div style={{ zIndex: 3 }}>
              <button className="bs" onClick={confirmNext} style={{ padding: '12px 36px', fontSize: 14 }}>
                [ {nextBtnText} ]
              </button>
            </div>
          </Monitor>
          <Tags lang={lang} onNavigate={setScreen} />
        </div>
      )}

      {/* ═══ CELEBRATION ═══ */}
      {screen === 'celebrate' && (
        <div className="screen">
          <Monitor>
            <canvas ref={fwCanvasRef} width={500} height={320} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 3, pointerEvents: 'none' }} />
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '.15em', marginBottom: 16, zIndex: 4, textShadow: '3px 3px 0 #000', color: '#fde68a' }}>
              {lang === 'en' ? 'CONGRATULATIONS!' : '恭喜！'}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', letterSpacing: '.05em', marginBottom: 28, zIndex: 4, textAlign: 'center', textShadow: '2px 2px 0 #000', maxWidth: 380, lineHeight: 1.6 }}>
              {CELEB_MSGS[lang]}
            </div>
            <div style={{ zIndex: 4, display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="bo" onClick={goCelebHome}>[ HOME ]</button>
              <button className="bs" onClick={playAgain}>[ {t('pa')} ]</button>
              <button className="bo" onClick={goCelebProgress}>[ {t('tagP')} ]</button>
            </div>
          </Monitor>
          <Tags lang={lang} onNavigate={setScreen} />
        </div>
      )}

      {/* ═══ CUSTOMIZE ═══ */}
      {screen === 'customize' && (
        <div className="screen">
          <Monitor>
            <div style={{ justifyContent: 'flex-start', padding: '20px 24px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', zIndex: 3, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', letterSpacing: '.2em', fontWeight: 700, textShadow: '2px 2px 0 #000' }}>
                  {t('ct')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, zIndex: 3 }}>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', letterSpacing: '.12em', fontWeight: 700 }}>
                    {customMode ? t('ton') : t('tof')}
                  </span>
                  <div className={`tg${customMode ? ' on' : ''}`} onClick={toggleCustom} />
                </div>
              </div>
              <div style={{ zIndex: 3, width: '100%', flex: 1, overflowY: 'auto', textAlign: 'left', minHeight: 0, marginBottom: 12 }}>
                {customTasks.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,.2)', fontSize: 14, textAlign: 'center', marginTop: 36 }}>
                    {t('nc')}<br /><span style={{ fontSize: 10 }}>{t('tb')}</span>
                  </div>
                ) : (
                  customTasks.map((ct, i) => (
                    <div key={ct.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.1)' }}
                      onMouseEnter={e => { const x = e.currentTarget.lastElementChild as HTMLElement; if (x) x.style.opacity = '1' }}
                      onMouseLeave={e => { const x = e.currentTarget.lastElementChild as HTMLElement; if (x) x.style.opacity = '0' }}
                    >
                      <span style={{ color: 'rgba(255,255,255,.3)', fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,.8)', fontSize: 13, flex: 1 }}>{ct.content}</span>
                      {completedCustom.includes(ct.id) && <span style={{ color: 'rgba(74,222,128,.5)', fontSize: 12 }}>OK</span>}
                      <span onClick={() => custRemove(ct.id)} style={{ color: 'rgba(255,255,255,.2)', fontSize: 12, cursor: 'pointer', opacity: 0, transition: 'opacity .2s' }}>X</span>
                    </div>
                  ))
                )}
              </div>
              {!user && (
                <div style={{ zIndex: 3, fontSize: 10, color: 'rgba(255,255,255,.3)', textAlign: 'center', marginBottom: 4 }}>
                  {t('loginToSave')}
                </div>
              )}
              <div style={{ zIndex: 3, display: 'flex', gap: 10, alignItems: 'flex-end', width: '100%' }}>
                <input
                  className="inp" value={custInput}
                  onChange={e => setCustInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && custSave()}
                  placeholder={t('ph')}
                  style={{ flex: 1, fontSize: 14 }}
                  autoFocus
                />
                <button className="bo" onClick={custSave} style={{ padding: '6px 16px', fontSize: 12, whiteSpace: 'nowrap' }}>[ {t('save')} ]</button>
              </div>
              <div style={{ zIndex: 3, marginTop: 14, textAlign: 'center' }}>
                <button className="bs" onClick={custDone} style={{ padding: '8px 28px' }}>[ {t('done')} ]</button>
              </div>
            </div>
          </Monitor>
          <Tags lang={lang} onNavigate={setScreen} active="customize" />
        </div>
      )}

      {/* ═══ PROGRESS ═══ */}
      {screen === 'progress' && (
        <div className="screen" data-screen="progress">
          <Monitor>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', letterSpacing: '.2em', fontWeight: 700, marginBottom: 20, zIndex: 3, textShadow: '2px 2px 0 #000' }}>
              {t('pt')}
            </div>
            <div className="prog-pct" style={{ fontSize: 52, fontWeight: 900, marginBottom: 20, zIndex: 3, textShadow: '3px 3px 0 rgba(0,0,0,.4)' }}>
              {prog.pct}%
            </div>
            <div style={{ width: '100%', maxWidth: 380, height: 22, border: '2px solid rgba(255,255,255,.3)', position: 'relative', zIndex: 3 }}>
              <div style={{ height: '100%', background: '#4ade80', width: `${prog.pct}%`, transition: 'width .5s', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.2)' }} />
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(90deg, rgba(0,0,0,.15) 1px, transparent 1px)', backgroundSize: '10px 100%', pointerEvents: 'none' }} />
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', letterSpacing: '.15em', fontWeight: 700, marginTop: 8, zIndex: 3 }}>
              {customMode ? t('pmC') : t('pm')}
            </div>
            <div style={{ display: 'flex', gap: 40, marginTop: 16, zIndex: 3 }}>
              <div className="stat" onClick={() => { setStatListType('done'); setScreen('statlist') }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(74,222,128,.7)', textShadow: '2px 2px 0 #000' }}>{prog.done}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', letterSpacing: '.12em', fontWeight: 700, marginTop: 4 }}>DONE</div>
              </div>
              <div className="stat" onClick={() => { setStatListType('remaining'); setScreen('statlist') }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,.5)', textShadow: '2px 2px 0 #000' }}>{prog.remaining}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', letterSpacing: '.12em', fontWeight: 700, marginTop: 4 }}>REMAINING</div>
              </div>
              <div className="stat" onClick={() => { setStatListType('skipped'); setScreen('statlist') }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(250,204,21,.6)', textShadow: '2px 2px 0 #000' }}>{prog.skipped}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', letterSpacing: '.12em', fontWeight: 700, marginTop: 4 }}>SKIPPED</div>
              </div>
            </div>
            <div style={{ zIndex: 3, marginTop: 14 }}>
              <button className="bo" onClick={backToTask} style={{ padding: '6px 20px', fontSize: 12 }}>[ {t('back')} ]</button>
            </div>
          </Monitor>
          <Tags lang={lang} onNavigate={setScreen} active="progress" />
        </div>
      )}

      {/* ═══ STAT LIST ═══ */}
      {screen === 'statlist' && (
        <div className="screen">
          <Monitor>
            <div style={{ justifyContent: 'flex-start', padding: '20px 24px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', letterSpacing: '.2em', fontWeight: 700, marginBottom: 12, zIndex: 3, textShadow: '2px 2px 0 #000' }}>
                {statListType === 'done' ? t('cm') : statListType === 'remaining' ? t('rm') : t('sm')}
              </div>
              <div style={{ zIndex: 3, width: '100%', flex: 1, overflowY: 'auto', textAlign: 'left', minHeight: 0, marginBottom: 12 }}>
                {getStatItems().length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,.2)', fontSize: 14, textAlign: 'center', marginTop: 36 }}>{t('em')}</div>
                ) : (
                  getStatItems().map((id, i) => (
                    <div key={id + i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
                      <span style={{ color: 'rgba(255,255,255,.3)', fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span style={{ color: statColor(), fontSize: 13 }}>
                        {getTaskText(id)}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <button className="bo" onClick={() => setScreen('progress')} style={{ zIndex: 3, padding: '6px 20px', fontSize: 12 }}>
                [ {t('back')} ]
              </button>
            </div>
          </Monitor>
        </div>
      )}

      {/* ═══ OFFER ═══ */}
      {screen === 'offer' && (
        <div className="screen">
          <Monitor>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', letterSpacing: '.2em', fontWeight: 700, marginBottom: 16, zIndex: 3, textShadow: '2px 2px 0 #000' }}>
              {t('ot')}
            </div>
            <div className="email-box">
              <div className="email-to">{t('to')}</div>
              <input className="email-subject" id="offerSubject" type="text" placeholder={t('op')} autoFocus />
              <textarea className="email-body" id="offerDesc" placeholder={t('od')} />
              <div className="send-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <button className="bo" onClick={backToTask} style={{ padding: '5px 14px', fontSize: 11 }}>[ {t('back')} ]</button>
                <button className="send-btn" onClick={sendOffer}>{t('send')} <span style={{ fontSize: 16 }}>✈</span></button>
              </div>
            </div>
            <div className={`plane${offerFlying ? ' fly' : ''}`} style={{ left: '55%', top: '40%', fontSize: 22 }}>✈</div>
            <div style={{ zIndex: 3, fontSize: 13, marginTop: 12, height: 20 }}>
              {offerSent && <span className="sent" style={{ color: '#4ade80' }}>{t('os')}</span>}
            </div>
          </Monitor>
          <Tags lang={lang} onNavigate={setScreen} active="offer" />
        </div>
      )}

      {/* ═══ SIGN IN ═══ */}
      {screen === 'signin' && (
        <div className="screen" data-screen="signin">
          <Monitor>
            {showForgot ? (
              <div style={{ zIndex: 3, width: '100%', maxWidth: 320 }}>
                <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '.15em', marginBottom: 20, color: 'rgba(255,255,255,.9)' }}>
                  {t('forgotPw')}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', textAlign: 'left', fontSize: 10, color: 'rgba(255,255,255,.4)', letterSpacing: '.15em', fontWeight: 700, marginBottom: 5 }}>{t('email')}</label>
                  <input className="inp" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} type="email" placeholder="your@email.com" />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="bo" onClick={() => setShowForgot(false)} style={{ fontSize: 12 }}>[ {t('back')} ]</button>
                  <button className="bs" onClick={doForgotPassword}>{t('send')}</button>
                </div>
                {authMsg && <div style={{ fontSize: 12, marginTop: 10, color: authMsgColor }}>{authMsg}</div>}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 28, marginBottom: 24, zIndex: 3 }}>
                  <button className={`auth-tab${authMode === 'si' ? ' on' : ''}`} onClick={() => { setAuthMode('si'); setAuthMsg('') }}>{t('signIn')}</button>
                  <button className={`auth-tab${authMode === 'rg' ? ' on' : ''}`} onClick={() => { setAuthMode('rg'); setAuthMsg('') }}>{t('register')}</button>
                </div>
                <div style={{ width: '100%', maxWidth: 320, zIndex: 3 }}>
                  {authMode === 'rg' && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: 'block', textAlign: 'left', fontSize: 10, color: 'rgba(255,255,255,.4)', letterSpacing: '.15em', fontWeight: 700, marginBottom: 5 }}>{t('username')}</label>
                      <input className="inp" id="authUser" type="text" placeholder="your_name" />
                    </div>
                  )}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', textAlign: 'left', fontSize: 10, color: 'rgba(255,255,255,.4)', letterSpacing: '.15em', fontWeight: 700, marginBottom: 5 }}>{t('email')}</label>
                    <input className="inp" id="authEmail" type="email" placeholder="your@email.com" />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: 'block', textAlign: 'left', fontSize: 10, color: 'rgba(255,255,255,.4)', letterSpacing: '.15em', fontWeight: 700, marginBottom: 5 }}>{t('password')}</label>
                    <div style={{ position: 'relative' }}>
                      <input className="inp" id="authPw" type={showPw ? 'text' : 'password'} placeholder="........" style={{ paddingRight: 32 }} />
                      <span
                        onClick={() => setShowPw(!showPw)}
                        className="material-symbols-outlined"
                        style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'rgba(255,255,255,.3)', cursor: 'pointer', userSelect: 'none' }}
                      >
                        {showPw ? 'visibility' : 'visibility_off'}
                      </span>
                    </div>
                  </div>
                  {authMsg && <div style={{ fontSize: 12, minHeight: 20, marginBottom: 10, color: authMsgColor, lineHeight: 1.5, textAlign: 'center' }}>{authMsg}</div>}
                  {authMode === 'si' && (
                    <div style={{ textAlign: 'right', marginBottom: 10 }}>
                      <span onClick={() => setShowForgot(true)} style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.15)' }}>
                        {t('forgotPw')}
                      </span>
                    </div>
                  )}
                </div>
                <button className="bs" onClick={doAuth} style={{ zIndex: 3 }}>[ {t('enter')} ]</button>
              </>
            )}
          </Monitor>
        </div>
      )}

      {/* ═══ JOURNAL (month calendar) ═══ */}
      {screen === 'journal' && (() => {
        const todayD = new Date()
        const isCurrentMonth = jViewYear === todayD.getFullYear() && jViewMonth === todayD.getMonth()
        const firstDay = new Date(jViewYear, jViewMonth, 1)
        const firstWeekday = firstDay.getDay() // 0=Sun
        const blanksBefore = (firstWeekday + 6) % 7 // Mon-first
        const daysInMonth = new Date(jViewYear, jViewMonth + 1, 0).getDate()

        let goodCount = 0
        let badCount = 0
        const cells: React.ReactNode[] = []
        for (let i = 0; i < blanksBefore; i++) {
          cells.push(<div key={'b' + i} className="day blank" />)
        }
        for (let d = 1; d <= daysInMonth; d++) {
          const ds = dateStr(jViewYear, jViewMonth, d)
          const classes: string[] = ['day']
          if (isToday(ds)) classes.push('today')
          const isFut = isFuture(ds)
          if (isFut) classes.push('future')
          const r = jRatings[ds]
          const n = r ? r.stars : 0
          if (!isFut) {
            if (n >= 4) goodCount++
            else if (n >= 1 && n <= 2) badCount++
          }
          const starEls = isFut ? (
            <span style={{ color: 'rgba(255,255,255,.06)' }}>{'\u2605\u2605\u2605\u2605\u2605'}</span>
          ) : (
            <>
              <span style={{ color: '#fde68a' }}>{'\u2605'.repeat(n)}</span>
              <span style={{ color: 'rgba(255,255,255,.15)' }}>{'\u2605'.repeat(5 - n)}</span>
            </>
          )
          cells.push(
            <div
              key={ds}
              className={classes.join(' ')}
              onClick={isFut ? undefined : () => openDetail(ds)}
            >
              <span className="dn">{d}</span>
              <span className="stars">{starEls}</span>
            </div>
          )
        }

        return (
          <div className="screen" data-screen="journal">
            <Monitor>
              <div style={{ justifyContent: 'flex-start', padding: '18px 24px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div className="jnav">
                  <span
                    onClick={() => jMonthChange(-1)}
                  >
                    {t('jrnPrev')}
                  </span>
                  <span className="mid">
                    {JRN_MONTHS[lang][jViewMonth] + ' ' + jViewYear}
                  </span>
                  <span
                    className={isCurrentMonth ? 'dis' : ''}
                    onClick={isCurrentMonth ? undefined : () => jMonthChange(1)}
                  >
                    {t('jrnNext')}
                  </span>
                </div>
                <div className="wdays">
                  {JRN_WDAYS[lang].map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </div>
                <div className="cal-wrap">
                  <div className="cal">
                    {cells}
                  </div>
                </div>
                <div className="jstats">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="face good">{'\u263A\uFE0E'}</span>
                    <span className="num">{goodCount}</span>
                  </div>
                  <span className="sep">·</span>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="face bad">{'\u2639\uFE0E'}</span>
                    <span className="num">{badCount}</span>
                  </div>
                </div>
                {jLoading && (
                  <div style={{ position: 'absolute', bottom: 8, left: 12, fontSize: 9, color: 'rgba(255,255,255,.3)', letterSpacing: '.1em', zIndex: 3 }}>
                    loading...
                  </div>
                )}
              </div>
            </Monitor>
            <Tags lang={lang} onNavigate={setScreen} />
          </div>
        )
      })()}

      {/* ═══ DAY DETAIL ═══ */}
      {screen === 'detail' && dCurrentDate && (() => {
        const parts = dCurrentDate.split('-')
        const y = +parts[0]
        const m = +parts[1] - 1
        const d = +parts[2]
        const editable = isToday(dCurrentDate)
        const titleText = lang === 'en'
          ? JRN_MONTHS[lang][m] + ' ' + d
          : JRN_MONTHS[lang][m] + d + '日'

        return (
          <div className="screen" data-screen="detail">
            <Monitor>
              <div style={{ justifyContent: 'flex-start', padding: '18px 24px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div className="detail-back">
                  <button className="bo" onClick={() => setScreen('journal')} style={{ padding: '5px 14px', fontSize: 10 }}>
                    [ {t('back')} ]
                  </button>
                </div>
                <div className="dtitle" style={{ marginTop: 18 }}>{titleText}</div>
                <div className={`big-stars${editable ? '' : ' ro'}`}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <span
                      key={n}
                      className={n <= dCurrentStars ? 'fill' : 'empty'}
                      onClick={editable ? () => setDCurrentStars(n) : undefined}
                    >
                      {'\u2605'}
                    </span>
                  ))}
                </div>
                <textarea
                  className="cmt"
                  maxLength={100}
                  placeholder={t('cmtPh')}
                  value={dComment}
                  onChange={e => setDComment(e.target.value)}
                  readOnly={!editable}
                />
                <div className="cmt-count">{dComment.length} / 100</div>
                <div style={{ fontSize: 11, height: 16, textAlign: 'center', marginTop: 8, zIndex: 3, color: dAuthMsg?.color || 'transparent' }}>
                  {dAuthMsg ? t(dAuthMsg.key) : ' '}
                </div>
                {editable && (
                  <div className="save-wrap">
                    <button className="bs" onClick={dSave} style={{ padding: '8px 28px' }}>
                      [ {t('save')} ]
                    </button>
                  </div>
                )}
                {!editable && (
                  <div className="lock-hint">{t('dLock')}</div>
                )}
              </div>
            </Monitor>
            <Tags lang={lang} onNavigate={setScreen} />
          </div>
        )
      })()}

      {/* ═══ RATING PROMPT MODAL ═══ */}
      <div className={`rate-overlay${ratePromptOpen ? ' on' : ''}`}>
        <div className="rate-modal">
          <img src={EARTH_ICON_B64} alt="Earth" width={72} height={72} />
          <div className="rate-title">{t('rateT')}</div>
          <div className="rate-sub">{t('rateS')}</div>
          <div className="rate-btns">
            <button className="bo" onClick={rateClose}>[ {t('rateL')} ]</button>
            <button className="bs" onClick={rateAccept}>[ {t('rateOk')} ]</button>
          </div>
        </div>
      </div>
    </>
  )
}
