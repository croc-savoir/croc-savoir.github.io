// Rangement des fiches en sous-thèmes plus fins (un seul niveau de navigation, 15 à 25 fiches par sous-thème).
//   node tools/ranger.js            → affiche le résultat sans rien écrire
//   node tools/ranger.js --appliquer → écrit data/fiches/*.json (puis : node tools/construire.js)
// Chaque règle : { depuis: [anciens sous-thèmes], titres: [...] , vers: 'Nouveau sous-thème' }.
// Les fiches d'un ancien sous-thème listé dans `depuis` mais absentes de toutes les listes `titres` gardent leur sous-thème.
// Après les rangements, un thème qui garde un sous-thème de moins de 3 fiches est signalé.
const { chargerTout, lireJSON, ecrireJSON } = require('./lib');
const path = require('path');

const R = {};

R.litterature = [
  { depuis: ['Auteurs'], vers: 'Poètes et dramaturges', titres: ['Molière', 'Jean de La Fontaine', 'Jean Racine', 'Pierre Corneille', 'Charles Baudelaire', 'Arthur Rimbaud', 'Guillaume Apollinaire', 'Jacques Prévert', 'William Shakespeare', 'Dante Alighieri', 'Johann Wolfgang von Goethe'] },
  { depuis: ['Auteurs'], vers: 'Romanciers étrangers', titres: ['Jane Austen', 'Léon Tolstoï', 'Fiodor Dostoïevski', 'Franz Kafka', 'Jorge Luis Borges', 'Gabriel García Márquez', 'Ernest Hemingway', 'Agatha Christie', 'Arthur Conan Doyle', 'J. R. R. Tolkien', 'Charles Dickens', 'Oscar Wilde', 'Virginia Woolf', 'Edgar Allan Poe', 'Mark Twain', 'Miguel de Cervantes'] },
  { depuis: ['Auteurs'], vers: 'Auteurs français', titres: ['Victor Hugo', 'Marcel Proust', 'Albert Camus', 'Émile Zola', 'Voltaire', 'George Sand', 'Alexandre Dumas', 'Honoré de Balzac', 'Gustave Flaubert', 'Guy de Maupassant', 'Stendhal', 'Colette', 'Louis-Ferdinand Céline', 'Jules Verne', 'Marguerite Duras', 'François Rabelais', 'Michel de Montaigne'] },
  { depuis: ['Œuvres'], vers: 'Classiques français', titres: ['Le Petit Prince', 'Les Trois Mousquetaires', 'Le Comte de Monte-Cristo', 'Madame Bovary', 'Le Rouge et le Noir', 'Germinal', 'Les Fleurs du mal', 'Candide', 'Notre-Dame de Paris', 'Le Père Goriot', 'Voyage au bout de la nuit', 'Les Liaisons dangereuses'] },
  { depuis: ['Œuvres'], vers: 'Classiques du monde', titres: ['Don Quichotte', "L'Odyssée", '1984 de George Orwell', 'La Divine Comédie', 'Cent ans de solitude', 'Guerre et Paix', 'Crime et Châtiment', 'Le Procès', 'Moby-Dick', 'Hamlet', 'Roméo et Juliette', 'Frankenstein', 'Dracula', 'Alice au pays des merveilles', "Harry Potter à l'école des sorciers", 'Le Seigneur des anneaux', 'Les Aventures de Tom Sawyer', 'Le Meilleur des mondes', 'Le Vieil Homme et la Mer', "Le Journal d'Anne Frank"] },
  { depuis: ['Mouvements littéraires', 'Dates clés'], vers: 'Mouvements et dates clés', tout: true },
  { depuis: ['Genres et notions', 'Vocabulaire littéraire'], vers: 'Genres et vocabulaire', tout: true },
];

