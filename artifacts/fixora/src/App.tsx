import { useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness, CalendarDays,
  Check, CheckCircle2, ChevronDown, Clock3, Compass, FileCheck2, Hammer, HeartHandshake,
  Home, LogOut, MapPin, Menu, Search, ShieldCheck, SlidersHorizontal,
  Sparkles, Star, UserRound, UsersRound, Wrench, X, Zap,
} from 'lucide-react';
import {
  getGetAdminSummaryQueryKey, getGetBookingQueryKey, getGetCurrentUserQueryKey,
  getGetDashboardQueryKey, getGetOwnProfessionalProfileQueryKey, getGetProfessionalQueryKey,
  getListAdminBookingsQueryKey, getListAdminProfessionalsQueryKey, getListAdminUsersQueryKey, getListBookingsQueryKey,
  getListCategoriesQueryKey, getListNotificationsQueryKey, getListProfessionalsQueryKey,
  useCreateBooking, useCreateReview, useGetAdminSummary, useGetBooking, useGetCurrentUser,
  useGetDashboard, useGetOwnProfessionalProfile, useGetProfessional, useListAdminBookings,
  useListAdminProfessionals, useListAdminUsers, useListBookings, useListCategories, useListNotifications,
  useListProfessionals, useLogin, useLogout, useMarkAllNotificationsRead,
  useMarkNotificationRead, useSaveProfessionalProfile, useSignup, useUpdateAvailability,
  useUpdateBookingStatus, useUpdateUserStatus, useUpdateVerification,
  type Booking, type Category, type Professional, type ProfessionalInput, type User,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import type { ReactNode, FormEvent } from 'react';

const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 20_000 } } });
const AREA = 'Coimbatore';
const DEFAULT_CENTER: [number, number] = [11.0168, 76.9558];
const COIMBATORE_AREAS = [
  { name: 'Gandhipuram', lat: 11.0183, lng: 76.9674 },
  { name: 'RS Puram', lat: 11.0085, lng: 76.9514 },
  { name: 'Saibaba Colony', lat: 11.0236, lng: 76.9407 },
  { name: 'Peelamedu', lat: 11.0282, lng: 77.0124 },
  { name: 'Race Course', lat: 10.9984, lng: 76.9677 },
  { name: 'Singanallur', lat: 11.0007, lng: 77.0328 },
  { name: 'Vadavalli', lat: 11.0328, lng: 76.9103 },
  { name: 'Town Hall', lat: 10.9948, lng: 76.9614 },
];

type MapMarker = { id: string; lat: number; lng: number; label: string };
function ServiceMap({ markers = [], center = DEFAULT_CENTER, selectable = false, selectedPoint, onSelect, className = '' }: {
  markers?: MapMarker[];
  center?: [number, number];
  selectable?: boolean;
  selectedPoint?: [number, number] | null;
  onSelect?: (point: [number, number]) => void;
  className?: string;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<(typeof import('leaflet') & { default: typeof import('leaflet') }) | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const callbackRef = useRef(onSelect);
  callbackRef.current = onSelect;

  useEffect(() => {
    let disposed = false;
    let mountedMap: LeafletMap | null = null;
    void import('leaflet').then((leaflet) => {
      if (disposed || !elementRef.current) return;
      const L = leaflet.default;
      leafletRef.current = leaflet as typeof leafletRef.current;
      const map = L.map(elementRef.current, { scrollWheelZoom: false, zoomControl: true }).setView(center, 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      map.on('click', (event) => callbackRef.current?.([event.latlng.lat, event.latlng.lng]));
      markerLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      mountedMap = map;
      setMapReady(true);
      requestAnimationFrame(() => map.invalidateSize());
    });
    return () => {
      disposed = true;
      mountedMap?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;
    const L = leafletRef.current?.default;
    if (!L) return;
    layer.clearLayers();
    markers.filter((marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lng)).forEach((marker) => {
      L.marker([marker.lat, marker.lng], { icon: L.divIcon({ className: 'fixora-leaflet-icon', html: '<span></span>', iconSize: [30, 34], iconAnchor: [15, 30] }) })
        .bindTooltip(marker.label, { direction: 'top', offset: [0, -22] }).addTo(layer);
    });
    if (selectable && selectedPoint) {
      L.marker(selectedPoint, { icon: L.divIcon({ className: 'fixora-leaflet-icon is-selected', html: '<span></span>', iconSize: [30, 34], iconAnchor: [15, 30] }) })
        .bindTooltip('Selected location', { direction: 'top', offset: [0, -22] }).addTo(layer);
    }
    if (markers.length > 1) {
      const points = markers.map((item) => [item.lat, item.lng] as [number, number]);
      if (selectable && selectedPoint) points.push(selectedPoint);
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds.pad(.2), { maxZoom: 14 });
    } else if (selectedPoint && selectable) {
      map.setView(selectedPoint, Math.max(map.getZoom(), 14));
    } else if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 14);
    }
  }, [mapReady, markers, selectable, selectedPoint]);

  return <div className={`service-map ${className}`} ref={elementRef} aria-label="OpenStreetMap of local service locations" />;
}

