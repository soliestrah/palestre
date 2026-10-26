/* ---------- Données : aliments (catégorie, nom, portion, kcal, protéines g) ---------- */
var CATS=[['fav','★ Favoris'],['rec','Récents'],['pd','Petit-déj & laitiers'],['pr','Protéines'],['fe','Féculents'],['lg','Légumes'],['fr','Fruits & noix'],['sn','Snacks & plaisirs'],['bo','Boissons'],['pl','Plats & resto'],['sa','Gras & sauces'],['cus','Mes aliments']];
var RAW=[
['pd','Pain blanc','1 tranche (30 g)',80,3],['pd','Baguette','1/4 de baguette (60 g)',165,6],['pd','Pain complet','1 tranche (35 g)',85,4],['pd','Biscotte','1 biscotte',35,1],
['pd','Flocons d’avoine','1 bol (40 g)',150,5],['pd','Muesli','1 bol (50 g)',190,5],['pd','Céréales chocolatées','1 bol (40 g)',155,3],['pd','Croissant','1 croissant',230,5],['pd','Pain au chocolat','1 pièce',270,5],
['pd','Beurre','1 noisette (10 g)',75,0],['pd','Confiture','1 c. à soupe (20 g)',50,0],['pd','Pâte à tartiner','1 c. à soupe (15 g)',80,1],['pd','Miel','1 c. à café (7 g)',20,0],
['pd','Lait demi-écrémé','1 verre (200 ml)',92,7],['pd','Lait d’amande','1 verre (200 ml)',26,1],['pd','Yaourt nature','1 pot (125 g)',70,5],['pd','Yaourt sucré ou aux fruits','1 pot (125 g)',110,4],
['pd','Skyr nature','1 pot (150 g)',95,16],['pd','Fromage blanc 0 %','1 pot (100 g)',47,8],['pd','Fromage blanc 3 %','1 pot (100 g)',75,7],
['pd','Emmental','1 portion (30 g)',115,8],['pd','Camembert','1 part (30 g)',85,6],['pd','Mozzarella','1/2 boule (60 g)',140,11],['pd','Fromage de chèvre','1 portion (30 g)',85,5],
['pr','Œuf (dur, poché, cocotte)','1 œuf',80,7],['pr','Omelette nature','2 œufs',200,13],['pr','Jambon blanc','1 tranche (40 g)',45,7],
['pr','Blanc de poulet cuit','1 blanc (120 g)',200,37],['pr','Escalope de dinde cuite','1 escalope (120 g)',170,34],['pr','Cuisse de poulet rôtie','1 cuisse',230,24],
['pr','Steak haché 5 %','1 steak (100 g cru)',130,21],['pr','Steak haché 15 %','1 steak (100 g cru)',215,18],['pr','Steak de bœuf cuit','1 steak (120 g)',250,33],
['pr','Saucisse / chipolata','1 saucisse',210,11],['pr','Lardons','50 g',135,9],['pr','Saumon cuit','1 pavé (120 g)',240,25],['pr','Poisson blanc cuit (cabillaud…)','1 filet (120 g)',100,22],
['pr','Thon au naturel','1 petite boîte',100,22],['pr','Crevettes cuites','100 g',100,20],['pr','Tofu nature','100 g',120,13],
['pr','Lentilles cuites','1 portion (150 g)',175,14],['pr','Pois chiches cuits','1 portion (150 g)',245,13],['pr','Haricots rouges cuits','1 portion (150 g)',190,13],
['fe','Riz cuit','1 portion (150 g)',195,4],['fe','Pâtes cuites','1 assiette (200 g)',280,10],['fe','Pâtes complètes cuites','1 assiette (200 g)',260,10],
['fe','Semoule cuite','1 portion (150 g)',170,6],['fe','Boulgour cuit','1 portion (150 g)',125,5],['fe','Quinoa cuit','1 portion (150 g)',180,7],
['fe','Pommes de terre vapeur','2 moyennes (200 g)',160,4],['fe','Purée maison','1 portion (200 g)',240,4],['fe','Patate douce cuite','1 portion (200 g)',180,3],
['fe','Frites','1 portion moyenne (150 g)',450,5],['fe','Wrap / tortilla','1 tortilla',190,5],
['lg','Légumes cuits (haricots verts, brocoli, courgette…)','1 portion (200 g)',60,4],['lg','Salade verte','1 bol',15,1],['lg','Tomate','1 tomate',20,1],['lg','Concombre','1/2 concombre',10,0],
['lg','Carottes râpées','1 portion (100 g)',40,1],['lg','Champignons','100 g',22,3],['lg','Ratatouille','1 portion (200 g)',120,2],['lg','Soupe de légumes','1 bol (300 ml)',100,3],['lg','Avocat','1/2 avocat',160,2],
['fr','Pomme','1 pomme',80,0],['fr','Banane','1 banane',105,1],['fr','Orange','1 orange',70,1],['fr','Clémentine','1 clémentine',35,1],['fr','Poire','1 poire',90,1],
['fr','Fraises','1 bol (150 g)',50,1],['fr','Raisin','1 grappe (100 g)',70,1],['fr','Kiwi','1 kiwi',45,1],['fr','Pêche / nectarine','1 fruit',60,1],['fr','Mangue','1/2 mangue',100,1],
['fr','Compote sans sucre ajouté','1 pot (100 g)',45,0],['fr','Amandes','1 poignée (20 g)',120,4],['fr','Noix','1 poignée (20 g)',130,3],['fr','Cacahuètes','1 poignée (20 g)',120,5],
['sn','Chocolat noir 70 %','2 carrés (10 g)',60,1],['sn','Chocolat au lait','2 carrés (10 g)',55,1],['sn','Biscuit sec','1 biscuit',45,1],['sn','Cookie','1 cookie',190,2],
['sn','Gâteau','1 part',300,4],['sn','Madeleine','1 madeleine',110,2],['sn','Crêpe nature','1 crêpe',110,3],['sn','Glace','1 boule',100,2],['sn','Chips','1 petite poignée (30 g)',160,2],
['sn','Barre de céréales','1 barre',100,1],['sn','Barre protéinée','1 barre',200,20],['sn','Bonbons','1 poignée (25 g)',90,0],
['bo','Café noir ou thé nature','1 tasse',2,0],['bo','Café latte','1 grande tasse (250 ml)',115,8],['bo','Chocolat chaud','1 tasse (200 ml)',170,6],['bo','Jus d’orange','1 verre (200 ml)',90,1],
['bo','Soda classique','1 canette (33 cl)',140,0],['bo','Soda zéro','1 canette (33 cl)',1,0],['bo','Smoothie','1 verre (250 ml)',150,2],['bo','Bière','1 demi (25 cl)',110,1],['bo','Vin','1 verre (12 cl)',85,0],['bo','Spritz ou cocktail','1 verre',160,0],
['pl','Sandwich jambon-beurre','1 sandwich',380,15],['pl','Croque-monsieur','1 croque',320,15],['pl','Pizza surgelée','1/2 pizza',400,16],['pl','Quiche','1 part',350,12],
['pl','Lasagnes','1 portion (300 g)',450,22],['pl','Pâtes carbonara','1 assiette',650,22],['pl','Burger fast-food','1 burger',500,25],['pl','Kebab','1 kebab',750,35],
['pl','Salade composée de restaurant','1 assiette',450,15],['pl','Sushi / maki','1 pièce',40,2],
['sa','Huile d’olive','1 c. à soupe',90,0],['sa','Vinaigrette','1 c. à soupe',70,0],['sa','Mayonnaise','1 c. à soupe',100,0],['sa','Ketchup','1 c. à soupe',20,0],
['sa','Crème fraîche épaisse','1 c. à soupe',45,0],['sa','Sauce tomate','1/2 verre (100 g)',40,1],['sa','Sucre','1 morceau',20,0]
];
var FOODS=RAW.map(function(r){return {c:r[0],n:r[1],u:r[2],k:r[3],p:r[4]}});

