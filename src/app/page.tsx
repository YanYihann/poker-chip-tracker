import { redirect } from "next/navigation";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const { room } = await searchParams;
  redirect(room ? `/online?room=${encodeURIComponent(room)}` : "/online");
}
