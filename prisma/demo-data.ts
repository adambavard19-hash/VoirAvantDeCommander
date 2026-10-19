/**
 * Restaurant de démonstration — entièrement FICTIF.
 * Sert aux démonstrations commerciales (site vitrine → « Tester la démo »).
 * Les modèles 3D sont des créations procédurales stylisées (scripts/generate-demo-models.ts),
 * pas des numérisations de plats réels.
 */

type T = Partial<Record<"en" | "es" | "it" | "de" | "pt" | "ar" | "zh" | "ja", string>>;

export type DemoDish = {
  key: string;
  category: string;
  name: string;
  description?: string;
  priceCents?: number;
  variants?: { label: string; priceCents: number; tr?: T }[];
  model?: string;
  photo?: string;
  allergens?: string[];
  tags?: string[];
  featured?: boolean;
  /** Dimensions réelles (cm) : largeur, profondeur, hauteur du plat servi. */
  realSize?: [number, number, number];
  recommendations?: string[];
  tr: { name: T; description?: T };
};

export const DEMO_RESTAURANT = {
  slug: "demo",
  name: "Atelier Saveurs",
  cuisineType: "Restaurant de démonstration",
  tagline: "Restaurant fictif imaginé pour vous faire vivre l'expérience VoirAvantDeCommander.",
  practicalInfo:
    "Ce restaurant n'existe pas : il illustre le fonctionnement du menu 3D.\nTouchez un plat marqué « 3D », faites-le tourner du doigt, puis affichez-le sur votre table.",
  city: "Démonstration",
  tr: {
    tagline: {
      en: "A fictional restaurant designed to let you experience VoirAvantDeCommander.",
      es: "Un restaurante ficticio creado para que vivas la experiencia VoirAvantDeCommander.",
      it: "Un ristorante immaginario creato per farti vivere l'esperienza VoirAvantDeCommander.",
      de: "Ein fiktives Restaurant, mit dem Sie VoirAvantDeCommander selbst erleben können.",
      pt: "Um restaurante fictício criado para viver a experiência VoirAvantDeCommander.",
      ar: "مطعم خيالي صُمّم لتعيش تجربة VoirAvantDeCommander.",
      zh: "一家虚构的餐厅，带您体验 VoirAvantDeCommander。",
      ja: "VoirAvantDeCommanderを体験していただくための架空のレストランです。",
    } as T,
    practicalInfo: {
      en: "This restaurant doesn't exist: it shows how the 3D menu works.\nTap a dish marked “3D”, rotate it with your finger, then place it on your table.",
      es: "Este restaurante no existe: muestra cómo funciona la carta en 3D.\nToca un plato marcado «3D», gíralo con el dedo y colócalo en tu mesa.",
      it: "Questo ristorante non esiste: mostra come funziona il menù 3D.\nTocca un piatto con il simbolo «3D», ruotalo con il dito e poi posizionalo sul tuo tavolo.",
      de: "Dieses Restaurant existiert nicht: Es zeigt, wie die 3D-Speisekarte funktioniert.\nTippen Sie auf ein Gericht mit „3D“, drehen Sie es mit dem Finger und stellen Sie es auf Ihren Tisch.",
      pt: "Este restaurante não existe: mostra como funciona o menu 3D.\nToque num prato marcado «3D», rode-o com o dedo e coloque-o na sua mesa.",
      ar: "هذا المطعم غير موجود: إنه يوضّح طريقة عمل القائمة ثلاثية الأبعاد.\nاضغط على طبق يحمل علامة «3D» ودوّره بإصبعك ثم ضعه على طاولتك.",
      zh: "这家餐厅并不存在：它展示了 3D 菜单的使用方式。\n点击标有“3D”的菜品，用手指旋转，然后将它放到您的餐桌上。",
      ja: "このレストランは実在しません。3Dメニューの仕組みをご紹介するためのものです。\n「3D」マークの料理をタップし、指で回転させてから、テーブルに置いてみてください。",
    } as T,
  },
};

