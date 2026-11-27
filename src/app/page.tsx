import { revalidatePath } from "next/cache";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { notes } from "@/db/schema";

export default async function HomePage() {
  const allNotes = await db.select().from(notes).orderBy(desc(notes.createdAt));

  async function createNote(formData: FormData) {
    "use server";
    const title = formData.get("title")?.toString().trim();
    if (!title) return;

    await db.insert(notes).values({ title });
    revalidatePath("/");
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Neon + Drizzle Notes</h1>

      <form action={createNote} className="mb-6 flex gap-2">
        <input
          type="text"
          name="title"
          placeholder="Tulis catatan baru..."
          required
          className="flex-1 rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-black px-4 py-2 text-white">
          Simpan
        </button>
      </form>

      <ul className="space-y-2">
        {allNotes.map((note) => (
          <li key={note.id} className="rounded border p-3">
            {note.title}
          </li>
        ))}
      </ul>
    </main>
  );
}
