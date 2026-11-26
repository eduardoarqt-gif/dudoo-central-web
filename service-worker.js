// Central Dudoo no celular: lista dos arquivos do app. A regra do cache mora no núcleo (nucleo/nucleo_web_sw.js). Ao publicar mudança, suba o número do cache E o VERSAO do app.js.
self.NUCLEO_SW = {
  cache: 'dudoo-central-web-v2',
  casco: ['./', 'index.html', 'app.js', 'manifest.webmanifest', 'nucleo/nucleo_web.css', 'nucleo/nucleo_web.js', 'nucleo/nucleo_web_sw.js', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
};
importScripts('nucleo/nucleo_web_sw.js');
