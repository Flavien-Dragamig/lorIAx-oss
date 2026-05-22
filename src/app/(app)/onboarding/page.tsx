import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, Settings, ArrowRight } from "lucide-react";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Bienvenue sur votre espace LorIAx</h1>
          <p className="text-muted-foreground">
            Votre espace est prêt. Voici comment démarrer.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="hover:border-primary transition-colors">
            <CardHeader className="pb-2">
              <FileText className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-base">Créer un document</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Commencez à rédiger avec l&apos;éditeur collaboratif.
              </p>
              <Button render={<Link href="/" />} variant="outline" size="sm" className="w-full">
                Ouvrir l&apos;éditeur <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:border-primary transition-colors">
            <CardHeader className="pb-2">
              <Users className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-base">Inviter des membres</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Collaborez avec votre équipe en temps réel.
              </p>
              <Button render={<Link href="/admin" />} variant="outline" size="sm" className="w-full">
                Gérer les membres <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:border-primary transition-colors">
            <CardHeader className="pb-2">
              <Settings className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-base">Configurer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Personnalisez l&apos;apparence et les intégrations.
              </p>
              <Button render={<Link href="/settings" />} variant="outline" size="sm" className="w-full">
                Paramètres <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button render={<Link href="/" />} size="lg">
            Accéder à mon espace
          </Button>
        </div>
      </div>
    </div>
  );
}
