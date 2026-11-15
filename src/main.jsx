import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const topics = [['Naturaleza', 'nature'], ['Viajes', 'travel'], ['Arquitectura', 'architecture'], ['Flores', 'flowers'], ['Arte', 'art'], ['Animales', 'animals'], ['Comida', 'food'], ['Paisajes', 'landscape']];
const translations = Object.fromEntries(topics.map(([label, term]) => [label.toLowerCase(), term]));
const clean = value => { const element = document.createElement('div'); element.innerHTML = value || ''; return (element.textContent || '').replace(/\s+/g, ' ').trim(); };
const about = () => alert('Pinboard es una demostración independiente. Las fotografías se consultan en Wikimedia Commons y se filtran por dominio público o CC0. Revisa la página de cada imagen para consultar sus condiciones. Los guardados permanecen en este navegador.');

function Icon({ name }) {
  if (name === 'home') return <svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" /></svg>;
  if (name === 'saved') return <svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z" /></svg>;
  if (name === 'search') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="7" /><path d="m16 16 5 5" /></svg>;
  return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>;
}

function App() {
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [view, setView] = useState('home');
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState('loading');
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState(null);
  const [saved, setSaved] = useState(() => { try { return JSON.parse(localStorage.getItem('pinboard-saved') || '{}'); } catch { return {}; } });
  const dialog = useRef(null);
  const translated = translations[term.toLowerCase()] || term || 'nature landscape';

  useEffect(() => { try { localStorage.setItem('pinboard-saved', JSON.stringify(saved)); } catch { /* El navegador puede bloquear almacenamiento. */ } }, [saved]);
  useEffect(() => {
    if (view !== 'home') return;
    const controller = new AbortController();
    async function load() {
      setStatus('loading');
      try {
        const params = new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'search', gsrnamespace: '6', gsrsearch: `${translated} filetype:bitmap`, gsrlimit: '50', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '500' });
        const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Error de conexión');
        const data = await response.json();
        if (data.error) throw new Error(data.error.info);
        const results = Object.values(data.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0)).map(page => {
          const image = page.imageinfo?.[0], metadata = image?.extmetadata || {}, license = clean(metadata.LicenseShortName?.value);
          return { id: String(page.pageid), title: clean(page.title.replace(/^File:/, '').replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')), url: image?.thumburl, large: image?.thumburl, page: image?.descriptionurl, license, author: clean(metadata.Artist?.value), usage: clean(metadata.UsageTerms?.value) };
        }).filter(photo => photo.url && photo.page && (/^(CC0|Public domain|PD)/i.test(photo.license) || /public domain/i.test(photo.usage)));
        setPhotos(results); setStatus('ready');
      } catch (error) { if (error.name !== 'AbortError') setStatus('error'); }
    }
    load(); return () => controller.abort();
  }, [translated, view, retry]);
  useEffect(() => { const node = dialog.current; if (!node) return; if (selected && !node.open) node.showModal(); if (!selected && node.open) node.close(); }, [selected]);
  function search(value) { setQuery(value); setTerm(value.trim()); setView('home'); }
  function home() { setQuery(''); setTerm(''); setView('home'); }
  function toggle(photo) { setSaved(previous => { const next = { ...previous }; if (next[photo.id]) delete next[photo.id]; else next[photo.id] = photo; return next; }); }
  const items = view === 'saved' ? Object.values(saved) : photos;
  const isLoading = view === 'home' && status === 'loading';
  const isError = view === 'home' && status === 'error';
  return <>
    <nav className="sidebar" aria-label="Navegación principal">
      <a className="logo" href="./" aria-label="Pinboard, inicio">P</a>
      <button className={`sidebtn ${view === 'home' ? 'active' : ''}`} onClick={home} aria-label="Inicio" title="Inicio"><Icon name="home" /></button>
      <button className={`sidebtn ${view === 'saved' ? 'active' : ''}`} onClick={() => setView('saved')} aria-label="Guardados" title="Guardados"><Icon name="saved" /></button>
      <button className="sidebtn bottom" onClick={about} aria-label="Información" title="Información"><Icon name="info" /></button>
    </nav>
    <header><form className="search" role="search" onSubmit={event => { event.preventDefault(); search(query); }}><Icon name="search" /><input type="search" placeholder="Buscar ideas" aria-label="Buscar fotografías" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} /></form><button className="avatar" onClick={() => setView('saved')} aria-label="Ver guardados" title="Ver guardados">M</button></header>
    <main>
      <div className="tabs"><button className={`tab ${view === 'home' ? 'active' : ''}`} onClick={home}>Para ti</button><button className={`tab ${view === 'saved' ? 'active' : ''}`} onClick={() => setView('saved')}>Guardados</button></div>
      <section className="heading"><p>{view === 'saved' ? 'Tu colección' : term ? 'Explora imágenes de dominio público' : 'Un poco de inspiración para hoy'}</p><h1>{view === 'saved' ? 'Tus ideas guardadas' : term ? `Resultados para «${term}»` : 'Ideas para ti'}</h1></section>
      {view === 'home' && <div className="chips" aria-label="Temas sugeridos">{topics.map(([label, value]) => <button key={value} className={`chip ${translated === value ? 'active' : ''}`} onClick={() => search(label)}>{label}</button>)}</div>}
      <div className="state" role="status" aria-live="polite" hidden={!isLoading && !isError && items.length > 0}>
        {isLoading ? <><div className="loader" />Buscando ideas…</> : isError ? <>No se pudieron cargar las imágenes. Comprueba tu conexión e inténtalo de nuevo.<br /><br /><button onClick={() => setRetry(n => n + 1)}>Reintentar</button></> : view === 'saved' ? 'Aún no tienes ideas guardadas. Explora fotos y pulsa «Guardar».' : 'No encontramos imágenes de dominio público para esta búsqueda. Prueba con otro término.'}
      </div>
      {!isLoading && !isError && <section className="grid" aria-label="Fotografías">{items.map(photo => <article className="pin" key={photo.id}><div className="picture"><button className="photo-open" onClick={() => setSelected(photo)} aria-label={`Ver ${photo.title}`}><img src={photo.url} alt={photo.title} loading="lazy" /></button><button className={`save ${saved[photo.id] ? 'saved' : ''}`} aria-label={`${saved[photo.id] ? 'Quitar de guardados' : 'Guardar'}: ${photo.title}`} onClick={() => toggle(photo)}>{saved[photo.id] ? 'Guardado' : 'Guardar'}</button></div><h2>{photo.title}</h2><small>Wikimedia Commons · {photo.license}</small></article>)}</section>}
    </main>
    <button className="help" onClick={about} aria-label="Acerca de las imágenes">?</button>
    <dialog ref={dialog} aria-labelledby="detailTitle" onClose={() => setSelected(null)} onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}>
      {selected && <div className="modal"><img src={selected.large} alt={selected.title} /><div className="detail"><div className="detail-actions"><button className="close" onClick={() => setSelected(null)} aria-label="Cerrar">×</button><button className={`save modal-save ${saved[selected.id] ? 'saved' : ''}`} onClick={() => toggle(selected)}>{saved[selected.id] ? 'Guardado' : 'Guardar'}</button></div><h2 id="detailTitle">{selected.title}</h2><p>Autor: {selected.author || 'Consultar en la fuente'} · Licencia: {selected.license}. Consulta la página de origen para conocer los detalles de la imagen.</p><a href={selected.page} target="_blank" rel="noopener noreferrer">Ver imagen y licencia en Wikimedia Commons ↗</a></div></div>}
    </dialog>
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
