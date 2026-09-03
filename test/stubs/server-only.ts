/**
 * Remplaçant de `server-only` pour les tests.
 *
 * Next aliase ce paquet à la compilation pour interdire l'import d'un module
 * serveur depuis un composant client ; il n'existe pas dans `node_modules`, donc
 * Vitest ne sait pas le résoudre. Ce fichier vide tient lieu de cible.
 */
export {};
