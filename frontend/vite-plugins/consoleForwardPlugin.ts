import type { Plugin, ViteDevServer } from 'vite';

type ConsoleLevel = 'warn' | 'error';

interface ConsoleForwardPayload {
  level: ConsoleLevel;
  message: string;
}

const VIRTUAL_MODULE_ID = 'virtual:console-forward';
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID;
const HMR_EVENT = 'laborant:console-forward';

/** В dev пробрасывает уникальные console.warn/error и необработанные ошибки из браузера в терминал Vite. */
export function consoleForwardPlugin(): Plugin {
  const seenMessages = new Set<string>();

  const logUnique = (server: ViteDevServer, level: ConsoleLevel, message: string) => {
    const key = `${level}\0${message}`;
    if (seenMessages.has(key)) {
      return;
    }
    seenMessages.add(key);

    const formatted = `[browser:${level}] ${message}`;
    if (level === 'error') {
      server.config.logger.error(formatted, { timestamp: true });
      return;
    }
    server.config.logger.warn(formatted, { timestamp: true });
  };

  return {
    name: 'laborant-console-forward',
    apply: 'serve',
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
      return undefined;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) {
        return undefined;
      }

      return `
const levels = ['warn', 'error'];
const serialize = (value, seen = new WeakSet()) => {
  if (value == null) return String(value);
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    if (Array.isArray(value)) {
      return '[' + value.map(item => serialize(item, seen)).join(', ') + ']';
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const forward = (level, args) => {
  if (!import.meta.hot) return;
  const message = args.map(serialize).join(' ');
  import.meta.hot.send('${HMR_EVENT}', { level, message });
};

for (const level of levels) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    original(...args);
    forward(level, args);
  };
}

window.addEventListener('error', (event) => {
  const parts = [event.message];
  if (event.filename) {
    parts.push('at ' + event.filename + ':' + event.lineno + ':' + event.colno);
  }
  if (event.error?.stack) {
    parts.push(event.error.stack);
  }
  forward('error', [parts.join('\\n')]);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (reason instanceof Error) {
    forward('error', [reason.stack || reason.message]);
    return;
  }
  forward('error', [serialize(reason)]);
});
`;
    },
    configureServer(server) {
      server.ws.on(HMR_EVENT, (payload: ConsoleForwardPayload) => {
        if (!payload?.message) {
          return;
        }
        logUnique(server, payload.level, payload.message);
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler() {
        return [
          {
            tag: 'script',
            attrs: { type: 'module' },
            children: `import '${VIRTUAL_MODULE_ID}';`,
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}
