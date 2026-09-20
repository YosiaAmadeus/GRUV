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

  const count = await prisma.setlist.count({ where: { userId: user.id } });
  if (count >= 5) {
    throw new Error("Batas maksimal 5 setlist telah tercapai.");
  }

  await prisma.setlist.create({
    data: { name, description, userId: user.id },
  });

  revalidatePath("/");
}

export async function deleteSetlist(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Belum login!");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User tidak ditemukan");

  await prisma.setlist.delete({
    where: { id: id, userId: user.id },
  });

  revalidatePath("/");
}

// FUNGSI BARU: Tambah lagu beserta setting metronom-nya
export async function addTrack(setlistId: string, title: string, bpm: number, timeSignature: number = 4, subdivision: number = 1) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Belum login!");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User tidak ditemukan");

  const setlist = await prisma.setlist.findFirst({
    where: { id: setlistId, userId: user.id },
    include: { tracks: true }
  });
  
  if (!setlist) throw new Error("Setlist tidak ditemukan");
  if (setlist.tracks.length >= 15) throw new Error("Batas maksimal 15 lagu tercapai");

  const lastTrack = setlist.tracks[setlist.tracks.length - 1];
  const newOrder = lastTrack ? lastTrack.order + 1 : 0;

  await prisma.track.create({
    data: { title, bpm, timeSignature, subdivision, order: newOrder, setlistId }
  });

  revalidatePath("/");
}

// FUNGSI BARU: Update BPM, Time Signature, & Subdivisi
export async function updateTrackSettings(trackId: string, bpm: number, timeSignature: number, subdivision: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Belum login!");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User tidak ditemukan");

  await prisma.track.update({
    where: { id: trackId },
    data: { bpm, timeSignature, subdivision }
  });

  revalidatePath("/");
}

export async function deleteTrack(trackId: string, setlistId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Belum login!");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User tidak ditemukan");

  const setlist = await prisma.setlist.findFirst({
    where: { id: setlistId, userId: user.id }
  });
  if (!setlist) throw new Error("Akses ditolak");

  await prisma.track.delete({ where: { id: trackId } });

  revalidatePath("/");
}