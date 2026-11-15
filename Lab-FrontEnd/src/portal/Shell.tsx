import { useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, Bell, Check, ChevronDown, Globe, LogOut, Menu, Monitor, Moon, PanelLeft, Sun, X, type LucideIcon } from 'lucide-react'
import type { Identity } from '../api'
import { useI18n } from '../shared/i18n'
import { simApi } from '../simulator/api'
import { roleName, store, type Theme } from './hooks'
import { Logo, NavLink, Popover } from './ui'
import './portal.css'

export interface NavPage { key: string; path: string; label: string; icon: LucideIcon }
export interface Note { id: string; title: string; detail: string; when: string }

export interface ShellProps {
  user: Identity
  pages: NavPage[]
  active: string
  go: (to: string) => void
  crumb?: string
  theme: Theme
  setTheme: (t: Theme) => void
  onLogout: () => void
  loggingOut: boolean
  onSwitchRole: (role: string) => void
  switching: boolean
  notifications?: Note[]
  accountExtra?: (close: () => void) => ReactNode
  error?: ReactNode
  children: ReactNode
}

/** Kerangka sidebar + topbar yang dipakai Admin, Dosen, dan Mahasiswa. */
export function Shell({ user, pages, active, go, crumb, theme, setTheme, onLogout, loggingOut, onSwitchRole, switching, notifications, accountExtra, error, children }: ShellProps) {
  const { lang, setLang, tr } = useI18n()
  const qc = useQueryClient()
  const [collapsed, setCollapsed] = useState(() => store.get('ifa-sidebar') === 'collapsed')
  const [mobileNav, setMobileNav] = useState(false)
  const [readNotes, setReadNotes] = useState(false)
  const page = pages.find(p => p.key === active) ?? pages[0]
  const home = pages[0].path
  const role = lang === 'en' ? (tr.shell.roles[user.role as keyof typeof tr.shell.roles] ?? roleName(user.role)) : roleName(user.role)
  const roleAriaLabel = roleName(user.role)
  const otherRoles = (user.allowed_roles ?? []).filter(r => r !== user.role)
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || role[0]
  const firstName = user.name.split(/\s+/)[0] || user.name
  const currentPathname = typeof window !== 'undefined' ? window.location.pathname : page.path
  useEffect(() => { document.title = `${crumb ?? page.label} · ${role} · IFA Lab` }, [page, crumb, role])
  useEffect(() => { store.set('ifa-sidebar', collapsed ? 'collapsed' : 'open') }, [collapsed])
  useEffect(() => {
    void simApi.updatePresence(user.csrf_token, currentPathname).catch(() => {})
  }, [currentPathname, user.csrf_token])
  const liveNotesQ = useQuery({
    queryKey: ['portal-notifications', user.id],
    queryFn: () => simApi.getNotifications(),
    retry: false,
    refetchInterval: 60000,
  })
  const liveNotes: Note[] = (liveNotesQ.data?.items ?? []).map(n => ({
    id: n.id,
    title: n.subject,
    detail: `${n.body_preview} → ${n.recipient_email}`,
    when: new Date(n.created_at).toLocaleString('id-ID'),
  }))
  const activeNotes = liveNotes.length > 0 ? liveNotes : (notifications ?? [])
  const navigate = (to: string) => { setMobileNav(false); go(to) }
  const themes = [
    ['light', tr.shell.themeLight, Sun],
    ['dark', tr.shell.themeDark, Moon],
    ['system', tr.shell.themeSystem, Monitor],
  ] as const
  const current = themes.find(t => t[0] === theme) ?? themes[0]
  const ThemeIcon = current[2]
  const themeLabel = theme === 'system' ? tr.shell.themeSysShort : current[1]
  const unread = liveNotesQ.data ? (readNotes ? 0 : liveNotesQ.data.unread) : (activeNotes.length && !readNotes ? activeNotes.length : 0)
  const handleMarkRead = () => {
    setReadNotes(true)
    if (liveNotesQ.data?.unread) {
      void simApi.markNotificationsRead(user.csrf_token).then(() => qc.invalidateQueries({ queryKey: ['portal-notifications', user.id] })).catch(() => {})
    }
  }

  return <div className={`portal role-${user.role} ${collapsed ? 'is-collapsed' : ''} ${mobileNav ? 'nav-open' : ''}`}>
    <aside className="sidebar">
      <div className="sidebar-brand"><Logo /><div className="brand-text"><strong>IFA Lab</strong><span>{role}</span></div>
        <button type="button" className="icon-btn mobile-only" aria-label={tr.shell.closeNav} onClick={() => setMobileNav(false)}><X size={18} aria-hidden="true" /></button></div>
      <nav aria-label={`Navigasi ${roleAriaLabel}`}><ul>{pages.map(p => { const Icon = p.icon; return <li key={p.key}>
        <NavLink to={p.path} go={navigate} className={`nav-item ${p.key === page.key ? 'is-active' : ''}`} aria-current={p.key === page.key ? 'page' : undefined}><Icon size={19} aria-hidden="true" /><span className="nav-label">{p.label}</span></NavLink>
      </li> })}</ul></nav>
      {otherRoles.length > 0 && <div className="sidebar-foot">{otherRoles.map(r => {
        const targetRoleName = lang === 'en' ? (tr.shell.roles[r as keyof typeof tr.shell.roles] ?? roleName(r)) : roleName(r)
        return <button key={r} type="button" className="switch-role" disabled={switching} onClick={() => onSwitchRole(r)} title={`${tr.shell.switchTo} ${targetRoleName}`}>
          <ArrowRightLeft size={18} aria-hidden="true" /><span className="nav-label">{switching ? tr.shell.switching : `${tr.shell.switchTo} ${targetRoleName}`}</span></button>
      })}</div>}
    </aside>
    {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} aria-hidden="true" />}
    <div className="workspace">
      <header className="topbar">
        <button type="button" className="control icon-only desktop-only" aria-label={collapsed ? tr.shell.expandSidebar : tr.shell.collapseSidebar} aria-pressed={collapsed} onClick={() => setCollapsed(v => !v)}><PanelLeft size={18} aria-hidden="true" /></button>
        <button type="button" className="control icon-only mobile-only" aria-label={tr.shell.openNav} onClick={() => setMobileNav(true)}><Menu size={18} aria-hidden="true" /></button>
        <nav className="crumbs" aria-label="Breadcrumb">
          <NavLink to={home} go={navigate}>{role}</NavLink><span aria-hidden="true">/</span>
          {crumb ? <><NavLink to={page.path} go={navigate}>{page.label}</NavLink><span aria-hidden="true">/</span><span aria-current="page">{crumb}</span></> : <span aria-current="page">{page.label}</span>}
        </nav>
        <div className="topbar-tools">
          <Popover label={`${tr.shell.notifications}${unread ? `, ${unread}` : ''}`} className="icon-only" trigger={<><Bell size={18} aria-hidden="true" />{unread > 0 && <span className="dot-count">{unread}</span>}</>}>
            {() => <div className="notes"><header><strong>{tr.shell.notifications}</strong><button type="button" className="text-btn" onClick={handleMarkRead} disabled={!unread}>{tr.shell.markRead}</button></header>
              {activeNotes.length ? <ul>{activeNotes.map(n => <li key={n.id} className={unread > 0 ? 'unread' : ''}><p className="strong">{n.title}</p><p>{n.detail}</p><small>{n.when}</small></li>)}</ul> : <p className="notes-empty">{tr.shell.noNotes}</p>}</div>}
          </Popover>
          <Popover label={tr.shell.language} className="hide-sm" trigger={<><Globe size={18} aria-hidden="true" /><span>{lang.toUpperCase()}</span><ChevronDown size={15} aria-hidden="true" /></>}>
            {close => <div className="menu" role="menu">
              <button type="button" role="menuitemradio" aria-checked={lang === 'id'} onClick={() => { setLang('id'); close() }}>
                Indonesia{lang === 'id' && <Check size={15} className="menu-check" aria-hidden="true" />}
              </button>
              <button type="button" role="menuitemradio" aria-checked={lang === 'en'} onClick={() => { setLang('en'); close() }}>
                English{lang === 'en' && <Check size={15} className="menu-check" aria-hidden="true" />}
              </button>
            </div>}
          </Popover>
          <Popover label={`${tr.shell.theme}: ${themeLabel}`} className="hide-sm" trigger={<><ThemeIcon size={18} aria-hidden="true" /><span>{themeLabel}</span><ChevronDown size={15} aria-hidden="true" /></>}>
            {close => <div className="menu" role="menu">{themes.map(([v, label, Icon]) => <button key={v} type="button" role="menuitemradio" aria-checked={theme === v} onClick={() => { setTheme(v); close() }}><Icon size={15} aria-hidden="true" />{label}{theme === v && <Check size={15} className="menu-check" aria-hidden="true" />}</button>)}</div>}
          </Popover>
          <Popover label={tr.shell.accountMenu} className="account" trigger={<><span className="avatar lg">{initials}</span><span className="account-text"><strong>{firstName}</strong><small>{role}</small></span><ChevronDown size={16} aria-hidden="true" /></>}>
            {close => <div className="menu account-menu" role="menu">
              <div className="account-info"><strong>{user.name}</strong><small>{user.email}</small></div>
              {otherRoles.map(r => {
                const targetRoleName = lang === 'en' ? (tr.shell.roles[r as keyof typeof tr.shell.roles] ?? roleName(r)) : roleName(r)
                return <button key={r} type="button" role="menuitem" disabled={switching} onClick={() => onSwitchRole(r)}><ArrowRightLeft size={15} aria-hidden="true" />{tr.shell.switchTo} {targetRoleName}</button>
              })}
              {accountExtra?.(close)}
              <div className="menu-theme hide-lg">
                <button type="button" role="menuitemradio" aria-checked={lang === 'id'} onClick={() => setLang('id')}><Globe size={15} aria-hidden="true" />Indonesia{lang === 'id' && <Check size={15} className="menu-check" aria-hidden="true" />}</button>
                <button type="button" role="menuitemradio" aria-checked={lang === 'en'} onClick={() => setLang('en')}><Globe size={15} aria-hidden="true" />English{lang === 'en' && <Check size={15} className="menu-check" aria-hidden="true" />}</button>
                {themes.map(([v, label, Icon]) => <button key={v} type="button" role="menuitemradio" aria-checked={theme === v} onClick={() => setTheme(v)}><Icon size={15} aria-hidden="true" />{label}{theme === v && <Check size={15} className="menu-check" aria-hidden="true" />}</button>)}
              </div>
              <button type="button" role="menuitem" onClick={onLogout} disabled={loggingOut}><LogOut size={15} aria-hidden="true" />{loggingOut ? tr.shell.loggingOut : tr.shell.logout}</button>
            </div>}
          </Popover>
        </div>
      </header>
      <main className="content" id="main" tabIndex={-1}>
        {error}
        {children}
      </main>
    </div>
  </div>
}
