USE oracle8;

-- À exécuter une seule fois sur une base créée avant l'ajout de l'administration.
-- Ne supprime aucune donnée : tous les comptes existants deviennent 'user'.
ALTER TABLE utilisateur
   ADD role ENUM('user', 'admin') NOT NULL DEFAULT 'user';
