import { useEffect, useRef, useState } from 'react';
import { h5pContentRoot, h5pEmbedUrl, type AssetRef } from './mediaMapping';

export default function H5pPreview({ asset }: { asset?: AssetRef }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(360);
  const root = h5pContentRoot(asset);
  const embed = asset?.external ? h5pEmbedUrl(asset.link || asset.url) : '';

  useEffect(() => {
    const resize = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow || event.data?.type !== 'storyboard-h5p-resize') return;
      const next = Number(event.data.height);
      if (Number.isFinite(next)) setHeight(Math.max(240, Math.min(2000, next)));
    };
    window.addEventListener('message', resize);
    return () => window.removeEventListener('message', resize);
  }, []);

  if (!root && !embed) {
    return <div className="py-4 text-sm text-muted-foreground">{asset?.link ? 'Select an internal H5P package or an HTTP(S) embed-page URL, not a .h5p download.' : 'No H5P source'}</div>;
  }

  const absolute = (url: string) => new URL(url, window.location.href).href;
  const playerRoot = '/h5p-preview-assets/player';
  const options = JSON.stringify({
    h5pJsonPath: root ? absolute(root) : '',
    frameJs: absolute(`${playerRoot}/frame.bundle.js`),
    frameCss: absolute(`${playerRoot}/styles/h5p.css`),
    embedType: 'div',
    assetsRequestFetchOptions: { credentials: 'omit', mode: 'cors' },
    fullScreen: true,
  }).replace(/</g, '\\u003c');
  const srcDoc = root ? `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>html,body{margin:0;padding:0}#status{font:14px sans-serif;padding:16px;color:#555}</style>
    </head><body><div id="status" role="status">Loading H5P content...</div><div id="player"></div>
    <script crossorigin="anonymous" src=${JSON.stringify(absolute(`${playerRoot}/main.bundle.js`))}></script><script>
      for (const name of ['localStorage', 'sessionStorage']) {
        const values = new Map();
        Object.defineProperty(window, name, { value: {
          getItem: (key) => values.get(String(key)) ?? null,
          setItem: (key, value) => { values.set(String(key), String(value)); },
          removeItem: (key) => { values.delete(String(key)); },
          clear: () => { values.clear(); },
          key: (index) => [...values.keys()][index] ?? null,
          get length() { return values.size; }
        } });
      }
      const status = document.getElementById('status');
      const player = document.getElementById('player');
      const resize = () => parent.postMessage({type:'storyboard-h5p-resize',height:document.body.scrollHeight}, ${JSON.stringify(window.location.origin)});
      new ResizeObserver(resize).observe(player);
      Promise.resolve().then(() => new H5PStandalone.H5P(player, ${options}))
        .then(() => { status.remove(); resize(); })
        .catch((error) => { console.error('H5P preview initialization failed', error); status.textContent = 'Unable to load H5P content. Check that the package includes its libraries.'; resize(); });
    </script></body></html>` : undefined;

  return (
    <iframe
      key={root || embed}
      ref={frameRef}
      title="H5P content"
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      src={root ? undefined : embed}
      srcDoc={srcDoc}
      className="w-full border-0"
      style={{ height }}
      allow="autoplay; fullscreen"
      allowFullScreen
    />
  );
}