export const DEMO_CATEGORIES = [
  { key: "entrees", name: "Entrées", icon: "salad", tr: { en: "Starters", es: "Entrantes", it: "Antipasti", de: "Vorspeisen", pt: "Entradas", ar: "المقبلات", zh: "前菜", ja: "前菜" } as T },
  { key: "plats", name: "Plats", icon: "utensils", tr: { en: "Mains", es: "Platos principales", it: "Piatti principali", de: "Hauptgerichte", pt: "Pratos principais", ar: "الأطباق الرئيسية", zh: "主菜", ja: "メイン料理" } as T },
  { key: "desserts", name: "Desserts", icon: "cake", tr: { en: "Desserts", es: "Postres", it: "Dolci", de: "Desserts", pt: "Sobremesas", ar: "الحلويات", zh: "甜点", ja: "デザート" } as T },
  { key: "boissons", name: "Boissons", icon: "martini", tr: { en: "Drinks", es: "Bebidas", it: "Bevande", de: "Getränke", pt: "Bebidas", ar: "المشروبات", zh: "饮品", ja: "ドリンク" } as T },
];

export const DEMO_DISHES: DemoDish[] = [
  {
    key: "burrata",
    category: "entrees",
    name: "Burrata crémeuse & tomates anciennes",
    description: "Burrata des Pouilles, tomates anciennes de saison, basilic frais et huile d'olive vierge extra.",
    priceCents: 1400,
    model: "burrata-tomates",
    photo: "burrata-tomates",
    allergens: ["milk"],
    tags: ["vegetarian"],
    featured: true,
    realSize: [26, 26, 7],
    recommendations: ["cocktail"],
    tr: {
      name: {
        en: "Creamy burrata & heirloom tomatoes",
        es: "Burrata cremosa y tomates antiguos",
        it: "Burrata cremosa e pomodori antichi",
        de: "Cremige Burrata & alte Tomatensorten",
        pt: "Burrata cremosa e tomates antigos",
        ar: "بوراتا كريمية مع طماطم تقليدية",
        zh: "奶香布拉塔配传统番茄",
        ja: "クリーミーなブッラータと在来種トマト",
      },
      description: {
        en: "Burrata from Apulia, seasonal heirloom tomatoes, fresh basil and extra virgin olive oil.",
        es: "Burrata de Apulia, tomates antiguos de temporada, albahaca fresca y aceite de oliva virgen extra.",
        it: "Burrata pugliese, pomodori antichi di stagione, basilico fresco e olio extravergine d'oliva.",
        de: "Burrata aus Apulien, saisonale alte Tomatensorten, frisches Basilikum und natives Olivenöl extra.",
        pt: "Burrata da Apúlia, tomates antigos da época, manjericão fresco e azeite virgem extra.",
        ar: "بوراتا من منطقة بوليا، طماطم موسمية تقليدية، ريحان طازج وزيت زيتون بكر ممتاز.",
        zh: "普利亚布拉塔奶酪、当季传统番茄、新鲜罗勒与特级初榨橄榄油。",
        ja: "プーリア産ブッラータ、旬の在来種トマト、フレッシュバジル、エクストラバージンオリーブオイル。",
      },
    },
  },
  {
    key: "tartare",
    category: "entrees",
    name: "Tartare de saumon, avocat & citron vert",
    description: "Saumon frais taillé au couteau, avocat, zestes de citron vert et jeunes pousses.",
    priceCents: 1300,
    photo: "tartare-saumon",
    allergens: ["fish"],
    tags: ["new"],
    tr: {
      name: { en: "Salmon tartare, avocado & lime", es: "Tartar de salmón, aguacate y lima", it: "Tartare di salmone, avocado e lime", de: "Lachstatar mit Avocado & Limette", pt: "Tártaro de salmão, abacate e lima", ar: "تارتار السلمون مع الأفوكادو والليمون الأخضر", zh: "三文鱼塔塔配牛油果与青柠", ja: "サーモンのタルタル アボカドとライム" },
      description: {
        en: "Hand-cut fresh salmon, avocado, lime zest and baby greens.",
        es: "Salmón fresco cortado a cuchillo, aguacate, ralladura de lima y brotes tiernos.",
        it: "Salmone fresco tagliato al coltello, avocado, scorza di lime e germogli.",
        de: "Frischer, von Hand geschnittener Lachs, Avocado, Limettenzesten und junge Blätter.",
        pt: "Salmão fresco cortado à faca, abacate, raspas de lima e rebentos.",
        ar: "سلمون طازج مقطّع يدويًا، أفوكادو، قشر الليمون الأخضر وأوراق صغيرة.",
        zh: "手切新鲜三文鱼、牛油果、青柠皮与嫩叶。",
        ja: "手切りの生サーモン、アボカド、ライムの皮、ベビーリーフ。",
      },
    },
  },
  {
    key: "veloute",
    category: "entrees",
    name: "Velouté de potimarron, éclats de noisettes",
    description: "Potimarron rôti, crème légère, noisettes torréfiées et ciboulette.",
    priceCents: 950,
    photo: "veloute-potimarron",
    allergens: ["milk", "nuts"],
    tags: ["vegetarian", "homemade"],
    tr: {
      name: { en: "Butternut velouté with hazelnuts", es: "Crema de calabaza con avellanas", it: "Vellutata di zucca con nocciole", de: "Kürbiscremesuppe mit Haselnüssen", pt: "Creme de abóbora com avelãs", ar: "حساء اليقطين الكريمي مع البندق", zh: "南瓜浓汤配榛子碎", ja: "かぼちゃのポタージュ ヘーゼルナッツ添え" },
      description: {
        en: "Roasted squash, light cream, toasted hazelnuts and chives.",
        es: "Calabaza asada, nata ligera, avellanas tostadas y cebollino.",
        it: "Zucca arrosto, panna leggera, nocciole tostate ed erba cipollina.",
        de: "Gerösteter Kürbis, leichte Sahne, geröstete Haselnüsse und Schnittlauch.",
        pt: "Abóbora assada, natas leves, avelãs torradas e cebolinho.",
        ar: "يقطين محمّص، كريمة خفيفة، بندق محمّص وثوم معمّر.",
        zh: "烤南瓜、淡奶油、烘烤榛子与细香葱。",
        ja: "ローストかぼちゃ、軽いクリーム、ローストヘーゼルナッツ、チャイブ。",
      },
    },
  },
  {
    key: "burger",
    category: "plats",
    name: "Burger signature",
    description: "Pain brioché toasté, bœuf haché minute, cheddar affiné, oignons rouges, tomate, salade croquante et sauce maison. Servi avec des frites maison.",
    priceCents: 1900,
    model: "burger-signature",
    photo: "burger-signature",
    allergens: ["gluten", "milk", "eggs", "mustard", "sesame"],
    tags: ["signature", "homemade"],
    featured: true,
    realSize: [26, 26, 11],
    recommendations: ["cocktail", "fondant"],
    tr: {
      name: {
        en: "Signature burger",
        es: "Hamburguesa de la casa",
        it: "Burger signature",
        de: "Signature-Burger",
        pt: "Hambúrguer da casa",
        ar: "برغر المطعم المميز",
        zh: "招牌汉堡",
        ja: "シグネチャーバーガー",
      },
      description: {
        en: "Toasted brioche bun, freshly ground beef, aged cheddar, red onion, tomato, crisp lettuce and house sauce. Served with homemade fries.",
        es: "Pan brioche tostado, carne de ternera picada al momento, cheddar curado, cebolla morada, tomate, lechuga crujiente y salsa de la casa. Servida con patatas fritas caseras.",
        it: "Pane brioche tostato, manzo macinato al momento, cheddar stagionato, cipolla rossa, pomodoro, insalata croccante e salsa della casa. Servito con patatine fritte fatte in casa.",
        de: "Getoastetes Brioche-Brötchen, frisch gehacktes Rindfleisch, gereifter Cheddar, rote Zwiebeln, Tomate, knackiger Salat und hausgemachte Sauce. Serviert mit hausgemachten Pommes frites.",
        pt: "Pão brioche tostado, carne de vaca picada na hora, cheddar curado, cebola roxa, tomate, alface estaladiça e molho da casa. Servido com batatas fritas caseiras.",
        ar: "خبز بريوش محمّص، لحم بقري مفروم طازجًا، جبن شيدر معتّق، بصل أحمر، طماطم، خس مقرمش وصلصة المطعم. يُقدَّم مع بطاطس مقلية منزلية الصنع.",
        zh: "烤布里欧修面包、现绞牛肉饼、陈年切达奶酪、红洋葱、番茄、爽脆生菜与自制酱汁。配自制薯条。",
        ja: "トーストしたブリオッシュバンズ、挽きたての牛肉、熟成チェダー、紫玉ねぎ、トマト、シャキシャキのレタス、自家製ソース。自家製フライドポテト添え。",
      },
    },
  },
  {
    key: "pizza",
    category: "plats",
    name: "Pizza Margherita",
    description: "Pâte maturée 48 h, sauce tomate, mozzarella fior di latte et basilic frais.",
    priceCents: 1500,
    model: "pizza-margherita",
    photo: "pizza-margherita",
    allergens: ["gluten", "milk"],
    tags: ["vegetarian"],
    realSize: [34, 34, 4],
    recommendations: ["cocktail", "tiramisu"],
    tr: {
      name: { en: "Margherita pizza", es: "Pizza Margarita", it: "Pizza Margherita", de: "Pizza Margherita", pt: "Pizza Margherita", ar: "بيتزا مارغريتا", zh: "玛格丽特披萨", ja: "マルゲリータ" },
      description: {
        en: "48-hour matured dough, tomato sauce, fior di latte mozzarella and fresh basil.",
        es: "Masa madurada 48 h, salsa de tomate, mozzarella fior di latte y albahaca fresca.",
        it: "Impasto maturato 48 ore, salsa di pomodoro, mozzarella fior di latte e basilico fresco.",
        de: "48 Stunden gereifter Teig, Tomatensauce, Fior-di-Latte-Mozzarella und frisches Basilikum.",
        pt: "Massa maturada 48 h, molho de tomate, mozzarella fior di latte e manjericão fresco.",
        ar: "عجينة مخمّرة لمدة 48 ساعة، صلصة طماطم، موزاريلا فيور دي لاتي وريحان طازج.",
        zh: "48 小时熟成面团、番茄酱、fior di latte 马苏里拉奶酪与新鲜罗勒。",
        ja: "48時間熟成生地、トマトソース、フィオル・ディ・ラッテのモッツァレラ、フレッシュバジル。",
      },
    },
  },
  {
    key: "risotto",
    category: "plats",
    name: "Risotto crémeux aux cèpes",
    description: "Riz carnaroli, cèpes poêlés, parmesan affiné 24 mois et persil frais.",
    priceCents: 2100,
    photo: "risotto-cepes",
    allergens: ["milk", "celery"],
    tags: ["vegetarian"],
    tr: {
      name: { en: "Creamy porcini risotto", es: "Risotto cremoso de boletus", it: "Risotto cremoso ai porcini", de: "Cremiges Steinpilzrisotto", pt: "Risoto cremoso de boletos", ar: "ريزوتو كريمي بفطر البورسيني", zh: "奶油牛肝菌烩饭", ja: "ポルチーニのクリーミーリゾット" },
      description: {
        en: "Carnaroli rice, pan-fried porcini, 24-month parmesan and fresh parsley.",
        es: "Arroz carnaroli, boletus salteados, parmesano curado 24 meses y perejil fresco.",
        it: "Riso carnaroli, porcini saltati, parmigiano stagionato 24 mesi e prezzemolo fresco.",
        de: "Carnaroli-Reis, gebratene Steinpilze, 24 Monate gereifter Parmesan und frische Petersilie.",
        pt: "Arroz carnaroli, boletos salteados, parmesão curado 24 meses e salsa fresca.",
        ar: "أرز كارنارولي، فطر بورسيني مقلي، بارميزان معتّق 24 شهرًا وبقدونس طازج.",
        zh: "卡纳罗利米、香煎牛肝菌、24个月熟成帕玛森与新鲜欧芹。",
        ja: "カルナローリ米、ソテーしたポルチーニ、24か月熟成パルメザン、フレッシュパセリ。",
      },
    },
  },
  {
    key: "fondant",
    category: "desserts",
    name: "Fondant au chocolat",
    description: "Cœur coulant au chocolat noir 70 %, glace vanille de Madagascar et framboises fraîches.",
    priceCents: 900,
    model: "fondant-chocolat",
    photo: "fondant-chocolat",
    allergens: ["gluten", "eggs", "milk"],
    tags: ["homemade"],
    featured: true,
    realSize: [22, 22, 8],
    recommendations: ["tiramisu"],
    tr: {
      name: {
        en: "Chocolate lava cake",
        es: "Coulant de chocolate",
        it: "Tortino al cioccolato dal cuore fondente",
        de: "Schokoladen-Lava-Küchlein",
        pt: "Petit gâteau de chocolate",
        ar: "كعكة الشوكولاتة الذائبة",
        zh: "熔岩巧克力蛋糕",
        ja: "フォンダンショコラ",
      },
      description: {
        en: "Molten 70% dark chocolate centre, Madagascar vanilla ice cream and fresh raspberries.",
        es: "Corazón fundente de chocolate negro 70 %, helado de vainilla de Madagascar y frambuesas frescas.",
        it: "Cuore fondente al cioccolato fondente 70%, gelato alla vaniglia del Madagascar e lamponi freschi.",
        de: "Flüssiger Kern aus 70 % Zartbitterschokolade, Madagaskar-Vanilleeis und frische Himbeeren.",
        pt: "Interior cremoso de chocolate negro 70%, gelado de baunilha de Madagáscar e framboesas frescas.",
        ar: "قلب ذائب من الشوكولاتة الداكنة 70%، مع آيس كريم فانيليا مدغشقر وتوت العليق الطازج.",
        zh: "70% 黑巧克力流心，配马达加斯加香草冰淇淋与新鲜覆盆子。",
        ja: "カカオ70%のとろけるダークチョコレート、マダガスカル産バニラアイス、フレッシュラズベリー添え。",
      },
    },
  },
  {
    key: "tiramisu",
    category: "desserts",
    name: "Tiramisu maison",
    description: "Biscuits imbibés de café, crème au mascarpone et cacao amer.",
    priceCents: 850,
    model: "tiramisu",
    photo: "tiramisu",
    allergens: ["gluten", "eggs", "milk"],
    tags: ["homemade"],
    realSize: [22, 22, 7],
    recommendations: ["fondant"],
    tr: {
      name: { en: "Homemade tiramisu", es: "Tiramisú casero", it: "Tiramisù della casa", de: "Hausgemachtes Tiramisu", pt: "Tiramisu caseiro", ar: "تيراميسو محضّر في المطعم", zh: "自制提拉米苏", ja: "自家製ティラミス" },
      description: {
        en: "Coffee-soaked ladyfingers, mascarpone cream and bitter cocoa.",
        es: "Bizcochos empapados en café, crema de mascarpone y cacao amargo.",
        it: "Savoiardi inzuppati nel caffè, crema al mascarpone e cacao amaro.",
        de: "In Kaffee getränkte Löffelbiskuits, Mascarpone-Creme und herber Kakao.",
        pt: "Palitos la reine embebidos em café, creme de mascarpone e cacau amargo.",
        ar: "بسكويت مشبّع بالقهوة، كريمة الماسكاربوني وكاكاو مرّ.",
        zh: "浸透咖啡的手指饼干、马斯卡彭奶油与苦可可粉。",
        ja: "コーヒーを染み込ませたビスケット、マスカルポーネクリーム、ビターココア。",
      },
    },
  },
  {
    key: "cocktail",
    category: "boissons",
    name: "Cocktail agrumes",
    description: "Création sans alcool : orange sanguine, pamplemousse, citron vert et sirop de romarin.",
    priceCents: 900,
    model: "cocktail-agrumes",
    photo: "cocktail-agrumes",
    tags: ["new"],
    realSize: [11, 11, 15],
    tr: {
      name: { en: "Citrus cocktail", es: "Cóctel de cítricos", it: "Cocktail agli agrumi", de: "Zitrus-Cocktail", pt: "Cocktail de citrinos", ar: "كوكتيل الحمضيات", zh: "柑橘鸡尾酒", ja: "シトラスカクテル" },
      description: {
        en: "Alcohol-free creation: blood orange, grapefruit, lime and rosemary syrup.",
        es: "Creación sin alcohol: naranja sanguina, pomelo, lima y sirope de romero.",
        it: "Creazione analcolica: arancia rossa, pompelmo, lime e sciroppo al rosmarino.",
        de: "Alkoholfreie Kreation: Blutorange, Grapefruit, Limette und Rosmarinsirup.",
        pt: "Criação sem álcool: laranja sanguínea, toranja, lima e xarope de alecrim.",
        ar: "مشروب بدون كحول: برتقال أحمر، جريب فروت، ليمون أخضر وشراب إكليل الجبل.",
        zh: "无酒精特调：血橙、西柚、青柠与迷迭香糖浆。",
        ja: "ノンアルコール：ブラッドオレンジ、グレープフルーツ、ライム、ローズマリーシロップ。",
      },
    },
  },
  {
    key: "citronnade",
    category: "boissons",
    name: "Citronnade maison",
    description: "Citrons pressés, menthe fraîche, peu sucrée.",
    priceCents: 500,
    tags: ["homemade"],
    tr: {
      name: { en: "Homemade lemonade", es: "Limonada casera", it: "Limonata della casa", de: "Hausgemachte Limonade", pt: "Limonada caseira", ar: "ليموناضة محضّرة في المطعم", zh: "自制柠檬水", ja: "自家製レモネード" },
      description: {
        en: "Freshly squeezed lemons, fresh mint, lightly sweetened.",
        es: "Limones exprimidos, menta fresca, poco azucarada.",
        it: "Limoni spremuti, menta fresca, poco zuccherata.",
        de: "Frisch gepresste Zitronen, frische Minze, wenig gesüßt.",
        pt: "Limões espremidos, hortelã fresca, pouco açucarada.",
        ar: "ليمون معصور طازجًا، نعناع طازج، قليلة السكر.",
        zh: "鲜榨柠檬、新鲜薄荷，微甜。",
        ja: "搾りたてレモンとフレッシュミント、甘さ控えめ。",
      },
    },
  },
  {
    key: "vin",
    category: "boissons",
    name: "Vin rouge de la maison",
    description: "Sélection du moment, à demander à l'équipe.",
    variants: [
      { label: "Verre 12 cl", priceCents: 600, tr: { en: "Glass 12 cl", es: "Copa 12 cl", it: "Calice 12 cl", de: "Glas 12 cl", pt: "Copo 12 cl", ar: "كأس 12 سل", zh: "杯装 12 厘升", ja: "グラス 12cl" } },
      { label: "Bouteille 75 cl", priceCents: 2800, tr: { en: "Bottle 75 cl", es: "Botella 75 cl", it: "Bottiglia 75 cl", de: "Flasche 75 cl", pt: "Garrafa 75 cl", ar: "زجاجة 75 سل", zh: "瓶装 75 厘升", ja: "ボトル 75cl" } },
    ],
    allergens: ["sulphites"],
    tr: {
      name: { en: "House red wine", es: "Vino tinto de la casa", it: "Vino rosso della casa", de: "Hausrotwein", pt: "Vinho tinto da casa", ar: "نبيذ أحمر", zh: "店酿红葡萄酒", ja: "ハウスワイン（赤）" },
      description: {
        en: "Current selection, ask our staff.",
        es: "Selección del momento, consulta a nuestro equipo.",
        it: "Selezione del momento, chiedi al nostro staff.",
        de: "Aktuelle Auswahl, fragen Sie unser Team.",
        pt: "Seleção do momento, pergunte à nossa equipa.",
        ar: "اختيار الموسم، اسأل فريقنا.",
        zh: "当季精选，请咨询员工。",
        ja: "季節のセレクション。スタッフにお尋ねください。",
      },
    },
  },
  {
    key: "cafe",
    category: "boissons",
    name: "Café expresso",
    priceCents: 250,
    tr: { name: { en: "Espresso", es: "Café expreso", it: "Caffè espresso", de: "Espresso", pt: "Café expresso", ar: "قهوة إسبريسو", zh: "意式浓缩咖啡", ja: "エスプレッソ" } },
  },
];

