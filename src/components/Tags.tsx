'use client'
import { TX } from '@/lib/translations'

interface TagsProps {
  lang: string
  onNavigate: (screen: string) => void
  active?: string
}

export default function Tags({ lang, onNavigate, active }: TagsProps) {
  const t = (k: string) => TX[lang]?.[k] || k
  return (
    <div className="tags-wrap" style={{ display: 'flex', gap: 16, marginTop: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
      <div
        className="tag"
        style={{ background: 'rgba(86,98,82,.35)' }}
        onClick={active !== 'customize' ? () => onNavigate('customize') : undefined}
      >
        {t('tagC')}
      </div>
      <div
        className="tag"
        style={{ background: 'rgba(72,97,119,.35)' }}
        onClick={active !== 'progress' ? () => onNavigate('progress') : undefined}
      >
        {t('tagP')}
      </div>
      <div
        className="tag"
        style={{ background: 'rgba(105,92,89,.35)' }}
        onClick={active !== 'offer' ? () => onNavigate('offer') : undefined}
      >
        {t('tagO')}
      </div>
    </div>
  )
}
