import type { Metadata } from "next";
import { LegalPage, ToFill } from "@/components/site/legal-page";

export const metadata: Metadata = { title: "Mentions légales", robots: { index: false } };

export default function MentionsLegales() {
  return (
    <LegalPage title="Mentions légales" updated="octobre 2026">
      <h2>Éditeur du site</h2>
      <p>
        <ToFill>raison sociale, forme juridique et capital</ToFill>
        <br />
        <ToFill>adresse du siège social</ToFill>
        <br />
        <ToFill>numéro SIREN / RCS, numéro de TVA intracommunautaire</ToFill>
        <br />
        Directeur de la publication : <ToFill>nom</ToFill>
        <br />
        Contact : <ToFill>adresse e-mail</ToFill>
      </p>
      <h2>Hébergement</h2>
      <p>
        <ToFill>nom, adresse et téléphone de l&apos;hébergeur du site et des fichiers</ToFill>
      </p>
      <h2>Propriété intellectuelle</h2>
      <p>
        Les contenus du site VoirAvantDeCommander (textes, interface, logo) sont protégés. Les contenus des menus (noms, photographies, modèles 3D) appartiennent
        aux restaurants concernés ou à leurs auteurs.
      </p>
      <h2>Restaurant de démonstration</h2>
      <p>« Atelier Saveurs » est un restaurant fictif. Ses plats sont des modèles 3D stylisés créés pour illustrer le fonctionnement du service.</p>
    </LegalPage>
  );
}
