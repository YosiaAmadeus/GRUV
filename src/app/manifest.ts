import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GRUV - Stage-Ready Sequencer',
    short_name: 'GRUV',
    description: 'Zero-latency metronome and sequencer for drummers.',
    start_url: '/',
    display: 'standalone', // Ini yang membuat address bar browser hilang
    background_color: '#000000', // Warna hitam
    theme_color: '#10b981', // Warna emerald Tailwind
    icons: [
      {
        src: 'https://dummyimage.com/192x192/10b981/000000.png&text=G',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'https://dummyimage.com/512x512/10b981/000000.png&text=GRUV',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}