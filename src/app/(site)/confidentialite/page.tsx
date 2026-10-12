import type { Metadata } from "next";
import { LegalPage, ToFill } from "@/components/site/legal-page";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function Confidentialite() {
  return (
    <LegalPage title="Politique de confidentialité" updated="octobre 2026">
      <p>
        Responsable du traitement : <ToFill>raison sociale et adresse</ToFill>. Pour exercer vos droits (accès, rectification, effacement, opposition) :{" "}
        <ToFill>adresse e-mail de contact</ToFill>. Vous pouvez également introduire une réclamation auprès de la CNIL.
      </p>
      <h2>Clients des restaurants (menus en ligne)</h2>
      <p>
        La consultation d&apos;un menu ne nécessite <strong>aucun compte</strong> et ne dépose <strong>aucun cookie</strong>. Nous mesurons uniquement des compteurs
        anonymes et agrégés par jour (consultations du menu, fiches plats ouvertes, utilisation de la 3D et de la réalité augmentée). Aucune adresse IP, aucun
        identifiant et aucun historique de navigation ne sont enregistrés. Les signaux « Global Privacy Control » et « Do Not Track » sont respectés : aucun
        compteur n&apos;est incrémenté.
      </p>
      <p>
        La liste « Mes envies » est enregistrée uniquement dans le navigateur du client (stockage local) et n&apos;est jamais transmise.
      </p>
      <h2>Demandes de démonstration et de contact</h2>
      <p>
        Les informations saisies dans les formulaires (nom, e-mail, téléphone, restaurant, ville, message) sont utilisées uniquement pour vous recontacter, sur
        la base de votre consentement. Elles ne sont ni cédées ni vendues. Durée de conservation : <ToFill>durée, par exemple 3 ans après le dernier contact</ToFill>.
      </p>
      <h2>Comptes d&apos;administration</h2>
      <p>
        Les comptes utilisent une session sécurisée (cookie strictement nécessaire au fonctionnement). Les mots de passe sont stockés sous forme d&apos;empreinte
        (bcrypt) ; les tentatives de connexion sont enregistrées avec une empreinte anonymisée de l&apos;adresse IP pour prévenir les attaques.
      </p>
      <h2>Sous-traitants</h2>
      <p>
        <ToFill>hébergeur, stockage des fichiers, service de traduction automatique éventuel (Anthropic ou DeepL) et pays de traitement</ToFill>
      </p>
    </LegalPage>
  );
}