R.mythologie = [
  { depuis: ['Mythologie grecque'], vers: 'Dieux et déesses grecs', titres: ['Le panthéon grec', 'Zeus', 'Athéna', 'Poséidon', 'Hadès', 'Hermès', 'Apollon', 'Artémis', 'Dionysos', 'Aphrodite', 'Héra', 'Arès', 'Héphaïstos', 'Déméter', 'Perséphone', 'Gaïa'] },
  { depuis: ['Mythologie grecque'], vers: 'Héros et figures grecs', titres: ['Héraclès', 'Achille', 'Thésée', 'Ulysse', 'Œdipe', 'Antigone', 'Médée', 'Dédale', 'Icare', 'Prométhée', 'Atlas', 'Narcisse', 'Midas', 'Sisyphe'] },
  { depuis: ['Mythologie grecque'], vers: 'Récits de la Grèce', titres: ['La guerre de Troie', 'Le labyrinthe et le Minotaure', 'Pandore et sa boîte', 'Orphée et Eurydice', "Les douze travaux d'Héraclès", 'Le jugement de Pâris', 'Les sirènes', 'Les Moires de Goya', 'Méduse et Persée', "Jason et la Toison d'or"] },
  { depuis: ['Autres mythologies'], vers: "Mythologies de l'Inde et de Mésopotamie", titres: ['Brahmā', 'Vishnou', 'Shiva', 'Ganesh', 'Rāma', 'Le Mahabharata', "L'Épopée de Gilgamesh", 'Marduk'] },
  { depuis: ['Autres mythologies'], vers: 'Légendes celtes et arthuriennes', titres: ['La mythologie celte', 'Le roi Arthur', "Merlin l'Enchanteur", 'Excalibur', 'Le Graal'] },
  { depuis: ['Autres mythologies'], vers: 'Japon et Amériques', titres: ['Le shintoïsme et les kami', 'La mythologie aztèque', 'Quetzalcóatl', 'Amaterasu', 'Susanoo', 'Kitsune, le renard du Japon'] },
  { depuis: ['Autres mythologies'], vers: 'Mythologie romaine', titres: ['La mythologie romaine'] },
  { depuis: ['Créatures', 'Vocabulaire mythologique'], vers: 'Créatures et vocabulaire', tout: true },
];

R.art = [
  { depuis: ['Artistes'], vers: 'Peintres de la Renaissance et du baroque', titres: ['Léonard de Vinci', 'Michel-Ange', 'Raphaël', 'Sandro Botticelli', 'Albrecht Dürer', 'Le Caravage', 'Rembrandt', 'Johannes Vermeer', 'Artemisia Gentileschi', 'Francisco de Goya'] },
  { depuis: ['Artistes'], vers: 'Peintres du XIXe siècle', titres: ['Claude Monet', 'Édouard Manet', 'Auguste Renoir', 'Edgar Degas', 'Paul Cézanne', 'Paul Gauguin', 'Vincent van Gogh', 'Edvard Munch', 'Gustav Klimt', 'Katsushika Hokusai'] },
  { depuis: ['Artistes'], vers: 'Artistes du XXe siècle et contemporains', titres: ['Pablo Picasso', 'Salvador Dalí', 'Henri Matisse', 'Marc Chagall', 'Piet Mondrian', 'Vassily Kandinsky', 'Jackson Pollock', 'Yves Klein', "Georgia O'Keeffe", 'Jean-Michel Basquiat', 'Banksy', 'Andy Warhol', 'Niki de Saint Phalle', 'Pierre Soulages', 'Frida Kahlo'] },
  { depuis: ['Artistes'], vers: 'Sculpture, architecture et lieux', titres: ['Auguste Rodin', 'Camille Claudel'] },
  { depuis: ['Architecture et sculpture', 'Lieux et institutions'], vers: 'Sculpture, architecture et lieux', tout: true },
];