var ACTS=[['Renforcement (poids du corps)',4.0],['Cardio / HIIT',8.0],['Course à pied',8.5],['Vélo',6.8],['Natation',6.0],['Yoga / Pilates',2.8],['Danse',5.0]];
var MEALS=[['bk','Petit-déjeuner',0.22],['lu','Déjeuner',0.34],['sn','Collation',0.10],['di','Dîner',0.34]];

var PROGS=[
 {id:'A',t:'Séance A · Jambes et fessiers',min:30,ex:[
  ['Échauffement','5 min','Marche sur place, cercles de hanches, 10 squats lents.'],
  ['Squats','3 × 12','Pieds écartés comme les épaules, genoux dans l’axe des orteils, assieds-toi vers l’arrière.'],
  ['Fentes arrière','3 × 10 par jambe','Reste droite, le genou arrière descend près du sol sans le poser.'],
  ['Pont fessier','3 × 15','Serre les fessiers en haut et marque 1 seconde de pause.'],
  ['Montées sur marche','3 × 10 par jambe','Une marche solide ou une chaise stable. Pousse avec le talon.'],
  ['Abduction allongée','2 × 15 par côté','Allongée sur le côté, lève la jambe tendue sans bouger le bassin.'],
  ['Étirements','3 min','Cuisses, fessiers, mollets, 20 secondes chacun.']]},
 {id:'B',t:'Séance B · Haut du corps et gainage',min:30,ex:[
  ['Échauffement','5 min','Cercles d’épaules et de bras, 10 pompes contre un mur.'],
  ['Pompes inclinées ou sur les genoux','3 × 8','Mains sous les épaules, corps aligné, la poitrine descend vers le sol.'],
  ['Rowing avec bouteilles ou haltères','3 × 12','Buste penché, dos plat, tire les coudes vers les hanches.'],
  ['Développé épaules','3 × 12','Bouteilles de 1,5 L ou haltères de 2 à 3 kg. Pousse vers le plafond sans cambrer.'],
  ['Planche','3 × 20 à 30 s','Coudes sous les épaules, ventre rentré, ne creuse pas le dos.'],
  ['Gainage latéral','2 × 20 s par côté','Genoux pliés pour commencer, bassin bien haut.'],
  ['Superman','3 × 12','Sur le ventre, lève bras et jambes 1 seconde.'],
  ['Étirements','3 min','Épaules, pectoraux, dos, 20 secondes chacun.']]},
 {id:'C',t:'Séance C · Corps entier et cardio doux',min:35,ex:[
  ['Échauffement','5 min','Marche rapide sur place, bras en mouvement.'],
  ['Squat + développé','3 × 12','Squat avec les bouteilles aux épaules, pousse vers le haut en remontant.'],
  ['Jumping jacks sans saut','3 × 40 s','Un pied après l’autre sur le côté, bras levés. Sans impact pour les genoux.'],
  ['Fentes marchées','3 × 10 par jambe','Pas longs, buste droit.'],
  ['Mountain climbers lents','3 × 20','Mains sur un canapé ou une table solide pour faciliter.'],
  ['Dead bug','3 × 10 par côté','Sur le dos, bras et jambe opposés, bas du dos plaqué au sol.'],
  ['Pont fessier une jambe','2 × 10 par côté','Bassin à plat, pousse avec le talon.'],
  ['Étirements','3 min','Tout le corps, sans forcer.']]}
];

