'use strict';

/**
 * uWebSockets.js Compatibility Layer
 *
 * Tries to require 'uWebSockets.js'. If that fails (e.g. Node 22+ / 24+ without prebuilt binaries),
 * provides an API-compatible fallback backed by Node's standard `http` + `ws` libraries.
 */

let nativeUws = null;
try {
  nativeUws = require('uWebSockets.js');
} catch {
  // Native uWS not available on this Node version / platform
}

if (nativeUws) {
  module.exports = nativeUws;
} else {
  const http = require('http');
  const { WebSocketServer } = require('ws');
  const { URL } = require('url');

  class CompatApp {
    constructor() {
      this._routes = new Map(); // path -> config
      this._server = http.createServer((req, res) => {
        res.writeHead(404);
        res.end('Not Found');
      });
    }

    ws(pattern, config) {
      this._routes.set(pattern, config);
      return this;
    }

    listen(port, hostOrCallback, maybeCallback) {
      const portNum = typeof port === 'number' ? port : parseInt(port, 10);
      const callback = typeof hostOrCallback === 'function' ? hostOrCallback : maybeCallback;

      const wssMap = new Map();
      for (const [pattern, config] of this._routes) {
        const wss = new WebSocketServer({ noServer: true });
        wssMap.set(pattern, { wss, config });

        wss.on('connection', (ws, req, extraData) => {
          Object.assign(ws, extraData);
          if (config.open) config.open(ws);

          ws.on('message', (data, isBinary) => {
            if (config.message) {
              config.message(ws, data, isBinary);
            }
          });

          ws.on('close', (code, message) => {
            if (config.close) config.close(ws, code, message);
          });

          ws.on('error', (err) => {
            if (config.close) config.close(ws, 1006, Buffer.from(err.message));
          });
        });
      }

      this._server.on('upgrade', async (req, socket, head) => {
        const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = reqUrl.pathname;

        let matched = null;
        for (const [pattern, item] of wssMap) {
          if (pattern === '/*' || pattern === pathname) {
            matched = item;
            break;
          }
        }

        if (!matched) {
          socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
          socket.destroy();
          return;
        }

        const { wss, config } = matched;

        if (config.upgrade) {
          let upgraded = false;
          const fakeReq = {
            getHeader: (name) => req.headers[name.toLowerCase()] || '',
            getQuery: (key) => key ? reqUrl.searchParams.get(key) || '' : reqUrl.search.replace(/^\?/, ''),
            getUrl: () => pathname,
          };

          const fakeRes = {
            onAborted: () => {},
            writeStatus: (status) => ({
              end: (msg) => {
                const code = status.split(' ')[0] || '400';
                socket.write(`HTTP/1.1 ${status}\r\nContent-Type: text/plain\r\n\r\n${msg || ''}`);
                socket.destroy();
              }
            }),
            upgrade: (userData) => {
              upgraded = true;
              wss.handleUpgrade(req, socket, head, (ws) => {
                wss.emit('connection', ws, req, userData);
              });
            },
          };

          try {
            await config.upgrade(fakeRes, fakeReq, null);
          } catch (e) {
            if (!upgraded) {
              socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
              socket.destroy();
            }
          }
        } else {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req, {});
          });
        }
      });

      this._server.listen(portNum, () => {
        if (callback) callback({ port: portNum });
      });

      this._server.on('error', (err) => {
        if (callback) callback(null);
      });
    }
  }

  module.exports = {
    App: () => new CompatApp(),
    SHARED_COMPRESSOR: 1,
    DEDICATED_COMPRESSOR_3KB: 2,
    DEDICATED_COMPRESSOR_4KB: 3,
    DEDICATED_COMPRESSOR_8KB: 4,
    DEDICATED_COMPRESSOR_16KB: 5,
    DEDICATED_COMPRESSOR_32KB: 6,
    DEDICATED_COMPRESSOR_64KB: 7,
    DEDICATED_COMPRESSOR_128KB: 8,
    DEDICATED_COMPRESSOR_256KB: 9,
    DISABLED: 0,
  };
}