R['jeux-video'] = [
  { depuis: ['Jeux et séries cultes'], vers: 'Classiques avant 2000', titres: ['Super Mario, une franchise fondatrice', 'The Legend of Zelda', 'Tetris', 'Pac-Man', 'Sonic the Hedgehog', 'Space Invaders', 'Doom', 'Street Fighter et les jeux de combat', 'Final Fantasy', 'Dragon Quest', 'Prince of Persia', 'Resident Evil', 'Half-Life', 'Mario Kart'] },
  { depuis: ['Jeux et séries cultes'], vers: 'Jeux des années 2000 et 2010', titres: ['Minecraft', 'Grand Theft Auto', 'Les Sims', 'World of Warcraft', 'Call of Duty', 'Portal', 'League of Legends', "Assassin's Creed", 'Counter-Strike', 'Guitar Hero', 'Animal Crossing', 'Red Dead Redemption', 'The Last of Us', 'Just Dance', 'Candy Crush Saga'] },
  { depuis: ['Jeux et séries cultes'], vers: 'Jeux récents', titres: ['Fortnite et le battle royale', 'Among Us', 'Undertale', 'Hollow Knight', 'Stardew Valley', 'Baldur\'s Gate 3', 'Pokémon Go'] },
  { depuis: ['Vocabulaire et culture'], vers: 'Genres et styles', titres: ['Roguelike', 'Metroidvania', 'Open world (monde ouvert)', 'Genres de jeux vidéo : RPG, FPS, MMO…', 'Pixel art', 'Jeu indépendant', 'Rétrogaming'] },
  { depuis: ['Vocabulaire et culture'], vers: 'Vocabulaire du joueur', titres: ['PEGI', 'Easter egg', 'Boss', 'PNJ (personnage non joueur)', 'DLC', 'Free-to-play', 'Loot box', 'Glitch', 'Lag'] },
  { depuis: ['Vocabulaire et culture'], vers: 'Culture et communauté', titres: ['Speedrun', "L'esport", 'Twitch et le streaming de jeux vidéo', 'Le ZEvent', 'La musique de jeu vidéo', 'Le jeu vidéo entre au musée', 'Le jeu vidéo français'] },
];

R.manga = [
  { depuis: ['Séries cultes'], vers: "Shonen d'action", titres: ['One Piece', 'Dragon Ball', 'Naruto', 'Bleach', 'Demon Slayer', 'Jujutsu Kaisen', 'My Hero Academia', 'Chainsaw Man', 'Hunter × Hunter', 'Les Chevaliers du Zodiaque', 'One-Punch Man', 'Magi', "JoJo's Bizarre Adventure"] },
  { depuis: ['Séries cultes'], vers: 'Seinen et grands récits', titres: ['Death Note', "L'Attaque des Titans", 'Fullmetal Alchemist', 'Monster', 'Berserk', 'Vinland Saga', 'Akira', 'Ghost in the Shell', 'Neon Genesis Evangelion', 'Cowboy Bebop'] },
  { depuis: ['Séries cultes'], vers: 'Comédie, sport et romance', titres: ['Slam Dunk', 'Haikyū!!', 'Sailor Moon', 'Spy × Family', 'Komi cherche ses mots', 'Call of the Night', 'Frieren', 'La Rose de Versailles (Lady Oscar)', 'Candy Candy'] },
  { depuis: ['Séries cultes'], vers: 'Classiques et animés cultes', titres: ['Goldorak', 'Gundam', "Les Mystérieuses Cités d'or", 'Dororo', "L'École emportée", 'Karakuri Circus', 'Pokémon, un phénomène multimédia'] },
  { depuis: ['Culture et vocabulaire'], vers: 'Genres et formats', titres: ['Isekai', 'Shonen et seinen', 'Mecha', 'Shōjo', 'Magical girl', 'Yōkai', 'Light novel', 'Webtoon', 'OAV / OVA'] },
  { depuis: ['Culture et vocabulaire'], vers: 'Culture otaku et vocabulaire', titres: ['Tsundere', 'Mangaka, anime et otaku', 'Le manga en France', 'Le Weekly Shōnen Jump', 'Kawaii', 'Cosplay', 'Chibi (super deformed)', 'Tankōbon', 'Seiyū', 'Dōjinshi', 'Lire un manga de droite à gauche', 'Les onomatopées dans le manga', 'Les suffixes -san, -kun, -chan'] },
];

