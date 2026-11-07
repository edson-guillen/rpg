/* Início do app: roda depois de todos os módulos carregados. */
refreshAll();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

setTimeout(() => ensureArt(), 1200);
nuvemIniciar();
