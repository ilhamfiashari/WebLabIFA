import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '../shared/i18n'

export function Pagination({
  totalItems,
  page,
  pageSize = 10,
  onPageChange,
}: {
  totalItems: number
  page: number
  pageSize?: number
  onPageChange: (nextPage: number) => void
}) {
  const { lang } = useI18n()
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(totalItems, safePage * pageSize)

  if (totalItems === 0) return null

  return (
    <div className="pagination-bar" role="navigation" aria-label={lang === 'en' ? 'Table pagination' : 'Navigasi halaman tabel'}>
      <span>
        {lang === 'en'
          ? `Showing ${start}–${end} of ${totalItems} entries (Page ${safePage} of ${totalPages})`
          : `Menampilkan ${start}–${end} dari ${totalItems} data (Halaman ${safePage} dari ${totalPages})`}
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="btn-outline"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label={lang === 'en' ? 'Previous page' : 'Halaman sebelumnya'}
        >
          <ChevronLeft size={14} aria-hidden="true" />
          {lang === 'en' ? 'Prev' : 'Sebelumnya'}
        </button>
        <button
          type="button"
          className="btn-outline"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label={lang === 'en' ? 'Next page' : 'Halaman berikutnya'}
        >
          {lang === 'en' ? 'Next' : 'Berikutnya'}
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