R.tech = [
  { depuis: ['Grandes inventions'], vers: 'Communication et médias', titres: ["L'imprimerie de Gutenberg", "L'invention du téléphone", 'La photographie', 'La radio', 'La télévision', 'La fibre optique'] },
  { depuis: ['Grandes inventions'], vers: 'Énergie et transports', titres: ["L'ampoule électrique", 'Le moteur à combustion interne', '1769 : La machine à vapeur de Watt', "L'électricité, des débuts à nos prises", 'La roue', 'La pile électrique', "L'automobile", 'Le chemin de fer', 'Le drone', "L'accumulateur lithium-ion", 'La cellule photovoltaïque'] },
  { depuis: ['Grandes inventions'], vers: 'Informatique et électronique', titres: ['Le transistor', "L'ordinateur", 'Le smartphone', "L'intelligence artificielle", "L'écran tactile", "L'impression 3D", 'Le laser', 'Le radar'] },
  { depuis: ['Grandes inventions'], vers: 'Instruments et mesure', titres: ['La boussole', "L'horloge", 'Le microscope', 'Le GPS'] },
  { depuis: ['Inventeurs et pionniers'], vers: "Électricité et communications", titres: ['Thomas Edison', 'Nikola Tesla', 'Samuel Morse', 'Alexander Graham Bell', 'Guglielmo Marconi', 'Alessandro Volta', 'Benjamin Franklin', 'Hedy Lamarr'] },
  { depuis: ['Inventeurs et pionniers'], vers: "Pionniers de l'informatique", titres: ['Ada Lovelace', 'Alan Turing', 'Steve Jobs', 'Bill Gates', 'Grace Hopper', 'Charles Babbage', 'John von Neumann', 'Claude Shannon', 'Konrad Zuse', 'Steve Wozniak', 'Margaret Hamilton'] },
  { depuis: ['Inventeurs et pionniers'], vers: "Transports et image", titres: ['Les frères Wright', 'Henry Ford', 'Carl Benz', 'Rudolf Diesel', 'Nicéphore Niépce', 'Louis Daguerre'] },
];

