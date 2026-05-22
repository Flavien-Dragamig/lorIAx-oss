// Rendu dynamique obligatoire : la CSP `strict-dynamic` du proxy exige que
// Next.js injecte le nonce dans les <script>, ce qu'il ne fait qu'au SSR.
// Sans ça, les pages auth sont prérendues statiquement (aucun nonce) et tous
// leurs scripts sont bloqués par le navigateur → chargement infini.
export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
