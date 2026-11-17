USE oracle8;
-- Ce fichier est en UTF-8 : sans cette ligne, les accents peuvent être lus de travers
SET NAMES utf8mb4;

-- On supprime d'abord les anciennes tables si elles existent (dans l'ordre inverse)
DROP TABLE IF EXISTS question;
DROP TABLE IF EXISTS reponse;
DROP TABLE IF EXISTS `Réponse`;
DROP TABLE IF EXISTS utilisateur;

CREATE TABLE utilisateur(
   Id_utilisateur INT AUTO_INCREMENT,
   pseudo VARCHAR(50) NOT NULL,
   motdepasse VARCHAR(255) NOT NULL,
   role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
   PRIMARY KEY(Id_utilisateur),
   UNIQUE(pseudo)
);

CREATE TABLE reponse(
   Id_Reponse INT AUTO_INCREMENT,
   texte TEXT NOT NULL,
   PRIMARY KEY(Id_Reponse)
);

CREATE TABLE question(
   Id_question INT AUTO_INCREMENT,
   texte TEXT NOT NULL,
   date_creation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
   Id_Reponse INT NOT NULL,
   Id_utilisateur INT NOT NULL,
   PRIMARY KEY(Id_question),
   FOREIGN KEY(Id_Reponse) REFERENCES reponse(Id_Reponse),
   FOREIGN KEY(Id_utilisateur) REFERENCES utilisateur(Id_utilisateur) ON DELETE CASCADE
);