R.sport = [
  { depuis: ['Grands champions'], vers: 'Légendes du football', titres: ['Pelé', 'Zinédine Zidane', 'Lionel Messi', 'Diego Maradona', 'Michel Platini', 'Johan Cruyff', 'Cristiano Ronaldo'] },
  { depuis: ['Grands champions'], vers: 'Basket et tennis', titres: ['Michael Jordan', 'Kobe Bryant', 'LeBron James', 'Serena Williams', 'Roger Federer', 'Rafael Nadal', 'Novak Djokovic'] },
  { depuis: ['Grands champions'], vers: 'Athlétisme, natation et gymnastique', titres: ['Usain Bolt', 'Simone Biles', 'Michael Phelps', 'Jesse Owens', 'Nadia Comăneci', 'Marie-José Pérec'] },
  { depuis: ['Grands champions'], vers: "Champions d'autres sports", titres: ['Muhammad Ali', 'Teddy Riner', 'Eddy Merckx', 'Ayrton Senna', 'Michael Schumacher', 'Jean-Claude Killy', 'Éric Tabarly'] },
  { depuis: ['Disciplines'], vers: 'Sports collectifs', titres: ['Le hors-jeu au football', 'Le rugby à XV : les bases', 'Le football, en bref', 'Le basket-ball', 'Le baseball', 'Le handball', 'Le volley-ball', 'Le hockey sur glace', 'Le cricket'] },
  { depuis: ['Disciplines'], vers: 'Sports individuels et de précision', titres: ['Le tennis', 'Le marathon', 'Triathlon, décathlon et heptathlon', 'Le golf', 'La natation', "L'aviron", "L'escalade sportive", 'La pétanque'] },
  { depuis: ['Disciplines'], vers: 'Combat, glisse et mécanique', titres: ['Le ski et les sports d\'hiver', 'La boxe anglaise', 'Le judo', "L'escrime", 'La Formule 1', 'Le Rallye Dakar', 'Le surf'] },
  { depuis: ['Compétitions'], vers: 'Jeux olympiques', titres: ['1896 : les premiers Jeux Olympiques modernes', "Les Jeux Olympiques d'hiver", '2024 : Les Jeux olympiques de Paris', 'Jeux paralympiques', 'Les Jeux olympiques antiques', 'La flamme olympique', 'Les anneaux et les symboles olympiques', 'Le Comité international olympique'] },
  { depuis: ['Compétitions'], vers: 'Football, rugby et grandes ligues', titres: ['1930 : la première Coupe du monde de football', 'La Ligue des champions', "Le championnat d'Europe de football", 'La Coupe du monde de rugby à XV', 'Le Tournoi des Six Nations', 'Le Super Bowl', 'La NBA'] },
  { depuis: ['Compétitions'], vers: 'Tennis, cyclisme et grandes courses', titres: ['Le Tour de France', 'Le tournoi de Wimbledon', 'Roland-Garros', 'Les 24 Heures du Mans', 'La Coupe Davis', 'Le Vendée Globe', "Le Tour d'Italie"] },
  { depuis: ['Compétitions', 'Histoire et grands moments'], vers: 'Histoire et enjeux du sport', titres: ['Le dopage'] },
  { depuis: ['Histoire et grands moments'], vers: 'Histoire et enjeux du sport', tout: true },
];

R['corps-humain'] = [
  { depuis: ['Organes et fonctions', 'Santé et maladies', 'Système nerveux'], vers: 'Cerveau et nerfs', titres: ['Le cerveau', 'Le sommeil', "L'hypothalamus", 'Le cervelet', 'La moelle épinière', 'Le nerf vague', "L'hippocampe", 'Réflexe vs réaction volontaire', 'La dopamine', 'La sérotonine', 'La douleur', 'Le rêve', 'La mémoire', "La maladie d'Alzheimer", "L'épilepsie"] },
  { depuis: ['Système nerveux'], vers: 'Cerveau et nerfs', tout: true },
  { depuis: ['Organes et fonctions'], vers: 'Hormones et glandes', titres: ['La thyroïde', "L'insuline", "L'adrénaline", 'La mélatonine', 'Hormone vs neurotransmetteur', 'Le pancréas'] },
  { depuis: ['Organes et fonctions', 'Système digestif'], vers: 'Digestion et organes', titres: ['Le foie', 'Les reins', "L'estomac", "L'intestin grêle", 'Vitamine vs minéral'] },
  { depuis: ['Système digestif'], vers: 'Digestion et organes', tout: true },
  { depuis: ['Organes et fonctions', 'Santé et maladies', 'Système cardiovasculaire', 'Système respiratoire'], vers: 'Cœur, sang et respiration', titres: ['Le sang', 'Le diaphragme', 'Les globules rouges', "L'hémoglobine", 'Groupe sanguin : A, B, AB, O', 'La pression artérielle', 'Le cholestérol'] },
  { depuis: ['Système cardiovasculaire', 'Système respiratoire'], vers: 'Cœur, sang et respiration', tout: true },
  { depuis: ['Organes et fonctions', 'Santé et maladies', 'Système immunitaire'], vers: 'Immunité et maladies', titres: ['Le système immunitaire', 'Les lymphocytes', 'Les allergies', 'Fièvre vs hyperthermie', 'Le diabète', 'Le cancer', 'Le vieillissement'] },
  { depuis: ['Système immunitaire'], vers: 'Immunité et maladies', tout: true },
  { depuis: ['Organes et fonctions', 'Sens'], vers: 'Sens et peau', titres: ['La peau', "L'oreille et l'audition"] },
  { depuis: ['Sens'], vers: 'Sens et peau', tout: true },
  { depuis: ['Médecine et médecins'], vers: 'Grands médecins', titres: ['Andreas Vésale', 'Marie Curie', 'Hippocrate', 'Florence Nightingale', 'Galien', 'Ambroise Paré', 'William Harvey', 'Ignace Semmelweis', 'Robert Koch', 'Paul Broca', 'Christiaan Barnard', 'Elizabeth Blackwell', 'Alexander Fleming', 'Jonas Salk'] },
  { depuis: ['Médecine et médecins'], vers: 'Découvertes et techniques médicales', titres: ['La découverte de la pénicilline', 'La première vaccination', '1895 : La découverte des rayons X', "L'anesthésie", 'La théorie des humeurs', 'La variole', 'Le stéthoscope', "L'IRM", "La greffe d'organe", 'La transfusion sanguine'] },
];