function haversineKm(a: [number, number], b: [number, number]) {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(b[0] - a[0]);
  const dLng = radians(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a[0])) * Math.cos(radians(b[0])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function money(value?: number | null) {
  return typeof value === 'number' ? `₹${value.toLocaleString('en-IN')}` : 'Price on visit';
}
function initials(name = 'Fixora') { return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase(); }
function dateLabel(value?: string) {
  if (!value) return 'To be arranged';
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
function StatusPill({ status }: { status: string }) {
  const tone = ['completed', 'verified', 'accepted'].includes(status) ? 'good' : ['declined', 'cancelled', 'rejected'].includes(status) ? 'bad' : 'waiting';
  return <span className={`status-pill ${tone}`} data-testid={`status-${status}`}>{status.replaceAll('_', ' ')}</span>;
}
function Avatar({ name, url, size = 'md' }: { name: string; url?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  return <div className={`avatar avatar-${size}`} aria-label={name}>{url ? <img src={url} alt={name} /> : initials(name)}</div>;
}
function Loading({ label = 'Getting things ready' }: { label?: string }) {
  return <div className="loading-state" role="status"><span className="skeleton-bar" /><span className="skeleton-bar short" /><p>{label}</p></div>;
}
function QueryError({ onRetry }: { onRetry: () => void }) {
  return <div className="feedback-card"><div className="feedback-mark"><Zap size={19} /></div><h3>We couldn’t load that just now.</h3><p>Your place is saved. Give it another try.</p><button className="button button-secondary" onClick={onRetry}>Try again</button></div>;
}
function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-mark"><Compass size={21} /></span><h3>{title}</h3><p>{body}</p>{action}</div>;
}
function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`brand ${light ? 'brand-light' : ''}`} data-testid="link-home"><span className="brand-mark"><Wrench size={19} strokeWidth={2.5} /></span><span>fixora<span className="brand-period">.</span></span></Link>;
}
function timeAgo(value?: string) {
  if (!value) return 'recently';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
function NotificationsRealtime() {
  const qc = useQueryClient();
  const [toast, setToast] = useState('');
  const prevCountRef = useRef(0);
  // Poll every 10 seconds
  const q = useListNotifications({ query: { queryKey: getListNotificationsQueryKey(), refetchInterval: 10_000 } });
  useEffect(() => {
    const unread = q.data?.filter((n) => !n.read).length ?? 0;
    if (unread > prevCountRef.current && prevCountRef.current !== undefined) {
      const newest = q.data?.find((n) => !n.read);
      if (newest) {
        setToast(newest.title);
        window.setTimeout(() => setToast(''), 4200);
        qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      }
    }
    prevCountRef.current = unread;
  }, [q.data, qc]);
  if (!toast) return null;
  return <div className="live-toast"><span className="live-dot" /><div><b>New update</b><span>{toast}</span></div><button aria-label="Dismiss" onClick={() => setToast('')}><X size={16} /></button></div>;
}
function Shell({ children, user, showNav = true }: { children: ReactNode; user?: { name: string; role: string; photoUrl?: string | null } | null; showNav?: boolean }) {
  const [location, setLocation] = useLocation();
  const [menu, setMenu] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const logout = useLogout();
  const qc = useQueryClient();
  const notificationQuery = useListNotifications({ query: { queryKey: getListNotificationsQueryKey(), enabled: !!user } });
  const markNotificationRead = useMarkNotificationRead();
  const unreadCount = notificationQuery.data?.filter((item) => !item.read).length || 0;
  const navLinks: [string, string, typeof Home][] = user?.role === 'admin'
    ? [['/admin', 'Overview', Home], ['/notifications', 'Updates', Bell]]
    : user?.role === 'professional'
      ? [['/dashboard', 'My work', BriefcaseBusiness], ['/professional/profile', 'My profile', UserRound], ['/notifications', 'Updates', Bell]]
      : [['/find', 'Find a pro', Search], ['/dashboard', 'My bookings', BriefcaseBusiness], ['/profile', 'Profile', UserRound], ['/notifications', 'Updates', Bell]];
  const signOut = () => logout.mutate(undefined, { onSuccess: () => { qc.setQueryData(getGetCurrentUserQueryKey(), null); setLocation('/'); } });
  return <div className="fixora-shell">
    {showNav && <header className="topbar">
      <div className="topbar-inner"><Brand />
        <nav className={`main-nav ${menu ? 'nav-open' : ''}`} aria-label="Main navigation">
          {user ? navLinks.map(([href, label, Icon]) => <Link key={String(href)} href={String(href)} className={`nav-link ${location === href ? 'active' : ''}`} onClick={() => setMenu(false)}><Icon size={17} />{label}</Link>)
            : <><Link className="nav-link" href="/find">Explore services</Link><a className="nav-link" href="#how-it-works">How it works</a></>}
        </nav>
        <div className="top-actions">
          {user ? <><div className="notification-anchor"><button className="icon-button notification-button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={notificationOpen} onClick={() => setNotificationOpen((open) => !open)}><Bell size={18} />{unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}</button>{notificationOpen && <div className="notification-dropdown"><div className="dropdown-heading"><div><b>Latest updates</b><small>{unreadCount ? `${unreadCount} unread` : 'You’re all caught up'}</small></div><button aria-label="Close notifications" onClick={() => setNotificationOpen(false)}><X size={16} /></button></div>{notificationQuery.isLoading ? <div className="dropdown-empty">Checking for updates…</div> : notificationQuery.isError ? <div className="dropdown-empty">Updates are temporarily unavailable.</div> : notificationQuery.data?.length ? notificationQuery.data.slice(0, 4).map((item) => <Link key={item.id} href={item.bookingId ? `/bookings/${item.bookingId}` : '/notifications'} className={`dropdown-note ${item.read ? '' : 'unread'}`} onClick={() => { setNotificationOpen(false); if (!item.read) markNotificationRead.mutate({ id: item.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() }) }); }}><span className="dropdown-note-dot" /><span><b>{item.title}</b><small>{item.message}</small></span></Link>) : <div className="dropdown-empty">No updates just yet.</div>}<Link href="/notifications" className="dropdown-footer" onClick={() => setNotificationOpen(false)}>See all updates <ArrowRight size={14} /></Link></div>}</div><Link href={user.role === 'professional' ? '/professional/profile' : user.role === 'admin' ? '/admin' : '/profile'} className="user-chip"><Avatar name={user.name} url={user.photoUrl} size="sm" /><span>{user.name.split(' ')[0]}</span><ChevronDown size={14} /></Link><button className="icon-button signout" aria-label="Sign out" onClick={signOut}><LogOut size={17} /></button></>
            : <><Link href="/login" className="nav-link">Sign in</Link><Link href="/signup" className="button button-primary nav-cta">Join Fixora <ArrowRight size={16} /></Link></>}
        </div>
        <button className="mobile-menu" aria-label="Toggle menu" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
      </div>
    </header>}
    {children}
    {user && <NotificationsRealtime />}
  </div>;
}
function usePageUser() {
  const query = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false } });
  return query;
}
function Page({ children, eyebrow, title, subtitle, actions }: { children: ReactNode; eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return <main className="page-wrap"><div className="page-heading"><div><p className="eyebrow">{eyebrow || 'FIXORA · COIMBATORE'}</p><h1>{title}</h1>{subtitle && <p className="page-subtitle">{subtitle}</p>}</div>{actions && <div className="heading-actions">{actions}</div>}</div>{children}</main>;
}
function SectionTitle({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="section-title"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>;
}

function Landing() {
  const categoriesQuery = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });
  const topRatedQuery = useListProfessionals({ sort: 'rating' }, { query: { queryKey: getListProfessionalsQueryKey({ sort: 'rating' }) } });
  const categories = categoriesQuery.data || [];
  const [search, setSearch] = useState('');
  const [, setLocation] = useLocation();
  const goSearch = (e: FormEvent) => { e.preventDefault(); setLocation(`/find${search ? `?query=${encodeURIComponent(search)}` : ''}`); };
  const cards = [
    { icon: '01', title: 'Tell us what needs fixing', text: 'Share a few details. Add a photo if it helps.' },
    { icon: '02', title: 'Choose someone nearby', text: 'Compare local pros by experience, rating and price.' },
    { icon: '03', title: 'See every next step', text: 'Your booking timeline keeps the whole visit clear.' },
  ];
  return <Shell>
    <main>
      <section className="hero-section">
        <div className="hero-copy rise-in"><span className="hero-kicker"><span className="kicker-dot" /> GOOD WORK, RIGHT AROUND THE CORNER</span>
          <h1>Your home,<br /><em>in good hands.</em></h1>
          <p className="hero-intro">Find trusted local professionals for the things that make a house feel like home. Right here in Coimbatore.</p>
          <form className="hero-search" onSubmit={goSearch}><Search size={20} /><input aria-label="What do you need help with?" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="What needs a hand?" /><button aria-label="Search services"><ArrowRight size={20} /></button></form>
          <div className="hero-proof"><div className="proof-avatars"><span>KR</span><span>AS</span><span>MV</span></div><span>Good neighbors. <b>Good hands.</b></span><span className="proof-divider" /><span className="proof-stars"><Star size={14} fill="currentColor" /> Local, rated, and reviewed</span></div>
        </div>
        <div className="hero-art rise-in rise-delay-1">
          <div className="art-backdrop" />
          <div className="house-art">
            <div className="sun-disc" /><div className="art-roof" /><div className="art-house"><div className="window window-left" /><div className="window window-right" /><div className="art-door" /><div className="door-knob" /></div>
            <div className="plant plant-one"><i /><i /><i /><b /></div><div className="plant plant-two"><i /><i /><i /><b /></div>
            <div className="work-badge"><span><ShieldCheck size={17} /></span><div><b>Locally trusted</b><small>Made for your neighborhood</small></div></div>
          </div>
          <span className="art-note note-top">FROM SAIBABA COLONY</span><span className="art-note note-bottom">001 · LOCAL HANDS</span>
        </div>
        <div className="hero-side-label">GOOD SERVICE, CLOSE BY <span>—</span> COIMBATORE, TN</div>
      </section>
      <section className="category-strip">
        <div className="strip-heading"><span>THE EVERYDAY FIXES</span><Link href="/find">All services <ArrowUpRight size={15} /></Link></div>
        {categoriesQuery.isLoading ? <div className="category-list"><Loading label="Finding local services" /></div> : categoriesQuery.isError ? <div className="inline-error"><span>Services are taking a moment.</span><button onClick={() => categoriesQuery.refetch()}>Retry</button></div> :
          <div className="category-list">{categories.length ? categories.slice(0, 7).map((category, index) => <Link className="category-item" key={category.id} href={`/find?categoryId=${category.id}`} data-testid={`category-${category.id}`}><span className={`category-icon category-tone-${index % 4}`}>{category.name.slice(0, 1).toUpperCase()}</span><span>{category.name}</span><ArrowUpRight size={14} /></Link>) : <Empty title="A few more services are on their way" body="Check back soon for local specialists." />}</div>}
      </section>
      <section className="top-rated-section">
        <div className="top-rated-heading"><div><p className="eyebrow">NEIGHBORS’ FAVORITES</p><h2>Good hands, <em>well recommended.</em></h2><p>Local professionals earning trust one visit at a time.</p></div><Link className="text-link" href="/find">Meet all professionals <ArrowRight size={15} /></Link></div>
        {topRatedQuery.isLoading ? <div className="pro-grid top-rated-grid">{[0, 1, 2].map((i) => <div className="pro-card skeleton-card" key={i}><span /><i /><i /></div>)}</div> : topRatedQuery.isError ? <QueryError onRetry={() => topRatedQuery.refetch()} /> : topRatedQuery.data?.length ? <div className="pro-grid top-rated-grid">{topRatedQuery.data.slice(0, 3).map((pro) => <ProfessionalCard key={pro.id} pro={pro} />)}</div> : <Empty title="Local favorites are just getting started" body="As neighbors share their experiences, top-rated professionals will appear here." />}
      </section>
      <section className="trust-section" id="how-it-works"><div className="trust-heading"><p className="eyebrow">A LITTLE LESS GUESSWORK</p><h2>Know who’s coming.<br /><span>Know what happens next.</span></h2></div><div className="steps-list">{cards.map((item) => <article className="step-row" key={item.icon}><span className="step-no">{item.icon}</span><div><h3>{item.title}</h3><p>{item.text}</p></div><ArrowDownRight size={19} /></article>)}</div></section>
      <section className="neighborhood-band"><div><p className="eyebrow">YOUR STREET, YOUR PEOPLE</p><h2>Better work starts<br />with a familiar name.</h2><p>Fixora brings Coimbatore’s local service community a little closer — with clear details and no mystery about what comes next.</p><Link className="button button-white" href="/find">Meet local professionals <ArrowRight size={17} /></Link></div><div className="band-stamp"><span>MADE FOR</span><b>கோவை</b><span>COIMBATORE · TAMIL NADU</span></div><span className="band-orbit orbit-one" /><span className="band-orbit orbit-two" /></section>
      <section className="join-section"><div><span className="join-icon"><HeartHandshake size={22} /></span><p className="eyebrow">GOOD WITH YOUR HANDS?</p><h2>Your next customer<br />could be just nearby.</h2></div><div className="join-right"><p>Build your local profile, set your own availability, and let neighbors find the skills you’re proud of.</p><Link href="/signup?role=professional" className="button button-primary">Join as a professional <ArrowRight size={17} /></Link></div></section>
    </main><Footer />
  </Shell>;
}
function Footer() {
  return <footer className="footer"><Brand /><span>Good service lives next door.</span><div><Link href="/find">Browse services</Link><Link href="/login">Sign in</Link><span>Coimbatore, Tamil Nadu</span></div></footer>;
}
function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const isSignup = mode === 'signup';
  const rolePreset = new URLSearchParams(window.location.search).get('role');
  const [role, setRole] = useState<'customer' | 'professional'>(rolePreset === 'professional' ? 'professional' : 'customer');
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();
  const signup = useSignup();
  const login = useLogin();
  const busy = signup.isPending || login.isPending;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError('');
    const data = new FormData(e.currentTarget);
    const email = String(data.get('email') || '');
    const password = String(data.get('password') || '');
    const move = (user: { role: string }) => setLocation(user.role === 'admin' ? '/admin' : user.role === 'professional' ? '/dashboard' : '/dashboard');
    if (isSignup) signup.mutate({ data: { name: String(data.get('name')), email, phone: String(data.get('phone')), password, role } }, { onSuccess: (res) => move(res.user), onError: () => setError('We couldn’t create your account. Check your details and try again.') });
    else login.mutate({ data: { email, password, rememberMe: true } }, { onSuccess: (res) => move(res.user), onError: () => setError('That email and password didn’t match. Please try again.') });
  };
  const demoLogin = (email: string, password: string) => {
    setError('');
    login.mutate({ data: { email, password, rememberMe: true } }, { onSuccess: (res) => { const dest = res.user.role === 'admin' ? '/admin' : res.user.role === 'professional' ? '/dashboard' : '/find'; setLocation(dest); }, onError: () => setError('Demo login failed. Please check the server is running.') });
  };
  return <div className="auth-layout"><aside className="auth-aside"><Brand light /><div className="auth-message"><p className="eyebrow">LOCAL HELP, WITH A HUMAN TOUCH</p><h1>Good work<br />feels closer.</h1><p>Find the right hands for home, from people who know your neighborhood.</p><div className="auth-aside-note"><ShieldCheck size={18} /><span>Clear profiles. Honest reviews. A booking you can follow.</span></div></div><span className="auth-aside-footer">FIXORA · COIMBATORE, TAMIL NADU</span><div className="auth-pattern" /></aside>
    <main className="auth-main"><Link href="/" className="auth-back"><ArrowLeft size={16} /> Back to home</Link><div className="auth-card"><span className="auth-mark"><Wrench size={20} /></span><p className="eyebrow">{isSignup ? 'A GOOD PLACE TO START' : 'WELCOME BACK'}</p><h2>{isSignup ? 'Make yourself at home.' : 'Let\'s pick up where you left off.'}</h2><p className="auth-lead">{isSignup ? 'Create your Fixora account in just a minute.' : 'Sign in to see your bookings and updates.'}</p>
      {!isSignup && <div style={{ display: 'grid', gap: '8px', marginBottom: '18px', padding: '14px', background: '#f5ead8', borderRadius: '12px', border: '1px solid #e8d5b7' }}><p style={{ margin: '0 0 10px', fontSize: '10px', fontWeight: 800, letterSpacing: '.12em', color: '#9b6432' }}>QUICK DEMO LOGIN</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px' }}><button type="button" disabled={busy} onClick={() => demoLogin('customer@fixora.demo', 'demo1234')} style={{ padding: '9px 6px', border: '1px solid #e0c9a8', borderRadius: '9px', background: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: 700, color: '#3a4a68' }}><Home size={13} style={{ display: 'block', margin: '0 auto 4px' }} />Customer</button><button type="button" disabled={busy} onClick={() => demoLogin('pro01@fixora.demo', 'pro1234')} style={{ padding: '9px 6px', border: '1px solid #e0c9a8', borderRadius: '9px', background: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: 700, color: '#3a4a68' }}><Wrench size={13} style={{ display: 'block', margin: '0 auto 4px' }} />Professional</button><button type="button" disabled={busy} onClick={() => demoLogin('admin@fixora.demo', 'admin1234')} style={{ padding: '9px 6px', border: '1px solid #e0c9a8', borderRadius: '9px', background: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: 700, color: '#3a4a68' }}><ShieldCheck size={13} style={{ display: 'block', margin: '0 auto 4px' }} />Admin</button></div></div>}
      {isSignup && <div className="role-switch"><button type="button" className={role === 'customer' ? 'selected' : ''} onClick={() => setRole('customer')}><Home size={16} /> I need a service</button><button type="button" className={role === 'professional' ? 'selected' : ''} onClick={() => setRole('professional')}><Wrench size={16} /> I offer services</button></div>}
      <form className="form-stack" onSubmit={submit}>{isSignup && <label>Your name<input name="name" required minLength={2} autoComplete="name" placeholder="e.g. Kavitha Raman" /></label>}<label>Email address<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>{isSignup && <label>Phone number<input name="phone" type="tel" required autoComplete="tel" placeholder="+91 98765 43210" /></label>}<label>Password<input name="password" type="password" required minLength={8} autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder={isSignup ? 'At least 8 characters' : 'Enter your password'} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary submit-button" disabled={busy}>{busy ? 'One moment…' : isSignup ? 'Create my account' : 'Sign in'}<ArrowRight size={17} /></button></form>
      <p className="auth-switch">{isSignup ? 'Already have an account?' : 'New to Fixora?'} <Link href={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign in' : 'Create an account'}</Link></p>
    </div><p className="auth-fineprint">By continuing, you agree to be kind to your neighbors.</p></main></div>;
}

function BookingRow({ booking }: { booking: Booking }) {
  const user = usePageUser().data;
  const otherName = user?.role === 'professional' ? booking.customerName : booking.professionalName;
  return <Link href={`/bookings/${booking.id}`} className="booking-row" data-testid={`booking-row-${booking.id}`}><span className="booking-date"><b>{new Date(booking.preferredAt).toLocaleDateString('en-IN', { day: '2-digit' })}</b><small>{new Date(booking.preferredAt).toLocaleDateString('en-IN', { month: 'short' })}</small></span><span className="booking-info"><strong>{booking.title}</strong><small>{otherName} · {booking.categoryName}</small></span><span className="booking-row-right"><StatusPill status={booking.status} /><small>{dateLabel(booking.preferredAt)}</small></span><ArrowRight className="booking-arrow" size={17} /></Link>;
}
function IncomingRequestCard({ booking, proCenter, onStatus, pending }: { booking: Booking; proCenter: [number, number]; onStatus: (id: string, status: string) => void; pending: boolean }) {
  const nextActions = booking.status === 'requested' ? ['accepted', 'declined'] : booking.status === 'accepted' ? ['on_the_way', 'cancelled'] : booking.status === 'on_the_way' ? ['in_progress'] : booking.status === 'in_progress' ? ['completed'] : [];
  const distance = haversineKm(proCenter, [booking.latitude, booking.longitude]);
  const point: [number, number] = [booking.latitude || DEFAULT_CENTER[0], booking.longitude || DEFAULT_CENTER[1]];
  const actionLabel: Record<string, string> = { accepted: 'Accept request', declined: 'Decline', on_the_way: 'I’m on my way', in_progress: 'Start the job', completed: 'Mark complete', cancelled: 'Cancel' };
  return <article className="incoming-request-card"><div className="incoming-request-main"><div className="incoming-request-heading"><div><p className="eyebrow">{booking.categoryName} · {dateLabel(booking.preferredAt)}</p><h3>{booking.title}</h3></div><StatusPill status={booking.status} /></div><p className="request-customer"><UserRound size={15} /> {booking.customerName}</p><p className="request-description">{booking.description}</p>{booking.photos.length > 0 && <div className="request-photo-row">{booking.photos.slice(0, 5).map((photo, index) => <a href={photo} key={photo} target="_blank" rel="noreferrer"><img src={photo} alt={`${booking.title} photo ${index + 1}`} /></a>)}</div>}<div className="request-location-text"><MapPin size={15} /><span><b>{booking.address}</b><small>{distance.toFixed(1)} km from your profile area</small></span></div><div className="incoming-request-actions"><Link href={`/bookings/${booking.id}`} className="text-link">Full timeline <ArrowRight size={14} /></Link>{nextActions.map((status) => <button key={status} className={`button ${status === 'declined' || status === 'cancelled' ? 'button-secondary' : 'button-primary'} button-small`} disabled={pending} onClick={() => onStatus(booking.id, status)}>{pending ? 'Updating…' : actionLabel[status]}</button>)}</div></div><ServiceMap markers={[{ id: booking.id, lat: point[0], lng: point[1], label: booking.customerName }]} center={point} className="request-map" /></article>;
}
function Dashboard() {
  const userQuery = usePageUser();
  const dash = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey() } });
  const ownProfile = useGetOwnProfessionalProfile({ query: { queryKey: getGetOwnProfessionalProfileQueryKey(), enabled: userQuery.data?.role === 'professional' } });
  const statusUpdate = useUpdateBookingStatus();
  const qc = useQueryClient();
  if (userQuery.isLoading || dash.isLoading) return <Shell user={userQuery.data}><Page title="Your Fixora"><Loading /></Page></Shell>;
  if (userQuery.isError || dash.isError || !dash.data) return <Shell user={userQuery.data}><Page title="Your Fixora"><QueryError onRetry={() => { userQuery.refetch(); dash.refetch(); }} /></Page></Shell>;
  const data = dash.data; const isPro = data.user.role === 'professional';
  const bookings = isPro ? data.incomingBookings : data.bookings;
  const greeting = data.user.name.split(' ')[0];
  const proCenter: [number, number] = ownProfile.data ? [ownProfile.data.latitude, ownProfile.data.longitude] : DEFAULT_CENTER;
  const updateRequest = (id: string, status: string) => statusUpdate.mutate({ id, data: { status: status as 'accepted' | 'declined' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled' } }, { onSuccess: () => {
    qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetBookingQueryKey(id) });
  } });
  return <Shell user={data.user}><Page eyebrow={isPro ? 'YOUR WORK, IN ONE PLACE' : 'YOUR HOME, IN GOOD HANDS'} title={`Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${greeting}.`} subtitle={isPro ? 'Here’s what’s happening with your local work.' : 'Here’s the latest on your service requests.'} actions={<Link href={isPro ? '/professional/profile' : '/find'} className="button button-primary">{isPro ? 'Edit profile' : 'Find a professional'} <ArrowRight size={16} /></Link>}>
      <div className="stat-grid">{(isPro ? [
        ['Incoming requests', String(data.incomingBookings.length), 'New work from your neighborhood', BriefcaseBusiness],
        ['Completed jobs', String(data.completedJobs), 'Good work adds up', CheckCircle2],
        ['Your rating', data.averageRating ? data.averageRating.toFixed(1) : '—', 'From customer reviews', Star],
      ] : [
        ['Your bookings', String(data.bookings.length), 'All your requests, in one place', CalendarDays],
        ['Needs your attention', String(data.bookings.filter((b) => b.status === 'requested' || b.status === 'in_progress').length), 'We’ll keep you posted', Clock3],
        ['Unread updates', String(data.unreadNotifications), 'Never miss a change', Bell],
      ]).map(([label, value, note, Icon]) => <article className="stat-card" key={String(label)}><span className="stat-icon"><Icon size={18} /></span><span className="stat-label">{label as string}</span><strong>{value as string}</strong><small>{note as string}</small></article>)}</div>
      {isPro && <section className="incoming-requests-section"><SectionTitle title="Requests from nearby" detail="Review the job, see where it is, then choose the next step." />{data.incomingBookings.length ? <div className="incoming-request-list">{data.incomingBookings.map((booking) => <IncomingRequestCard key={booking.id} booking={booking} proCenter={proCenter} onStatus={updateRequest} pending={statusUpdate.isPending} />)}</div> : <Empty title="No requests just yet" body="When a neighbor needs your skills, their request and location will show up here." />}</section>}
      {!isPro && <div className="dashboard-columns"><section className="panel bookings-panel"><SectionTitle title="Your recent bookings" detail={bookings.length ? 'The latest from around the neighborhood.' : 'As things move, you’ll see them here.'} action={<Link className="text-link" href="/find">Find a pro <ArrowRight size={15} /></Link>} />
        {bookings.length ? <div className="booking-list">{bookings.slice(0, 6).map((booking) => <BookingRow key={booking.id} booking={booking} />)}</div> : <Empty title={isPro ? 'No new requests yet' : 'Nothing on the calendar yet'} body={isPro ? 'Keep your availability on and your profile up to date.' : 'Find a nearby professional when something at home needs attention.'} action={<Link className="button button-primary button-small" href={isPro ? '/professional/profile' : '/find'}>{isPro ? 'Check my profile' : 'Explore services'} <ArrowRight size={15} /></Link>} />}
      </section><aside className="dashboard-aside"><div className="aside-welcome"><span className="aside-spark"><Sparkles size={18} /></span><p className="eyebrow">A BETTER KIND OF LOCAL</p><h3>A little help goes a long way.</h3><p>Every Fixora booking includes a clear timeline, so you always know what’s next.</p><Link href="/notifications" className="text-link">See your updates <ArrowRight size={15} /></Link></div><div className="quick-link"><span><ShieldCheck size={18} /></span><div><b>Every step, in view</b><small>Follow a booking from request to wrap-up.</small></div></div></aside></div>}
    </Page></Shell>;
}
function FindProfessionals() {
  const user = usePageUser();
  const sp = new URLSearchParams(window.location.search);
  const [query, setQuery] = useState(sp.get('query') || '');
  const [category, setCategory] = useState(sp.get('categoryId') || '');
  const [sort, setSort] = useState('rating');
  const [minRating, setMinRating] = useState(false);
  const [maxDistance, setMaxDistance] = useState('');
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [area, setArea] = useState('Gandhipuram');
  const [streetAddress, setStreetAddress] = useState('');
  const [geoMessage, setGeoMessage] = useState('');
  const [geoBusy, setGeoBusy] = useState(false);
  const categoriesQ = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });
  const filters = useMemo(() => ({ ...(category ? { categoryId: category } : {}), ...(query.trim() ? { query: query.trim() } : {}), latitude: center[0], longitude: center[1], sort: sort as 'rating' | 'distance' | 'price' | 'availability', ...(minRating ? { minRating: 4 } : {}), ...(maxDistance ? { maxDistance: Number(maxDistance) } : {}) }), [category, query, sort, minRating, center, maxDistance]);
  const prosQ = useListProfessionals(filters, { query: { queryKey: getListProfessionalsQueryKey(filters) } });
  const markers = useMemo(() => (prosQ.data || []).map((pro) => ({ id: pro.id, lat: pro.latitude, lng: pro.longitude, label: `${pro.name} · ${pro.area}` })), [prosQ.data]);
  const chooseArea = (name: string) => {
    setArea(name);
    const selected = COIMBATORE_AREAS.find((item) => item.name === name);
    if (selected) { setCenter([selected.lat, selected.lng]); setGeoMessage(`Showing professionals near ${name}.`); }
  };
  const useBrowserLocation = () => {
    if (!navigator.geolocation) { setGeoMessage('Location isn’t available in this browser. Choose a Coimbatore area instead.'); return; }
    setGeoBusy(true); setGeoMessage('');
    navigator.geolocation.getCurrentPosition((position) => {
      setCenter([position.coords.latitude, position.coords.longitude]);
      setArea('Current location');
      setGeoMessage('Using your current location for distance and nearby results.');
      setGeoBusy(false);
    }, () => {
      setGeoMessage('We couldn’t access your location. Choose a Coimbatore area instead.');
      setGeoBusy(false);
    }, { enableHighAccuracy: true, timeout: 8_000 });
  };
  return <Shell user={user.data}><Page eyebrow="GOOD PEOPLE, CLOSE BY" title="Find your local pro." subtitle="Skilled neighbors, clear profiles, no guesswork."><div className="search-layout">
    <aside className="filter-panel"><div className="filter-title"><SlidersHorizontal size={17} /><b>Make it yours</b></div><label className="field-label">Service<input className="text-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try plumbing, painting…" /></label><label className="field-label">Category<select className="text-input" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All services</option>{(categoriesQ.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="field-label">Your Coimbatore area<select className="text-input" value={COIMBATORE_AREAS.some((item) => item.name === area) ? area : ''} onChange={(e) => chooseArea(e.target.value)}><option value="">Choose an area</option>{COIMBATORE_AREAS.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><label className="field-label">Street / landmark<input className="text-input" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} placeholder="Optional address detail" /></label><button className="button button-secondary location-button" type="button" onClick={useBrowserLocation} disabled={geoBusy}><MapPin size={15} />{geoBusy ? 'Finding you…' : 'Use my current location'}</button>{geoMessage && <p className="geo-message">{geoMessage}</p>}<label className="field-label">Maximum distance<select className="text-input" value={maxDistance} onChange={(e) => setMaxDistance(e.target.value)}><option value="">Any distance</option><option value="5">Within 5 km</option><option value="10">Within 10 km</option><option value="20">Within 20 km</option><option value="40">Within 40 km</option></select></label><label className="field-label">Sort by<select className="text-input" value={sort} onChange={(e) => setSort(e.target.value)}><option value="rating">Top rated</option><option value="distance">Nearest first</option><option value="price">Price: low to high</option><option value="availability">Available now</option></select></label><button className={`rating-filter ${minRating ? 'checked' : ''}`} onClick={() => setMinRating(!minRating)}><span className="fake-checkbox">{minRating && <Check size={13} />}</span><span>4 stars and up</span><Star size={14} fill="currentColor" /></button><p className="filter-local"><MapPin size={14} /> {streetAddress ? `${streetAddress}, ${area}` : area}</p></aside>
    <section className="results-area"><div className="results-bar"><span>{prosQ.isLoading ? 'Finding your match…' : `${prosQ.data?.length || 0} local professionals`}</span><span className="results-location"><MapPin size={14} /> {area}</span></div>
      {prosQ.isLoading ? <div className="results-display"><div className="pro-grid">{[0,1,2,3].map((i) => <div className="pro-card skeleton-card" key={i}><span /><i /><i /></div>)}</div><div className="map-loading"><Loading label="Mapping nearby pros" /></div></div> : prosQ.isError ? <QueryError onRetry={() => prosQ.refetch()} /> : prosQ.data?.length ? <div className="results-display"><div className="pro-grid">{prosQ.data.map((pro) => <ProfessionalCard key={pro.id} pro={pro} />)}</div><div className="map-column"><div className="map-caption"><b>Local on the map</b><span>Tap the map to refine your search area.</span></div><ServiceMap markers={markers} center={center} selectable selectedPoint={center} onSelect={(point) => { setCenter(point); setArea('Pinned location'); setGeoMessage('Using your selected map pin as the center of your search.'); }} className="find-map" /></div></div> : <Empty title="No one by that name just yet" body="Try another service or broaden your search. Local professionals are added often." action={<button className="button button-secondary" onClick={() => { setQuery(''); setCategory(''); setMaxDistance(''); }}>Clear filters</button>} />}
    </section></div></Page></Shell>;
}
function ProfessionalCard({ pro }: { pro: Professional }) {
  return <article className="pro-card" data-testid={`professional-card-${pro.id}`}><Link href={`/professionals/${pro.id}`} className="pro-card-main"><div className="pro-card-top"><Avatar name={pro.name} url={pro.photoUrl} size="lg" /><span className={`availability ${pro.available ? 'is-available' : ''}`}><i />{pro.available ? 'Available' : 'Away'}</span></div><div className="pro-name-row"><h3>{pro.name}</h3>{pro.verification === 'verified' && <span className="verified-mark" title="Verified"><ShieldCheck size={15} /></span>}</div><p className="pro-skills">{pro.categories.join(' · ') || pro.skills.slice(0, 2).join(' · ')}</p><div className="pro-meta"><span><Star size={15} fill="currentColor" /> <b>{pro.rating ? pro.rating.toFixed(1) : 'New'}</b> <small>({pro.reviewsCount})</small></span><span><MapPin size={14} /> {pro.distance != null ? `${pro.distance.toFixed(1)} km away` : pro.area}</span></div><div className="pro-bottom"><span><b>{money(pro.price)}</b><small> / {pro.priceType}</small></span><span className="pro-experience">{pro.experienceYears} yrs experience</span></div></Link><Link className="pro-card-cta" href={`/professionals/${pro.id}`}>View profile <ArrowRight size={15} /></Link></article>;
}
function ProfessionalDetailPage() {
  const params = useParams<{ id: string }>();
  const user = usePageUser();
  const q = useGetProfessional(params.id || '', { query: { queryKey: getGetProfessionalQueryKey(params.id || ''), enabled: !!params.id } });
  const pro = q.data;
  if (q.isLoading) return <Shell user={user.data}><Page title="Local professional"><Loading /></Page></Shell>;
  if (q.isError || !pro) return <Shell user={user.data}><Page title="We can’t find that profile"><QueryError onRetry={() => q.refetch()} /></Page></Shell>;
  return <Shell user={user.data}><main className="page-wrap profile-page"><Link href="/find" className="back-link"><ArrowLeft size={16} /> Back to search</Link><div className="profile-hero panel"><div className="profile-hero-text"><span className="eyebrow">{pro.area} · COIMBATORE</span><div className="profile-name"><Avatar name={pro.name} url={pro.photoUrl} size="lg" /><div><h1>{pro.name}{pro.verification === 'verified' && <ShieldCheck size={22} />}</h1><p>{pro.categories.join(' · ')}</p></div></div><div className="profile-badges"><span><Star size={15} fill="currentColor" /> {pro.rating ? pro.rating.toFixed(1) : 'New'} <small>({pro.reviewsCount} reviews)</small></span><span><MapPin size={15} /> {pro.distance != null ? `${pro.distance.toFixed(1)} km away` : pro.area}</span><span><CheckCircle2 size={15} /> {pro.completedJobs} completed jobs</span></div><p className="profile-bio">{pro.bio || 'A local professional ready to help with your next home project.'}</p><div className="skill-chips">{pro.skills.map((s) => <span key={s}>{s}</span>)}</div></div><aside className="booking-cta"><span className="eyebrow">CLEAR FROM THE START</span><h3>{money(pro.price)}<small> / {pro.priceType}</small></h3><p>Final details can be agreed directly before work begins.</p><div className="cta-detail"><span><Clock3 size={16} /> {pro.available ? 'Taking new requests' : 'Not available right now'}</span><span><ShieldCheck size={16} /> Verified locally</span></div><Link href={`/bookings/new/${pro.id}`} className={`button button-primary full-button ${!pro.available ? 'disabled-link' : ''}`}>Request a booking <ArrowRight size={17} /></Link><small className="cta-footnote">No payment is taken here. Send a request first.</small></aside></div>
    <section className="reviews-section"><SectionTitle title="Good work, said simply." detail="Notes from people who’ve booked this professional." />{pro.reviews.length ? <div className="review-grid">{pro.reviews.map((r) => <article className="review-card" key={r.id}><div className="review-stars">{Array.from({ length: r.rating }, (_, i) => <Star key={i} size={14} fill="currentColor" />)}</div><p>“{r.comment}”</p><span>{r.customerName} · {dateLabel(r.createdAt)}</span></article>)}</div> : <Empty title="The first review is still to come" body="Be the neighbor who leaves the first note after a great visit." />}</section>
  </main></Shell>;
}
function NewBooking() {
  const params = useParams<{ professionalId: string }>();
  const user = usePageUser();
  const profQ = useGetProfessional(params.professionalId || '', { query: { queryKey: getGetProfessionalQueryKey(params.professionalId || ''), enabled: !!params.professionalId } });
  const categoriesQ = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });
  const create = useCreateBooking();
  const qc = useQueryClient(); const [, setLocation] = useLocation();
  const [error, setError] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [bookingPoint, setBookingPoint] = useState<[number, number]>(DEFAULT_CENTER);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    const urls = photoFiles.map((file) => URL.createObjectURL(file));
    setPhotoPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photoFiles]);
  if (profQ.isLoading || categoriesQ.isLoading) return <Shell user={user.data}><Page title="Request a visit"><Loading /></Page></Shell>;
  if (profQ.isError || !profQ.data) return <Shell user={user.data}><Page title="Professional unavailable"><QueryError onRetry={() => profQ.refetch()} /></Page></Shell>;
  const prof = profQ.data;
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError('');
    const form = new FormData(e.currentTarget);
    try {
      let photos: string[] = [];
      if (photoFiles.length) {
        setUploading(true);
        const uploadData = new FormData(); photoFiles.forEach((f) => uploadData.append('photos', f));
        const response = await fetch('/api/uploads', { method: 'POST', body: uploadData, credentials: 'include' });
        if (!response.ok) throw new Error('Photos could not be uploaded.');
        const uploaded = await response.json() as { photos?: string[]; paths?: string[] };
        photos = uploaded.photos || uploaded.paths || [];
        setUploading(false);
      }
      create.mutate({ data: { professionalId: prof.id, categoryId: String(form.get('categoryId')), title: String(form.get('title')), description: String(form.get('description')), preferredAt: new Date(String(form.get('preferredAt'))).toISOString(), address: String(form.get('address')), latitude: bookingPoint[0], longitude: bookingPoint[1], photos } }, { onSuccess: (booking) => { qc.invalidateQueries({ queryKey: getListBookingsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); setLocation(`/bookings/${booking.id}`); }, onError: () => setError('Your request didn’t go through. Check your connection and try again.') });
    } catch { setUploading(false); setError('Photos could not be sent. Please try again or remove them.'); }
  };
  return <Shell user={user.data}><Page eyebrow="A CLEAR REQUEST, A GOOD START" title="Tell them what you need." subtitle="Your request goes straight to your chosen professional."><div className="booking-create-grid"><form className="panel booking-form" onSubmit={submit}><div className="form-section-intro"><span className="form-step">01</span><div><h2>About the job</h2><p>Share enough detail to help your pro come prepared.</p></div></div><label className="field-label">Service category<select name="categoryId" required defaultValue={prof.categories[0] || ''} className="text-input">{(categoriesQ.data || []).map((c: Category) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label className="field-label">A short title<input name="title" required minLength={3} className="text-input" placeholder="e.g. Kitchen tap is leaking" /></label><label className="field-label">What’s going on?<textarea name="description" required minLength={10} rows={4} className="text-input" placeholder="Tell us what you’ve noticed, when it started, and anything else that may help." /></label><label className="field-label">Preferred visit time<input name="preferredAt" type="datetime-local" required className="text-input" min={new Date().toISOString().slice(0,16)} /></label><div className="address-map-field"><label className="field-label">Where should they come?<textarea name="address" required rows={2} className="text-input" placeholder="House / flat, street, area, Coimbatore" /><small>Tap the map to pin the visit location.</small><span className="map-coordinate">{bookingPoint[0].toFixed(5)}, {bookingPoint[1].toFixed(5)}</span></label><ServiceMap selectable selectedPoint={bookingPoint} center={bookingPoint} onSelect={setBookingPoint} className="booking-pin-map" /></div><label className="field-label">Photos <span className="optional-note">OPTIONAL · UP TO 5</span><input type="file" accept="image/*" multiple className="file-input" onChange={(e) => setPhotoFiles(Array.from(e.target.files || []).filter((file) => file.type.startsWith('image/')).slice(0, 5))} />{photoFiles.length > 0 && <small>{photoFiles.length} of 5 photos selected</small>}</label>{photoPreviews.length > 0 && <div className="photo-preview-grid">{photoPreviews.map((src, i) => <div className="photo-preview" key={src}><img src={src} alt={`Selected repair photo ${i + 1}`} /><button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setPhotoFiles((current) => current.filter((_, index) => index !== i))}><X size={14} /></button></div>)}</div>}{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary submit-button" disabled={create.isPending || uploading}>{uploading ? 'Sending photos…' : create.isPending ? 'Sending your request…' : 'Send booking request'}<ArrowRight size={17} /></button><p className="secure-note"><ShieldCheck size={15} /> You can follow every update in your booking timeline.</p></form><aside className="booking-summary panel"><p className="eyebrow">YOUR CHOSEN PROFESSIONAL</p><div className="summary-pro"><Avatar name={prof.name} url={prof.photoUrl} /><div><b>{prof.name}</b><small>{prof.categories.join(' · ')}</small></div></div><div className="summary-line"><span>Starting price</span><b>{money(prof.price)} / {prof.priceType}</b></div><div className="summary-line"><span>Professional status</span><span className={`summary-status ${prof.available ? 'online' : ''}`}><i />{prof.available ? 'Taking requests' : 'Currently away'}</span></div><div className="summary-trust"><FileCheck2 size={17} /><span>Sending this is just a request. You’ll be able to see when it’s accepted and what happens next.</span></div></aside></div></Page></Shell>;
}

const STATUS_STEPS = ['requested', 'accepted', 'on_the_way', 'in_progress', 'completed'];
function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const user = usePageUser();
  const q = useGetBooking(params.id || '', { query: { queryKey: getGetBookingQueryKey(params.id || ''), enabled: !!params.id } });
  const statusMut = useUpdateBookingStatus(); const reviewMut = useCreateReview();
  const qc = useQueryClient(); const [rating, setRating] = useState(5); const [comment, setComment] = useState(''); const [error, setError] = useState('');
  const [toolsNote, setToolsNote] = useState(''); const [toolsSaving, setToolsSaving] = useState(false);
  // @ts-ignore
  useEffect(() => { if (q.data?.toolsNote) setToolsNote(q.data.toolsNote); }, [q.data]);
  if (q.isLoading) return <Shell user={user.data}><Page title="Booking details"><Loading /></Page></Shell>;
  if (q.isError || !q.data) return <Shell user={user.data}><Page title="Booking not found"><QueryError onRetry={() => q.refetch()} /></Page></Shell>;
  const booking = q.data as any; const role = user.data?.role;
  const allowed = role === 'professional' ? (booking.status === 'requested' ? ['accepted', 'declined'] : booking.status === 'accepted' ? ['on_the_way', 'cancelled'] : booking.status === 'on_the_way' ? ['in_progress'] : booking.status === 'in_progress' ? ['completed'] : []) : booking.status === 'requested' || booking.status === 'accepted' ? ['cancelled'] : [];
  const setStatus = (status: string) => statusMut.mutate({ id: booking.id, data: { status: status as 'accepted' | 'declined' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled' } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetBookingQueryKey(booking.id) }); qc.invalidateQueries({ queryKey: getListBookingsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); }, onError: () => setError('We couldn\'t update this booking. Please retry.') });
  const doReview = (e: FormEvent) => { e.preventDefault(); reviewMut.mutate({ id: booking.id, data: { rating, comment } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetBookingQueryKey(booking.id) }); qc.invalidateQueries({ queryKey: getGetProfessionalQueryKey(booking.professionalId) }); }, onError: () => setError('Your review could not be saved. Please try again.') }); };
  const saveToolsNote = async () => { setToolsSaving(true); try { await fetch(`/api/bookings/${booking.id}/tools-note`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toolsNote }) }); qc.invalidateQueries({ queryKey: getGetBookingQueryKey(booking.id) }); } finally { setToolsSaving(false); } };
  const currentStep = STATUS_STEPS.indexOf(booking.status);
  return <Shell user={user.data}><main className="page-wrap"><Link href="/dashboard" className="back-link"><ArrowLeft size={16} /> Back to your bookings</Link><div className="booking-detail-head"><div><p className="eyebrow">BOOKING · {booking.id.slice(0, 8).toUpperCase()}</p><h1>{booking.title}</h1><p>{booking.categoryName} · Requested {dateLabel(booking.createdAt)}</p></div><StatusPill status={booking.status} /></div><div className="booking-detail-grid"><section className="panel timeline-panel"><SectionTitle title="Your booking, step by step" detail="We'll keep this timeline current as plans take shape." /><div className="timeline">{STATUS_STEPS.map((step, index) => { const past = currentStep > index; const now = currentStep === index; const skip = ['declined', 'cancelled'].includes(booking.status); return <div className={`timeline-step ${past ? 'done' : ''} ${now ? 'current' : ''}`} key={step}><span className="timeline-node">{past ? <Check size={14} /> : index + 1}</span><div><b>{step.replaceAll('_', ' ')}</b><small>{booking.statusHistory?.find((s: any) => s.status === step) ? dateLabel(booking.statusHistory.find((s: any) => s.status === step)?.createdAt) : now ? 'This is where things stand now.' : 'Coming up'}</small></div></div>})}{['declined', 'cancelled'].includes(booking.status) && <div className="timeline-stop"><X size={15} /> This request was {booking.status}.</div>}</div>
        {booking.photos.length > 0 && <div className="booking-photos"><h3>Photos shared</h3><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>{booking.photos.map((photo: string, i: number) => <a key={photo} href={photo} target="_blank" rel="noreferrer" style={{ display: 'block' }}><img src={photo} alt={`Job detail ${i + 1}`} style={{ width: 130, height: 100, objectFit: 'cover', borderRadius: 8 }} /></a>)}</div></div>}
        {allowed.length > 0 && <div className="status-actions"><h3>{role === 'professional' ? 'Move things forward' : 'Need to change plans?'}</h3>{error && <p className="form-error">{error}</p>}{allowed.map((status: string) => <button key={status} disabled={statusMut.isPending} className={`button ${status === 'declined' || status === 'cancelled' ? 'button-secondary' : 'button-primary'}`} onClick={() => setStatus(status)}>{statusMut.isPending ? 'Updating…' : status === 'accepted' ? 'Accept request' : status === 'declined' ? 'Decline' : status === 'on_the_way' ? 'I\'m on my way' : status === 'in_progress' ? 'Start the job' : status === 'completed' ? 'Mark complete' : 'Cancel request'}</button>)}</div>}
      </section><aside className="booking-side"><div className="panel booking-facts"><p className="eyebrow">THE DETAILS</p><div className="fact"><CalendarDays size={17} /><span><b>Preferred visit</b><small>{dateLabel(booking.preferredAt)}</small></span></div><div className="fact"><MapPin size={17} /><span><b>Visit address</b><small>{booking.address}</small></span></div><div className="fact"><UserRound size={17} /><span><b>{role === 'professional' ? 'Customer' : 'Professional'}</b><small>{role === 'professional' ? booking.customerName : booking.professionalName}</small></span></div><div className="fact"><BriefcaseBusiness size={17} /><span><b>Estimate</b><small>{money(booking.price)}</small></span></div><div className="fact-description"><b>What needs doing</b><p>{booking.description}</p></div></div>
        {role === 'professional' && <div className="panel" style={{ marginTop: 16 }}><p className="eyebrow" style={{ marginBottom: 8 }}>TOOLS &amp; MATERIALS NOTE</p><p style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>Add what you plan to bring. Your customer will see this.</p><textarea value={toolsNote} onChange={(e) => setToolsNote(e.target.value)} rows={3} className="text-input" placeholder="e.g. Pipe wrench, Teflon tape, replacement valve…" style={{ marginBottom: 10 }} /><button className="button button-secondary" disabled={toolsSaving} onClick={saveToolsNote}>{toolsSaving ? 'Saving…' : 'Save note'}</button></div>}
        {role === 'customer' && booking.toolsNote && <div className="panel" style={{ marginTop: 16, background: '#f0f7ff', border: '1px solid #c8dff5' }}><p className="eyebrow" style={{ marginBottom: 6 }}>PROFESSIONAL WILL BRING</p><p style={{ fontSize: 14 }}>{booking.toolsNote}</p></div>}
        {booking.status === 'completed' && role === 'customer' && !booking.review && <form className="panel review-form" onSubmit={doReview}><p className="eyebrow">CLOSE THE LOOP</p><h3>How did it go?</h3><div className="rating-select" role="radiogroup" aria-label="Rating">{[1,2,3,4,5].map((n) => <button type="button" aria-label={`${n} stars`} className={rating >= n ? 'active' : ''} key={n} onClick={() => setRating(n)}><Star size={21} fill="currentColor" /></button>)}</div><textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Leave a helpful note for your neighbors." required minLength={3} rows={3} className="text-input" /><button className="button button-primary full-button" disabled={reviewMut.isPending}>{reviewMut.isPending ? 'Saving…' : 'Share your review'} <ArrowRight size={16} /></button></form>}
        {booking.review && <div className="panel review-saved"><div className="review-stars">{Array.from({ length: booking.review.rating }, (_, i) => <Star key={i} size={14} fill="currentColor" />)}</div><p>"{booking.review.comment}"</p><small>Your review</small></div>}
      </aside></div></main></Shell>;
}

