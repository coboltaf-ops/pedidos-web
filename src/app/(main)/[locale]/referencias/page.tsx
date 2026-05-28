import { getTranslations } from 'next-intl/server'
import { ReferenciasManager } from '@/features/referencias/components/referencias-manager'

export default async function ReferenciasPage() {
  const t = await getTranslations('pages')
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">{t('referencias')}</h1>
      <ReferenciasManager />
    </div>
  )
}