/**
 * Plats RÉELS du restaurant Los Amigos, scannés en 3D (GLB + USDZ fournis par le restaurant).
 * Utilisés par la démo commerciale « demo-futuriste ». Prix, description et allergènes non
 * communiqués : ils restent vides plutôt qu'inventés. Les dimensions sont celles des modèles.
 */
export const LOS_AMIGOS_CATEGORIES = DEMO_CATEGORIES.filter((c) => c.key === "plats");

export const LOS_AMIGOS_DISHES: DemoDish[] = [
  {
    key: "los-amigos-burger",
    category: "plats",
    name: "Los Amigos Burger",
    model: "los-amigos-burger",
    photo: "los-amigos-burger",
    featured: true,
    realSize: [19.6, 19.7, 10.6],
    tr: {
      name: {
        en: "Los Amigos Burger",
        es: "Hamburguesa Los Amigos",
        it: "Burger Los Amigos",
        de: "Los Amigos Burger",
        pt: "Hambúrguer Los Amigos",
        ar: "برغر لوس أميغوس",
        zh: "Los Amigos 汉堡",
        ja: "ロス・アミーゴス・バーガー",
      },
    },
  },
  {
    key: "tacos-agneau",
    category: "plats",
    name: "Tacos d'agneau Los Amigos",
    model: "tacos-agneau",
    photo: "tacos-agneau",
    featured: true,
    realSize: [23.5, 11.2, 7.4],
    tr: {
      name: {
        en: "Los Amigos lamb tacos",
        es: "Tacos de cordero Los Amigos",
        it: "Tacos d'agnello Los Amigos",
        de: "Lamm-Tacos Los Amigos",
        pt: "Tacos de borrego Los Amigos",
        ar: "تاكو لحم الضأن لوس أميغوس",
        zh: "Los Amigos 羊肉塔可",
        ja: "ロス・アミーゴスのラム肉タコス",
      },
    },
  },
];
