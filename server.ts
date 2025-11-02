import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import express from 'express';
import fs from 'fs';
import https from 'https';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bootstrap from './src/main.server';

const STATUS_MARKER_RE = /<!--SSR_STATUS:(\d{3})-->/;

export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');

  const commonEngine = new CommonEngine();

  server.set('view engine', 'html');
  server.set('views', browserDistFolder);

  // Pliki statyczne (cache 1 rok, bez ingerencji SSR)
  server.get(
    '*.*',
    express.static(browserDistFolder, {
      maxAge: '1y',
      index: 'index.html',
    })
  );

  // Wszystkie pozostałe trasy renderuje Angular SSR
  server.get('**', (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        publicPath: browserDistFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
      })
      .then((html) => {
        // Wykryj marker statusu z komponentu (np. <!--SSR_STATUS:404-->)
        const m = html.match(STATUS_MARKER_RE);
        if (m) {
          const code = parseInt(m[1], 10);
          if (!Number.isNaN(code)) {
            res.status(code);
          }
        }
        res.send(html);
      })
      .catch((err) => next(err));
  });

  // Prost y handler błędów – 500 na wypadek wyjątków
  // (Nginx i tak zwróci 502/500 jeśli Node nie odpowie)
  server.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      // eslint-disable-next-line no-console
      console.error('[SSR ERROR]', err);
      res.status(500).send('Wewnętrzny błąd serwera');
    }
  );

  return server;
}

function run(): void {
  const port = process.env['PORT'] || 4000;

  const server = app();

  const options = {
    key: fs.readFileSync('/etc/ssl/private/ragnarok-rooms.pl.key'),
    cert: fs.readFileSync('/etc/ssl/certs/ragnarok-rooms.pl.bundle.crt'),
  };

  https.createServer(options, server).listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Node HTTPS server listening on https://localhost:${port}`);
  });
}

run();