R.geo = [
  { depuis: ['Pays et régions'], vers: "Pays d'Europe", titres: ["L'Islande", 'La Norvège', "L'Italie", 'Le Royaume-Uni', "L'Allemagne", "L'Espagne", 'La Grèce', 'Monaco', 'La Russie'] },
  { depuis: ['Pays et régions'], vers: "Pays d'Asie et d'Océanie", titres: ['Le Japon', 'La Chine', "L'Inde", "L'Australie", "L'Indonésie", 'La Corée du Sud', 'La Nouvelle-Zélande'] },
  { depuis: ['Pays et régions'], vers: "Pays d'Amérique et d'Afrique", titres: ['Le Brésil', 'Le Canada', "L'Égypte", 'Les États-Unis', 'Le Mexique', "L'Argentine", 'Le Pérou', 'Le Maroc', "L'Afrique du Sud", 'Le Nigeria'] },
  { depuis: ['Pays et régions', 'Relief et milieux'], vers: 'Vocabulaire géographique', titres: ['Enclave', 'Isthme', 'Péninsule', 'Archipel vs atoll', 'Méridien vs parallèle', 'Fjord', 'Glacier', 'Oasis', 'Fuseau horaire'] },
];

function main() {
  const appliquer = process.argv.includes('--appliquer');
  const tout = chargerTout();
  for (const [dom, regles] of Object.entries(R)) {
    const fiches = tout[dom].fiches;
    const dejaRange = new Set();
    for (const r of regles) {
      const titres = r.tout ? null : new Set(r.titres);
      let n = 0;
      for (const f of fiches) {
        if (dejaRange.has(f.id)) continue;
        if (!r.depuis.includes(f.__avant ?? f.subtheme)) continue;
        if (titres && !titres.has(f.title)) continue;
        f.__avant = f.__avant ?? f.subtheme;
        f.subtheme = r.vers; dejaRange.add(f.id); n++;
      }
      if (titres && n !== titres.size) {
        const trouves = new Set(fiches.filter(f => f.subtheme === r.vers).map(f => f.title));
        console.log(`⚠️ ${dom} / ${r.vers} : ${n}/${titres.size} — absents : ${[...titres].filter(t => !trouves.has(t)).join(' ; ')}`);
      }
    }
    const compte = {};
    fiches.forEach(f => { compte[f.subtheme] = (compte[f.subtheme] || 0) + 1; });
    console.log(`\n${dom} : ${Object.entries(compte).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
    fiches.forEach(f => delete f.__avant);
    if (appliquer) ecrireJSON(path.join(__dirname, '..', 'data', 'fiches', dom + '.json'), fiches);
  }
  if (!appliquer) console.log('\n(Aperçu seulement : ajouter --appliquer pour écrire)');
}
main();
