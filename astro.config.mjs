import { defineConfig } from 'astro/config';

// Sitio estatico: las 10 paginas son HTML puro, no hay endpoints ni
// formularios, asi que no hace falta un servidor. Se publica en Vercel
// (CDN) en vez de correr bajo pm2 detras de cloudflared: asi la web no
// depende de que una maquina este prendida.
export default defineConfig({
  site: 'https://goycazlabs.com',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
