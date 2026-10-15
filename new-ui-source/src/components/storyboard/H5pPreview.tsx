import { useEffect, useRef, useState } from 'react';
import mainBundle from 'h5p-standalone/dist/main.bundle.js?url';
import frameBundle from 'h5p-standalone/dist/frame.bundle.js?url';
import frameStyles from 'h5p-standalone/dist/styles/h5p.css?inline';
import { h5pContentRoot, safePreviewSrc, type AssetRef } from './mediaMapping';

export default function H5pPreview({ asset }: { asset?: AssetRef }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(360);
  const root = h5pContentRoot(asset);
  const external = asset?.external ? safePreviewSrc(asset.url, asset.link) : '';
  const embed = /^(https?:)?\/\//i.test(external) ? external : '';

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
    return <div className="py-4 text-sm text-muted-foreground">{asset?.link ? 'H5P content is unavailable. Select the package again.' : 'No H5P source'}</div>;
  }

  const absolute = (url: string) => new URL(url, window.location.href).href;
  const options = JSON.stringify({
    h5pJsonPath: root ? absolute(root) : '',
    frameJs: absolute(frameBundle),
    frameCss: `data:text/css;charset=utf-8,${encodeURIComponent(frameStyles)}`,
    fullScreen: true,
  }).replace(/</g, '\\u003c');
  const srcDoc = root ? `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>html,body{margin:0;padding:0}#status{font:14px sans-serif;padding:16px;color:#555}</style>
    </head><body><div id="status" role="status">Loading H5P content...</div><div id="player"></div>
    <script src=${JSON.stringify(absolute(mainBundle))}></script><script>
      const status = document.getElementById('status');
      const player = document.getElementById('player');
      const resize = () => parent.postMessage({type:'storyboard-h5p-resize',height:document.body.scrollHeight}, ${JSON.stringify(window.location.origin)});
      new ResizeObserver(resize).observe(player);
      Promise.resolve().then(() => new H5PStandalone.H5P(player, ${options}))
        .then(() => { status.remove(); resize(); })
        .catch(() => { status.textContent = 'Unable to load H5P content. Check that the package includes its libraries.'; resize(); });
    </script></body></html>` : undefined;

  return (
    <iframe
      key={root || embed}
      ref={frameRef}
      title="H5P content"
      src={root ? undefined : embed}
      srcDoc={srcDoc}
      className="w-full border-0"
      style={{ height }}
      allow="autoplay; fullscreen"
      allowFullScreen
    />
  );
}