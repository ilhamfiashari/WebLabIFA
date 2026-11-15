export const ADMIN_BASE = '/lab/admin'

const nf = new Intl.NumberFormat('id-ID')
export const fmt = (n: number) => nf.format(n)
