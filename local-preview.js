(function () {
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
  if (!local || window.top !== window) return;
  const params = new URLSearchParams(location.search);
  if (params.get('layout') === 'mobile') {
    const preview = new URL('preview.html', location.href);
    preview.search = params.toString();
    location.replace(preview.href);
    return;
  }
  document.addEventListener('DOMContentLoaded', () => {
    const about = document.getElementById('aboutButton');
    if (!about) return;
    const tools = document.createElement('div');
    tools.className = 'local-header-actions';
    about.parentNode.insertBefore(tools, about);
    const link = document.createElement('a');
    link.className = 'local-mobile-link';
    link.textContent = 'スマホ表示';
    const target = new URL(location.href);
    target.searchParams.set('layout', 'mobile');
    link.href = target.href;
    tools.append(link, about);
  });
})();