function NotificationsPage() {
  const user = usePageUser(); const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const q = useListNotifications({ query: { queryKey: getListNotificationsQueryKey(), refetchInterval: 15_000 } });
  const mark = useMarkNotificationRead(); const markAll = useMarkAllNotificationsRead();
  const onRead = (id: string) => mark.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() }) });
  const filtered = q.data?.filter((note) => filter === 'all' || !note.read) || [];
  return <Shell user={user.data}><Page eyebrow="DON’T MISS A THING" title="Your updates." subtitle="A simple record of what’s changed, right when it changes." actions={q.data?.some((n) => !n.read) ? <button className="button button-secondary" disabled={markAll.isPending} onClick={() => markAll.mutate(undefined, { onSuccess: () => qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() }) })}>{markAll.isPending ? 'Updating…' : 'Mark all as read'}</button> : null}>
    {!q.isLoading && !q.isError && <div className="notification-filters" role="tablist" aria-label="Filter notifications"><button role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All <span>{q.data?.length || 0}</span></button><button role="tab" aria-selected={filter === 'unread'} className={filter === 'unread' ? 'selected' : ''} onClick={() => setFilter('unread')}>Unread <span>{q.data?.filter((note) => !note.read).length || 0}</span></button></div>}
    {q.isLoading ? <Loading label="Checking for updates" /> : q.isError ? <QueryError onRetry={() => q.refetch()} /> : !q.data?.length ? <Empty title="All quiet on your street" body="Booking changes and useful updates will land here." /> : !filtered.length ? <Empty title="You're all caught up" body="No unread updates at the moment. Your complete notification history is available under All." /> : <div className="notification-list">{filtered.map((note) => <article key={note.id} className={`notification-row ${note.read ? '' : 'unread'}`}><span className="notification-symbol">{note.type.toLowerCase().includes('booking') ? <CalendarDays size={18} /> : <Bell size={18} />}</span><div className="notification-copy"><div><b>{note.title}</b>{!note.read && <span className="unread-label">NEW</span>}</div><p>{note.message}</p><small>{timeAgo(note.createdAt)}</small>{note.bookingId && <Link href={`/bookings/${note.bookingId}`} className="text-link">View booking <ArrowRight size={14} /></Link>}</div>{!note.read && <button className="mark-read" onClick={() => onRead(note.id)} disabled={mark.isPending} aria-label="Mark as read"><Check size={16} /></button>}</article>)}</div>}
  </Page></Shell>;
}
function CustomerProfile() {
  const user = usePageUser(); const bookings = useListBookings({ query: { queryKey: getListBookingsQueryKey() } });
  if (user.isLoading) return <Shell><Page title="Your profile"><Loading /></Page></Shell>;
  if (user.isError || !user.data) return <Shell><Page title="Sign in to view your profile"><Link className="button button-primary" href="/login">Sign in <ArrowRight size={16} /></Link></Page></Shell>;
  const completed = bookings.data?.filter((b) => b.status === 'completed').length || 0;
  return <Shell user={user.data}><Page eyebrow="YOUR NEIGHBORHOOD ACCOUNT" title="Your profile." subtitle="Your details and a little history with Fixora."><div className="customer-profile-grid"><section className="panel identity-card"><Avatar name={user.data.name} url={user.data.photoUrl} size="lg" /><span className="eyebrow">CUSTOMER</span><h2>{user.data.name}</h2><p>{user.data.email}</p><p>{user.data.phone}</p><StatusPill status={user.data.active ? 'active' : 'inactive'} /><div className="profile-count"><b>{completed}</b><span>completed {completed === 1 ? 'booking' : 'bookings'}</span></div></section><section className="panel profile-details"><SectionTitle title="Your details" detail="The details we use to keep your bookings connected." /><div className="detail-line"><span>Name</span><b>{user.data.name}</b></div><div className="detail-line"><span>Email</span><b>{user.data.email}</b></div><div className="detail-line"><span>Phone</span><b>{user.data.phone}</b></div><div className="profile-help"><ShieldCheck size={18} /><p>Your contact details are shared only as needed to coordinate a service visit.</p></div><Link href="/dashboard" className="button button-secondary">Back to my bookings <ArrowRight size={15} /></Link></section></div></Page></Shell>;
}
function ProfessionalProfilePage() {
  const user = usePageUser(); const profileQ = useGetOwnProfessionalProfile({ query: { queryKey: getGetOwnProfessionalProfileQueryKey(), enabled: user.data?.role === 'professional' } });
  const catsQ = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } }); const save = useSaveProfessionalProfile(); const availability = useUpdateAvailability(); const qc = useQueryClient();
  const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  useEffect(() => {
    if (!profilePhotoPreview) setProfilePhotoUrl(profileQ.data?.photoUrl || null);
  }, [profileQ.data?.photoUrl, profilePhotoPreview]);
  useEffect(() => () => {
    if (profilePhotoPreview?.startsWith('blob:')) URL.revokeObjectURL(profilePhotoPreview);
  }, [profilePhotoPreview]);
  if (user.isLoading || (user.data?.role === 'professional' && profileQ.isLoading)) return <Shell user={user.data}><Page title="Your professional profile"><Loading /></Page></Shell>;
  if (user.isError || !user.data) return <Shell><Page title="Sign in to manage your profile"><Link className="button button-primary" href="/login">Sign in <ArrowRight size={16} /></Link></Page></Shell>;
  const profile = profileQ.data;
  const uploadProfilePhoto = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file for your profile photo.'); return; }
    setError(''); setMessage('');
    setProfilePhotoPreview(URL.createObjectURL(file));
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append('photos', file);
      const response = await fetch('/api/uploads', { method: 'POST', body: formData, credentials: 'include' });
      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json() as { photos?: string[]; paths?: string[] };
      const uploadedPath = (result.photos || result.paths || [])[0];
      if (!uploadedPath) throw new Error('No image path returned');
      setProfilePhotoUrl(uploadedPath);
    } catch {
      setError('The profile photo couldn’t be uploaded. Choose it again to retry.');
    } finally {
      setPhotoUploading(false);
    }
  };
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget); setMessage(''); setError('');
    const input: ProfessionalInput = { categories: fd.getAll('categories').map(String), skills: String(fd.get('skills')).split(',').map((s) => s.trim()).filter(Boolean), experienceYears: Number(fd.get('experienceYears')), price: Number(fd.get('price')), priceType: String(fd.get('priceType')) as 'visit'|'hour', serviceRadius: Number(fd.get('serviceRadius')), bio: String(fd.get('bio')), photoUrl: profilePhotoUrl, latitude: 11.0168, longitude: 76.9558, area: String(fd.get('area')) };
    save.mutate({ data: input }, { onSuccess: () => { setMessage('Your profile is saved. Neighbors can see the latest details.'); qc.invalidateQueries({ queryKey: getGetOwnProfessionalProfileQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); }, onError: () => setError('Your profile couldn’t be saved. Check the required details and try again.') });
  };
  const categoryValues = profile?.categories || [];
  return <Shell user={user.data}><Page eyebrow="YOUR SKILLS, YOUR NEIGHBORHOOD" title="Your professional profile." subtitle="Help nearby customers understand what you do best." actions={profile && <button className={`availability-toggle ${profile.available ? 'on' : ''}`} onClick={() => availability.mutate({ data: { available: !profile.available } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetOwnProfessionalProfileQueryKey() }) })} disabled={availability.isPending}><i />{availability.isPending ? 'Updating…' : profile.available ? 'Taking requests' : 'Not available'}</button>}>
    {profileQ.isError && <QueryError onRetry={() => profileQ.refetch()} />}
    {profile?.verification === 'pending' && <div className="verification-note"><Clock3 size={17} /><div><b>Profile review in progress</b><span>We’ll let you know once your details have been checked.</span></div><StatusPill status="pending" /></div>}
    {profile?.verification === 'rejected' && <div className="verification-note rejected"><FileCheck2 size={17} /><div><b>There’s one more step</b><span>Update your details and save to request another review.</span></div></div>}
    <form className="panel professional-form" onSubmit={submit}><div className="form-section-intro"><span className="form-step">01</span><div><h2>What do you do?</h2><p>Give neighbors a clear idea of your skills and experience.</p></div></div><div className="pro-photo-upload"><Avatar name={user.data.name} url={profilePhotoPreview || profilePhotoUrl} size="lg" /><div><label className="field-label">Profile photo <span className="optional-note">ONE IMAGE · OPTIONAL</span><input type="file" accept="image/*" className="file-input" onChange={(event) => uploadProfilePhoto(event.target.files?.[0])} /></label><small>{photoUploading ? 'Uploading your photo…' : profilePhotoUrl ? 'Your image is ready to save with your profile.' : 'A clear photo helps neighbors recognize you.'}</small></div></div><fieldset className="category-checkboxes"><legend>Services you offer <span className="optional-note">SELECT AT LEAST ONE</span></legend>{(catsQ.data || []).map((cat) => <label key={cat.id} className={`category-check ${categoryValues.includes(cat.id) ? 'selected' : ''}`}><input type="checkbox" name="categories" value={cat.id} defaultChecked={categoryValues.includes(cat.id)} />{cat.name}</label>)}</fieldset><label className="field-label">Skills, separated by commas<input name="skills" defaultValue={profile?.skills.join(', ')} className="text-input" placeholder="Pipe repair, tap fitting, leak detection" /></label><label className="field-label">A little about your work<textarea name="bio" defaultValue={profile?.bio} className="text-input" required minLength={10} rows={4} placeholder="What kind of work do you enjoy? What can customers expect?" /></label><div className="form-two-col"><label className="field-label">Years of experience<input name="experienceYears" type="number" min="0" required defaultValue={profile?.experienceYears ?? 1} className="text-input" /></label><label className="field-label">Area in Coimbatore<input name="area" required defaultValue={profile?.area || ''} className="text-input" placeholder="e.g. Saibaba Colony" /></label><label className="field-label">Starting price (₹)<input name="price" type="number" min="1" required defaultValue={profile?.price || ''} className="text-input" /></label><label className="field-label">Price is per<select name="priceType" defaultValue={profile?.priceType || 'visit'} className="text-input"><option value="visit">Visit</option><option value="hour">Hour</option></select></label><label className="field-label">Service radius (km)<input name="serviceRadius" type="number" min="1" required defaultValue={profile?.serviceRadius || 10} className="text-input" /></label></div>{message && <p className="form-success"><CheckCircle2 size={16} />{message}</p>}{error && <p className="form-error">{error}</p>}<button className="button button-primary" disabled={save.isPending || photoUploading}>{photoUploading ? 'Uploading photo…' : save.isPending ? 'Saving profile…' : profile ? 'Save changes' : 'Create my profile'} <ArrowRight size={16} /></button></form>
  </Page></Shell>;
}

