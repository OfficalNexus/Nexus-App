window.UI = (() => {
  const paths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7M6 10h12"/>',
    keyboard: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M7 16h10"/>',
    controller: '<path d="M7 7h10c3 0 4 3 5 9 .4 3-2 4-4 2l-2-2H8l-2 2c-2 2-4.4 1-4-2 1-6 2-9 5-9zM6 10v5M3.5 12.5h5M16 11h.01M19 14h.01"/>',
    history: '<path d="M3 11a9 9 0 1 1 2 7M3 3v6h6M12 7v5l3 2"/>',
    profiles: '<rect x="5" y="7" width="15" height="14" rx="2"/><path d="M16 7V3H2v14h3M9 12h7M9 16h5"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    shield: '<path d="m12 2 8 3v6c0 6-8 11-8 11S4 17 4 11V5zM8 12l3 3 5-6"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sound: '<path d="m4 9 4 0 5-4v14l-5-4H4zM16 8c3 2 3 6 0 8M19 5c5 4 5 10 0 14"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const heading = (title, description, action = '') => `<header class="page-heading"><div><h1>${title}</h1><p>${description}</p></div>${action}</header>`;
  const toggle = (key, title, description, checked) => `<label class="setting-row" for="${key}"><span><strong>${title}</strong><small>${description}</small></span><span class="toggle-wrapper"><span class="toggle-state" id="${key}-state">${checked ? 'On' : 'Off'}</span><input id="${key}" type="checkbox" role="switch" ${checked ? 'checked' : ''}><span class="toggle-track" aria-hidden="true"></span></span></label>`;
  const notice = text => `<div class="notice"><span class="nav-icon">${icon('info')}</span><p>${text}</p></div>`;
  const empty = (symbol, title, description) => `<div class="empty-state"><span class="empty-icon">${icon(symbol)}</span><h3>${title}</h3><p>${description}</p></div>`;
  return { icon, escape, heading, toggle, notice, empty };
})();
