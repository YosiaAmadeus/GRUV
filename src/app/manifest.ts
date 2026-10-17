import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GRUV - Stage-Ready Sequencer',
    short_name: 'GRUV',
    description: 'Zero-latency metronome and sequencer for drummers.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#10b981',
    icons: [
      {
        src: '/logo/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}