function AdminPage() {
  const user = usePageUser(); const summaryQ = useGetAdminSummary({ query: { queryKey: getGetAdminSummaryQueryKey() } });
  const usersQ = useListAdminUsers({ query: { queryKey: getListAdminUsersQueryKey() } });
  const prosQ = useListAdminProfessionals({ query: { queryKey: getListAdminProfessionalsQueryKey() } });
  const bookingsQ = useListAdminBookings({ query: { queryKey: getListAdminBookingsQueryKey() } });
  const verify = useUpdateVerification(); const userStatus = useUpdateUserStatus(); const qc = useQueryClient();
  if (user.isLoading || summaryQ.isLoading) return <Shell user={user.data}><Page title="Marketplace overview"><Loading /></Page></Shell>;
  if (summaryQ.isError || !summaryQ.data) return <Shell user={user.data}><Page title="Marketplace overview"><QueryError onRetry={() => summaryQ.refetch()} /></Page></Shell>;
  const s = summaryQ.data;
  const approve = (id: string, verification: 'verified'|'rejected') => verify.mutate({ id, data: { verification } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListAdminProfessionalsQueryKey() }); qc.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }); } });
  const toggleUser = (account: User) => {
    userStatus.mutate({ id: account.id, data: { active: !account.active } }, { onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
      qc.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: getListAdminProfessionalsQueryKey() });
    } });
  };
  return <Shell user={user.data}><Page eyebrow="FIXORA OPERATIONS" title="Marketplace overview." subtitle="A clear view of the people and work that keep Coimbatore moving.">
    <div className="admin-stats">{([{ label: 'People on Fixora', value: s.users, icon: UsersRound }, { label: 'Local professionals', value: s.professionals, icon: Wrench }, { label: 'Bookings to date', value: s.bookings, icon: CalendarDays }, { label: 'Need a verification', value: s.pendingVerification, icon: ShieldCheck }] as { label: string; value: number; icon: typeof UsersRound }[]).map(({ label, value, icon: Icon }) => <article key={label} className="admin-stat"><span><Icon size={17} /></span><small>{label}</small><b>{value}</b></article>)}</div>
    <div className="admin-grid"><section className="panel admin-panel"><SectionTitle title="Verification desk" detail={`${prosQ.data?.filter((p) => p.verification === 'pending').length ?? (prosQ.isLoading ? '…' : 0)} profiles waiting for a look.`} />{prosQ.isLoading ? <Loading /> : prosQ.isError ? <QueryError onRetry={() => prosQ.refetch()} /> : !prosQ.data?.length ? <Empty title="No profiles to review" body="New professional sign-ups will appear here." /> : <div className="admin-list">{prosQ.data.map((pro) => <article className="admin-person" key={pro.id}><Avatar name={pro.name} url={pro.photoUrl} /><div className="admin-person-info"><b>{pro.name}</b><small>{pro.categories.join(' · ')} · {pro.area}</small></div><StatusPill status={pro.verification} />{pro.verification === 'pending' && <div className="admin-actions"><button aria-label={`Verify ${pro.name}`} className="approve-button" disabled={verify.isPending} onClick={() => approve(pro.id, 'verified')}><Check size={15} /> Verify</button><button aria-label={`Reject ${pro.name}`} className="reject-button" disabled={verify.isPending} onClick={() => approve(pro.id, 'rejected')}><X size={15} /></button></div>}</article>)}</div>}</section>
      <aside className="panel category-summary"><SectionTitle title="Services across town" detail="Bookings by category." />{s.categories.length ? s.categories.map((cat) => <div className="category-count" key={cat.name}><span>{cat.name}</span><b>{cat.count}</b><span className="count-track"><i style={{ width: `${Math.min(100, cat.count / Math.max(1, ...s.categories.map((c) => c.count)) * 100)}%` }} /></span></div>) : <Empty title="No category activity" body="Category totals will show once bookings arrive." />}</aside>
    </div>
    <section className="panel admin-users"><SectionTitle title="Account directory" detail="Activate or pause any customer, professional, or admin account." />{usersQ.isLoading ? <Loading label="Loading marketplace accounts" /> : usersQ.isError ? <QueryError onRetry={() => usersQ.refetch()} /> : usersQ.data?.length ? <div className="table-wrap"><table><thead><tr><th>Account</th><th>Role</th><th>Phone</th><th>Status</th><th>Access</th></tr></thead><tbody>{usersQ.data.map((account) => <tr key={account.id} data-testid={`admin-user-${account.id}`}><td><div className="user-table-cell"><Avatar name={account.name} url={account.photoUrl} size="sm" /><span><b>{account.name}</b><small>{account.email}</small></span></div></td><td className="capitalize">{account.role}</td><td>{account.phone}</td><td><StatusPill status={account.active ? 'active' : 'inactive'} /></td><td><button className={`user-status-button ${account.active ? 'pause-user' : 'activate-user'}`} disabled={userStatus.isPending} onClick={() => toggleUser(account)}>{account.active ? 'Deactivate' : 'Reactivate'}</button></td></tr>)}</tbody></table></div> : <Empty title="No accounts to manage" body="Accounts will appear here as neighbors join Fixora." />}</section>
    <section className="panel admin-bookings"><SectionTitle title="Recent bookings" detail="A live snapshot across the marketplace." />{bookingsQ.isLoading ? <Loading /> : bookingsQ.isError ? <QueryError onRetry={() => bookingsQ.refetch()} /> : bookingsQ.data?.length ? <div className="table-wrap"><table><thead><tr><th>Service</th><th>Customer</th><th>Professional</th><th>Visit</th><th>Status</th><th /></tr></thead><tbody>{bookingsQ.data.slice(0, 8).map((b) => <tr key={b.id}><td><b>{b.title}</b><small>{b.categoryName}</small></td><td>{b.customerName}</td><td>{b.professionalName}</td><td>{dateLabel(b.preferredAt)}</td><td><StatusPill status={b.status} /></td><td><Link href={`/bookings/${b.id}`} className="table-link">Open <ArrowUpRight size={14} /></Link></td></tr>)}</tbody></table></div> : <Empty title="No bookings to review" body="Marketplace bookings will appear here." />}</section>
  </Page></Shell>;
}

