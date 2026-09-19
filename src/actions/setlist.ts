"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getMySetlists() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return [];

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return [];

  return await prisma.setlist.findMany({
    where: { userId: user.id },
    include: { tracks: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createSetlist(name: string, description?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Belum login!");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User tidak ditemukan");

  // CEK BATAS MAKSIMAL 5 SETLIST
  const count = await prisma.setlist.count({ where: { userId: user.id } });
  if (count >= 5) {
    throw new Error("Batas maksimal 5 setlist telah tercapai.");
  }

  await prisma.setlist.create({
    data: { name, description, userId: user.id },
  });

  revalidatePath("/");
}

// FUNGSI BARU: Hapus Setlist
export async function deleteSetlist(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Belum login!");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User tidak ditemukan");

  // Hapus setlist (pastikan setlist ini milik user yang sedang login)
  await prisma.setlist.delete({
    where: { id: id, userId: user.id },
  });

  revalidatePath("/");
}

// FUNGSI BARU: Tambah Lagu ke Setlist
export async function addTrack(setlistId: string, title: string, bpm: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Belum login!");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User tidak ditemukan");

  // Cek apakah setlist ini ada dan milik user tersebut
  const setlist = await prisma.setlist.findFirst({
    where: { id: setlistId, userId: user.id },
    include: { tracks: true }
  });
  
  if (!setlist) throw new Error("Setlist tidak ditemukan");
  if (setlist.tracks.length >= 15) throw new Error("Batas maksimal 15 lagu tercapai");

  // Cari urutan (order) terakhir agar lagu baru selalu ada di bawah
  const lastTrack = setlist.tracks[setlist.tracks.length - 1];
  const newOrder = lastTrack ? lastTrack.order + 1 : 0;

  await prisma.track.create({
    data: { title, bpm, order: newOrder, setlistId }
  });

  revalidatePath("/");
}

// FUNGSI BARU: Hapus Lagu dari Setlist
export async function deleteTrack(trackId: string, setlistId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Belum login!");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User tidak ditemukan");

  // Validasi keamanan: Pastikan lagu yang dihapus ada di dalam setlist milik user ini
  const setlist = await prisma.setlist.findFirst({
    where: { id: setlistId, userId: user.id }
  });
  if (!setlist) throw new Error("Akses ditolak");

  await prisma.track.delete({ where: { id: trackId } });

  revalidatePath("/");
}

// FUNGSI BARU: Update BPM Lagu yang sudah ada
export async function updateTrackBpm(trackId: string, bpm: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Belum login!");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User tidak ditemukan");

  // Update BPM langsung ke database
  await prisma.track.update({
    where: { id: trackId },
    data: { bpm }
  });

  revalidatePath("/");
}