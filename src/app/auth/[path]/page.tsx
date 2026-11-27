import { AuthView } from "@neondatabase/auth-ui";

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
      <AuthView path={path} />
    </main>
  );
}