function Guard({ children, roles }: { children: ReactNode; roles?: User['role'][] }) {
  const current = usePageUser();
  if (current.isLoading) return <Shell><Page title="Checking your account"><Loading label="Confirming your Fixora session" /></Page></Shell>;
  if (current.isError || !current.data) return <Shell><Page eyebrow="YOUR NEIGHBORHOOD, YOUR ACCOUNT" title="Sign in to continue." subtitle="Your bookings and account details stay private."><Link href="/login" className="button button-primary">Sign in <ArrowRight size={16} /></Link></Page></Shell>;
  if (!current.data.active) return <Shell user={current.data}><Page title="This account is paused." subtitle="Please contact the Fixora team if you think this is a mistake."><div className="panel profile-help"><ShieldCheck size={18} /><p>Your private booking details stay protected while account access is paused.</p></div></Page></Shell>;
  if (roles && !roles.includes(current.data.role)) return <Shell user={current.data}><Page title="This page isn’t part of your account." subtitle="Head back to your Fixora home to continue."><Link className="button button-primary" href={current.data.role === 'admin' ? '/admin' : '/dashboard'}>Go to my home <ArrowRight size={16} /></Link></Page></Shell>;
  return children;
}
function RouteContent() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/" component={Landing} />
    <Route path="/login"><AuthPage mode="login" /></Route>
    <Route path="/signup"><AuthPage mode="signup" /></Route>
    <Route path="/dashboard"><Guard roles={['customer', 'professional']}><Dashboard /></Guard></Route>
    <Route path="/find" component={FindProfessionals} />
    <Route path="/professionals/:id" component={ProfessionalDetailPage} />
    <Route path="/bookings/new/:professionalId"><Guard roles={['customer']}><NewBooking /></Guard></Route>
    <Route path="/bookings/:id"><Guard roles={['customer', 'professional', 'admin']}><BookingDetailPage /></Guard></Route>
    <Route path="/notifications"><Guard><NotificationsPage /></Guard></Route>
    <Route path="/profile"><Guard roles={['customer']}><CustomerProfile /></Guard></Route>
    <Route path="/professional/profile"><Guard roles={['professional']}><ProfessionalProfilePage /></Guard></Route>
    <Route path="/admin"><Guard roles={['admin']}><AdminPage /></Guard></Route>
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={client}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><RouteContent /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;