/* Idées de dîner : [titre, [[début du nom de l'aliment, quantité], ...]] */
var IDEAS=[['Poulet, riz et légumes',[['Blanc de poulet',1],['Riz cuit',1],['Légumes cuits',1],['Huile d',0.5]]],['Saumon, pommes de terre et légumes',[['Saumon cuit',1],['Pommes de terre vapeur',1],['Légumes cuits',1]]],['Omelette, salade et pain complet',[['Omelette',1],['Salade verte',1],['Pain complet',1],['Vinaigrette',0.5]]],['Poisson blanc, semoule et ratatouille',[['Poisson blanc',1],['Semoule',1],['Ratatouille',1]]],['Lentilles, œuf et légumes',[['Lentilles',1],['Œuf',1],['Légumes cuits',1]]],['Tofu, quinoa et légumes',[['Tofu',1],['Quinoa',1],['Légumes cuits',1],['Huile d',0.5]]],['Soupe, jambon et yaourt',[['Soupe de légumes',1],['Jambon blanc',2],['Pain complet',1],['Yaourt nature',1]]],['Steak haché, patate douce et légumes',[['Steak haché 5',1],['Patate douce',1],['Légumes cuits',1]]],['Crevettes, boulgour et salade',[['Crevettes',1],['Boulgour',1],['Salade verte',1],['Huile d',0.5]]],['Thon, pâtes complètes et tomate',[['Thon',1],['Pâtes complètes',1],['Tomate',1],['Sauce tomate',1]]],['Soupe, skyr et fruit',[['Soupe de légumes',1],['Skyr',1],['Pomme',1]]]];
