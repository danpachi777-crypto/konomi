(function () {
  const params = new URLSearchParams(location.search);
  const frame = document.getElementById('mobilePreview');
  const width = document.getElementById('previewWidth');
  const allowed = ['320', '390', '430'];
  width.value = allowed.includes(params.get('width')) ? params.get('width') : '390';
  const target = new URL('./', location.href);
  target.search = params.toString();
  target.searchParams.delete('layout');
  target.searchParams.delete('width');
  const desktop = new URL(target.href);
  desktop.searchParams.set('layout', 'desktop');
  document.getElementById('desktopLink').href = desktop.href;
  function setWidth() {
    document.documentElement.style.setProperty('--preview-width', width.value + 'px');
    const current = new URL(location.href);
    current.searchParams.set('width', width.value);
    history.replaceState(null, '', current);
  }
  width.addEventListener('change', setWidth);
  document.getElementById('refreshPreview').addEventListener('click', () => {
    frame.contentWindow.location.reload();
  });
  setWidth();
  frame.src = target.href;
})();
