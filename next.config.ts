import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development", // PWA hanya aktif saat production (build) agar tidak mengganggu proses dev
  register: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // konfigurasi next.js lainnya bisa ditaruh di sini
};

export default withPWA(nextConfig);