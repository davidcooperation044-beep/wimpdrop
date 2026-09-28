-- =====================================================================
-- Backfill products.category + products.subcategory for existing products
-- Matches how supabase/functions/admin-products-import/index.ts stores data:
--   category    = site category (one of SHOP_CATEGORY_LABELS in js/main.js)
--   subcategory = the CJ / supplier category label
-- Existing rows still hold the CJ label in "category" and NULL in
-- "subcategory", so this moves the label to subcategory and sets a
-- proper site category.
--
-- 981 rows / 280 supplier products. Where the CJ label was meaningless
-- (Striped, Solid, Print, Lace, CJ Import, Home Office Storage, ...)
-- a label was assigned from the product name instead.
--
-- Result (category > subcategory (rows)):
--   Accessories            > Baby Accessories  (3)
--   Accessories            > Fashion Accessories  (10)
--   Accessories            > Girl Accessories  (9)
--   Accessories            > Hair Accessories  (6)
--   Accessories            > Jewelry & Keychains  (10)
--   Accessories            > Laptop Bags & Cases  (125)
--   Accessories            > Laptop Bags & Sleeves  (1)
--   Accessories            > Phone Cases  (20)
--   Automotive             > Helmet Headset  (19)
--   Automotive             > Motorcycle Accessories  (1)
--   Beauty & Personal Care > Health & Personal Care  (6)
--   Electronics            > Camera Accessories  (2)
--   Electronics            > Earphones & Headphones  (33)
--   Electronics            > Electronics Accessories  (1)
--   Electronics            > Laptop Batteries  (2)
--   Electronics            > Tablet Accessories  (70)
--   Electronics            > Tablet Cases  (109)
--   Essentials             > Adult Wellness  (8)
--   Essentials             > Baby Care  (2)
--   Fashion                > Baby Clothing Sets  (5)
--   Fashion                > Boy Clothing Sets  (48)
--   Fashion                > Cosplay Costumes  (10)
--   Fashion                > Costumes & Cosplay  (3)
--   Fashion                > Girl Clothing Sets  (50)
--   Fashion                > Hoodies & Sweatshirts  (1)
--   Fashion                > Lingerie & Sleepwear  (23)
--   Fashion                > Man Hoodies & Sweatshirts  (27)
--   Fashion                > Men's Jackets & Outerwear  (3)
--   Fashion                > Men's Shirts & Sets  (34)
--   Fashion                > Men's Sportswear  (56)
--   Fashion                > Parkas  (8)
--   Fashion                > T-Shirts & Tops  (3)
--   Fashion                > Woman Hoodies & Sweatshirts  (151)
--   Home & Kitchen         > Cooking Tools  (11)
--   Home & Kitchen         > Drinkware  (21)
--   Home & Kitchen         > Home Decor  (1)
--   Home & Kitchen         > Home Gadgets  (11)
--   Home & Kitchen         > Kitchen Knives & Accessories  (11)
--   Home & Kitchen         > Kitchen Storage  (23)
--   Home & Kitchen         > Kitchen Storage & Racks  (1)
--   Home & Kitchen         > Kitchen Tools & Gadgets  (4)
--   Home & Kitchen         > Pet Drinking Tools  (3)
--   Home & Kitchen         > Water Bottles & Drinkware  (10)
--   Office & Stationery    > Craft & DIY Supplies  (25)
--   Toys & Games           > Toys & Games  (1)
-- =====================================================================

BEGIN;

WITH map (supplier_product_id, category, subcategory) AS (
  VALUES
    ('9B3C9418-AD35-4B82-8955-3699396539A1', 'Accessories', 'Baby Accessories'),  -- Baby hair accessories [1] was: Baby Accessories
    ('632D4F76-7159-4FC7-919A-D62976E3BDBD', 'Accessories', 'Baby Accessories'),  -- Children's Hair Accessories [1] was: Baby Accessories
    ('4519902A-A223-4D89-9199-187E11E60418', 'Accessories', 'Baby Accessories'),  -- Hair accessories [1] was: Baby Accessories
    ('1668531120327106560', 'Accessories', 'Fashion Accessories'),  -- Accessories For Wristbands [1] was: Sports Accessories
    ('EE106340-89E7-4B86-A2EE-DC6624A86E61', 'Accessories', 'Fashion Accessories'),  -- Alien glasses [1] was: CJ Import
    ('6BB226A2-C0EA-4213-81FF-34064478E7AC', 'Accessories', 'Fashion Accessories'),  -- Creative pendant doll gadget [2] was: Home Office Storage
    ('1650683095546339328', 'Accessories', 'Fashion Accessories'),  -- Hole Shoes Removable Shoe Ornament Accessories San [1] was: Sports Accessories
    ('1457921467005145088', 'Accessories', 'Fashion Accessories'),  -- Irregular Lady Sunglasses Personality Design Face  [1] was: CJ Import
    ('1623526310360395776', 'Accessories', 'Fashion Accessories'),  -- Outdoor Knife Pendant Zinc Alloy Hand-knitted Acce [1] was: Sports Accessories
    ('B2D022BE-E162-4D08-BD86-E9B551D869AA', 'Accessories', 'Fashion Accessories'),  -- Plastic Oval Hanging Buckle Carabiner Hanging DIY  [1] was: Sports Accessories
    ('1393412556302979072', 'Accessories', 'Fashion Accessories'),  -- Rainbow Cherry Butterfly Patch Stickers Children's [1] was: Baby Accessories
    ('1717389034059735040', 'Accessories', 'Fashion Accessories'),  -- Shoe Accessories Shoe Buckle Hole Shoe Accessories [1] was: Sports Accessories
    ('2A86B3B2-A08B-461D-AA62-7A9DF0581271', 'Accessories', 'Girl Accessories'),  -- Bow hair accessories [8] was: Girl Accessories
    ('C72F24AA-C245-4AB1-8753-55156C88E6E3', 'Accessories', 'Girl Accessories'),  -- Children's hair accessories [1] was: Girl Accessories
    ('1703971839405465600', 'Accessories', 'Hair Accessories'),  -- 121523cm Hair Accessories Earrings Accessories Col [1] was: Sports Accessories
    ('1570227809837133824', 'Accessories', 'Hair Accessories'),  -- Vintage Rhinestone Headdress Crown Alloy Hair Acce [5] was: Sports Accessories
    ('1649630703967023104', 'Accessories', 'Jewelry & Keychains'),  -- Creative Lanyard Bracelet Weaving Materials [1] was: Home Office Storage
    ('C9DBC47C-B496-4669-84C0-26D99F9F5381', 'Accessories', 'Jewelry & Keychains'),  -- DIY jewelry accessories materials [1] was: Man Shorts
    ('1720377624368779264', 'Accessories', 'Jewelry & Keychains'),  -- Fashion Personalized Bracelet Materials Accessorie [1] was: Bracelets & Bangles
    ('1604345744872452096', 'Accessories', 'Jewelry & Keychains'),  -- Keychain Accessories Cute Flower Clothes Accessori [3] was: Sports Accessories
    ('1596705900990050304', 'Accessories', 'Jewelry & Keychains'),  -- Semi Finished Jewelry Accessories Materials [1] was: Home Office Storage
    ('2605130901091614900', 'Accessories', 'Jewelry & Keychains'),  -- Titanium Alloy Keychain EDC Gadget [1] was: Keychains
    ('2512120724451622400', 'Accessories', 'Jewelry & Keychains'),  -- Unisex Triple Protection Materials Bracelet [2] was: Bracelets & Bangles
    ('1843313494406877184', 'Accessories', 'Laptop Bags & Cases'),  -- 13-15.6 Inch Laptop Bag, Laptop Carrying Case Shou [1] was: Laptop Bags & Cases
    ('11585159-7A5C-46B0-AAC3-61E7C978E7A3', 'Accessories', 'Laptop Bags & Cases'),  -- Black and white laptop bag laptop protective cover [8] was: Laptop Bags & Cases
    ('3F2248B3-42FC-4464-BD83-B36C9326B57C', 'Accessories', 'Laptop Bags & Cases'),  -- Compatible with Apple , Laptop laptop bag [1] was: Laptop Bags & Cases
    ('283EDB2C-4281-4B10-AC68-3B636CE758A2', 'Accessories', 'Laptop Bags & Cases'),  -- Customization of laptop bag and laptop liner [1] was: Laptop Bags & Cases
    ('2603210818391630600', 'Accessories', 'Laptop Bags & Cases'),  -- Foldable Portable Laptop Sleeve [2] was: Laptop Bags & Cases
    ('7F2E940C-E136-47BD-BC86-B1CE523C2C3B', 'Accessories', 'Laptop Bags & Cases'),  -- Laptop Bag [1] was: Laptop Bags & Cases
    ('1378900957542354944', 'Accessories', 'Laptop Bags & Cases'),  -- Laptop Bag 14 Inch Laptop Bag Flat Liner Bag [1] was: Laptop Bags & Cases
    ('1794908912794214400', 'Accessories', 'Laptop Bags & Cases'),  -- Laptop Bag Simple Two Colors Waterproof Ipad Lapto [1] was: Laptop Bags & Cases
    ('1615965293552087040', 'Accessories', 'Laptop Bags & Cases'),  -- Laptop Case Tablet One Shoulder PU Leather Laptop [1] was: Laptop Bags & Cases
    ('16509F92-5C6C-4A66-8AF7-ADA7E43940AF', 'Accessories', 'Laptop Bags & Cases'),  -- Laptop bag [1] was: Laptop Bags & Cases
    ('F87841E3-6099-4C7A-979C-43BCFB50B73C', 'Accessories', 'Laptop Bags & Cases'),  -- Laptop bag laptop shoulder bag [19] was: Laptop Bags & Cases
    ('EC9FAC95-2EBF-4605-97BE-5B16D84832C0', 'Accessories', 'Laptop Bags & Cases'),  -- Laptop bag multifunction laptop bag tablet bag [82] was: Laptop Bags & Cases
    ('1605804720780750848', 'Accessories', 'Laptop Bags & Cases'),  -- Macbookpro Female Suitable Laptop Bag [1] was: Laptop Bags & Cases
    ('397AAFA9-D1B0-4B84-9A0C-D39C58B45044', 'Accessories', 'Laptop Bags & Cases'),  -- Official document liner laptop bag [1] was: Laptop Bags & Cases
    ('1385073904204255232', 'Accessories', 'Laptop Bags & Cases'),  -- Shockproof One-Shoulder Laptop Bag [1] was: Laptop Bags & Cases
    ('619E19D6-E2A7-4B00-8490-1DFAF8A4FEC1', 'Accessories', 'Laptop Bags & Cases'),  -- Shockproof portable laptop case [1] was: Laptop Bags & Cases
    ('DB857359-B497-4C40-A07D-1CCF71E968A0', 'Accessories', 'Laptop Bags & Cases'),  -- Universal Laptop Bag Case Business Laptop Case Lap [1] was: Laptop Bags & Cases
    ('2412220336441625200', 'Accessories', 'Laptop Bags & Cases'),  -- Women's Stylish Personalized Laptop Bag [1] was: Laptop Bags & Cases
    ('1718860198976167936', 'Accessories', 'Laptop Bags & Sleeves'),  -- Embroidered Laptop Tablet Liner Storage Bag [1] was: Tablet Accessories
    ('1397427680512708608', 'Accessories', 'Phone Cases'),  -- Cell Phone Case Cell Phone Leather Case Cell Phone [1] was: Leather Cases
    ('1356875251300044800', 'Accessories', 'Phone Cases'),  -- Compatible With  , Snap Phone Case [1] was: Patterned Cases
    ('1373870802373578752', 'Accessories', 'Phone Cases'),  -- Compatible with Apple , Glitter Marble Apple Phone [1] was: Cases For iPhone 8 & 8 Plus
    ('2410070231391614800', 'Accessories', 'Phone Cases'),  -- Magnetic Phone Case Lens Bracket Phone Case [1] was: Waterptoof Cases
    ('1724748449150668800', 'Accessories', 'Phone Cases'),  -- Magnetic Phone Case Wave Point Phone Case [1] was: Cases For iPhone 8 & 8 Plus
    ('1467428133157343232', 'Accessories', 'Phone Cases'),  -- Mobile Phone Case Double Card Phone Case [1] was: Leather Cases
    ('2505080642021625500', 'Accessories', 'Phone Cases'),  -- Mobile Phone Leather Case Phone Case [1] was: Leather Cases
    ('1789506349777301504', 'Accessories', 'Phone Cases'),  -- Mobile Phone Leather Case Phone Case [1] was: Silicone Cases
    ('2409230710401602900', 'Accessories', 'Phone Cases'),  -- New Girl Phone Case Phone Case [1] was: Silicone Cases
    ('1510595256222494720', 'Accessories', 'Phone Cases'),  -- Panda Magnetic Ring Holder Phone Case Cover [1] was: Waterptoof Cases
    ('2511270923081618800', 'Accessories', 'Phone Cases'),  -- Phone Case [1] was: Silicone Cases
    ('2511270957471605600', 'Accessories', 'Phone Cases'),  -- Phone Case [1] was: Silicone Cases
    ('2502120543011622900', 'Accessories', 'Phone Cases'),  -- Phone Case [1] was: Silicone Cases
    ('2511270926561605100', 'Accessories', 'Phone Cases'),  -- Phone Case [1] was: Silicone Cases
    ('1465594280130252800', 'Accessories', 'Phone Cases'),  -- Phone Case [1] was: Silicone Cases
    ('1501035259100672000', 'Accessories', 'Phone Cases'),  -- Quicksand Phone Case Colorful Plastic Shell Phone  [1] was: Leather Cases
    ('1398816627469979648', 'Accessories', 'Phone Cases'),  -- Sexy Beauty Phone Case Fashion Personalized Print  [1] was: Waterptoof Cases
    ('1398458094215892992', 'Accessories', 'Phone Cases'),  -- Wristband Phone Case Watercolor Phone Case [1] was: Silicone Cases
    ('2506130902241614600', 'Accessories', 'Phone Cases'),  -- ZFold6 Folding Phone Case Flip Leather Case Phone  [1] was: Silicone Cases
    ('1537724113467486208', 'Accessories', 'Phone Cases'),  -- Zipper Phone Case Phone Case Crossbody [1] was: Patterned Cases
    ('1397840159365533696', 'Automotive', 'Helmet Headset'),  -- Breathable Safety Anti-collision Windshield Electr [1] was: Helmet Headset
    ('2412040141401603200', 'Automotive', 'Helmet Headset'),  -- Children's Breathable Skateboard Electric Bike Hel [1] was: Helmet Headset
    ('1743480346672377856', 'Automotive', 'Helmet Headset'),  -- Cycling Bike Helmet Lining Universal Breathable Sp [1] was: Helmet Headset
    ('1420674276037627904', 'Automotive', 'Helmet Headset'),  -- Fashionable And Simple Ski Helmet Sports Equipment [1] was: Helmet Headset
    ('2604200435051618000', 'Automotive', 'Helmet Headset'),  -- Four-Season Unisex Electric Scooter Safety Helmet [1] was: Helmet Headset
    ('1371703389024555008', 'Automotive', 'Helmet Headset'),  -- Helmet Electric Car Lady Lovely Winter Model Four  [1] was: Helmet Headset
    ('2412050932291627000', 'Automotive', 'Helmet Headset'),  -- Helmet Headset Waterproof Bluetooth [1] was: Helmet Headset
    ('2512100718331631300', 'Automotive', 'Helmet Headset'),  -- Helmetbreathable Lightweight And Protective For Cy [1] was: Helmet Headset
    ('1366917689276239872', 'Automotive', 'Helmet Headset'),  -- Motorcycle Bicycle Helmet Tail Light Warning Light [1] was: Helmet Headset
    ('1377886215918981120', 'Automotive', 'Helmet Headset'),  -- Motorcycle Helmet Bluetooth Headset Wireless Built [1] was: Helmet Headset
    ('1603605829582860288', 'Automotive', 'Helmet Headset'),  -- Motorcycle Vintage Motorcycle Helmet [1] was: Helmet Headset
    ('5AE05230-5633-497E-B0CC-ECAC766C3BF9', 'Automotive', 'Helmet Headset'),  -- Mountain cross country bicycle full helmet extreme [1] was: Helmet Headset
    ('2408290113511612300', 'Automotive', 'Helmet Headset'),  -- New Motorcycle Helmet Chin Camera Integrated Helme [1] was: Helmet Headset
    ('1453642686060957696', 'Automotive', 'Helmet Headset'),  -- Outdoor Funny Santa Claus Motorcycle Helmet Hood [1] was: Helmet Headset
    ('2508180950131617800', 'Automotive', 'Helmet Headset'),  -- Personalized American Japanese Retro Half Helmet [1] was: Helmet Headset
    ('2507060851481622100', 'Automotive', 'Helmet Headset'),  -- Sun Protection Four Seasons Universal Helmet Motor [1] was: Helmet Headset
    ('2411280258461628900', 'Automotive', 'Helmet Headset'),  -- Warm Skiing Helmet Restraint Goggle Lenses [1] was: Helmet Headset
    ('5C760A80-18EE-4998-BBCD-E107F2967834', 'Automotive', 'Helmet Headset'),  -- Welder's special welding cap [1] was: Helmet Headset
    ('A31083F3-166F-4A7B-A063-001E99955099', 'Automotive', 'Helmet Headset'),  -- Windproof warm ear protection riding cap [1] was: Helmet Headset
    ('457ADC9E-0010-40A8-BB18-BE7D8A173AED', 'Automotive', 'Motorcycle Accessories'),  -- Motorcycle accessories [1] was: Other Motorcycle Accessories
    ('1355425396052594688', 'Beauty & Personal Care', 'Health & Personal Care'),  -- Dental Materials Accessories Oral Consumables [6] was: Home Office Storage
    ('B2E71441-BDAD-4866-B8BB-E6906F7FB267', 'Electronics', 'Camera Accessories'),  -- 4 Camera Accessories [1] was: Sports Accessories
    ('DB6A5E0A-BE3A-485E-8B61-69CDDABB1D99', 'Electronics', 'Camera Accessories'),  -- Sports camera accessories [1] was: Sports Accessories
    ('1790262176008118272', 'Electronics', 'Earphones & Headphones'),  -- 5.0 Headphones Stereo Sports Waterproof Bluetooth  [1] was: Earphones & Headphones
    ('79A31EF3-75D0-4FF1-8122-F20239FD0016', 'Electronics', 'Earphones & Headphones'),  -- Bluetooth Headphones Bone Conduction Headphones Ha [4] was: Earphones & Headphones
    ('93ABC975-32BB-43EB-8736-B4A7F4C8D779', 'Electronics', 'Earphones & Headphones'),  -- HeadPhones [1] was: Earphones & Headphones
    ('2512310637161621400', 'Electronics', 'Earphones & Headphones'),  -- Headphones [1] was: Earphones & Headphones
    ('93E76E44-CF98-4CFE-A4FD-EF7D1D8CE263', 'Electronics', 'Earphones & Headphones'),  -- Headphones Waterproof Sports Bluetooth Wireless He [1] was: Earphones & Headphones
    ('2F2382F8-CA47-43DA-8A9A-E23C0DD153B0', 'Electronics', 'Earphones & Headphones'),  -- Headset sports headphones gaming wired headphones [1] was: Earphones & Headphones
    ('CDE2149F-10B3-47DF-91A4-7FCD648D9D23', 'Electronics', 'Earphones & Headphones'),  -- K8 camouflage headphones [1] was: Earphones & Headphones
    ('1417096643475542016', 'Electronics', 'Earphones & Headphones'),  -- Metal Headphones Heat Tone In-ear Mobile Phone Hea [1] was: Earphones & Headphones
    ('64FCA37C-F1F4-47F3-B2F8-17F1BCD5FAB2', 'Electronics', 'Earphones & Headphones'),  -- OneOdio headphones [1] was: Earphones & Headphones
    ('30E5E0C7-BC24-471A-A7D9-4CBBBA11A70C', 'Electronics', 'Earphones & Headphones'),  -- Perfume music headphones [1] was: Earphones & Headphones
    ('1521744870518566912', 'Electronics', 'Earphones & Headphones'),  -- Rabbit Ear Headphones Wireless Luminous Extendable [1] was: Earphones & Headphones
    ('7F1DC4CC-9472-4C7E-9779-A35FEC54BB3C', 'Electronics', 'Earphones & Headphones'),  -- Ring Iron Headphones In-Ear Subwoofer Headphones [1] was: Earphones & Headphones
    ('2607280909141627600', 'Electronics', 'Earphones & Headphones'),  -- Silver Wired Headphones Retro Headphones [3] was: Earphones & Headphones
    ('1871435118365552642', 'Electronics', 'Earphones & Headphones'),  -- Stress Reducing Headphones, Children's Toy Headpho [1] was: Earphones & Headphones
    ('2608250141241604400', 'Electronics', 'Earphones & Headphones'),  -- Student Electronic Piano Guitar Headphones Rear-ha [1] was: Earphones & Headphones
    ('1419204834577485824', 'Electronics', 'Earphones & Headphones'),  -- TV Wireless Headphones On-ear Bass Headphones [1] was: Earphones & Headphones
    ('1471319268753805312', 'Electronics', 'Earphones & Headphones'),  -- Transparent Case For Airpods 2 3 Pro 1 Case PC Cle [5] was: Earphones & Headphones
    ('1357679491257864192', 'Electronics', 'Earphones & Headphones'),  -- Wire-Controlled Headphones With Mic Tuning Headpho [1] was: Earphones & Headphones
    ('B2B4FBBC-BED8-4910-AA6F-2186A3EF2B46', 'Electronics', 'Earphones & Headphones'),  -- Women's headphones [4] was: Earphones & Headphones
    ('90FC2379-AD85-485F-9E70-5ABB2F03AA63', 'Electronics', 'Earphones & Headphones'),  -- dynamic headphones [1] was: Earphones & Headphones
    ('13CC3784-4042-48B7-A514-92B51F62234B', 'Electronics', 'Earphones & Headphones'),  -- headphones [1] was: Earphones & Headphones
    ('1369482640121532416', 'Electronics', 'Electronics Accessories'),  -- 3D Printer Accessories T-shaped Trapezoid Screw [1] was: Home Electronic Accessories
    ('1647846352921038848', 'Electronics', 'Laptop Batteries'),  -- Laptop Battery MacBook ProMB985A1382 A1321 A1286 C [1] was: Laptop Batteries
    ('1772830419671588864', 'Electronics', 'Laptop Batteries'),  -- Suitable For A1707 And A1820 Laptop Batteries [1] was: Laptop Batteries
    ('135B7003-D0F2-4889-BAE1-7C17F1C6F966', 'Electronics', 'Tablet Accessories'),  -- Children's smart tablet [48] was: Tablet Accessories
    ('9A82DF8E-3AC9-457E-804D-B41D4CB2C1F3', 'Electronics', 'Tablet Accessories'),  -- Children's tablet learning machine [10] was: Tablet Accessories
    ('2604080315231602500', 'Electronics', 'Tablet Accessories'),  -- Foldable Height-adjustable Tablet Cooling Stand [1] was: Tablet Accessories
    ('725B058A-54D8-4240-A54F-9BACA3A7EBDF', 'Electronics', 'Tablet Accessories'),  -- Metal Foldable Tablet Computer Cooling Bracket [1] was: Tablet Accessories
    ('1429359148327374848', 'Electronics', 'Tablet Accessories'),  -- Multi Angle Adjustable Folding Tablet Support [3] was: Tablet Accessories
    ('762868E7-8FE0-486C-A7DF-A0AA6E84CD81', 'Electronics', 'Tablet Accessories'),  -- Multi-Language Export Event Gift Tablet [1] was: Tablet Accessories
    ('2511030849541627700', 'Electronics', 'Tablet Accessories'),  -- Stand Mobile Phone Notebook Tablet Universal [1] was: Tablet Accessories
    ('2602050812591604800', 'Electronics', 'Tablet Accessories'),  -- Suitable For Tablet Bluetooth Keyboard Cases [1] was: Tablet Accessories
    ('2411110710421620900', 'Electronics', 'Tablet Accessories'),  -- Suspension Magic Control Keyboard For Tablet Compu [1] was: Tablet Accessories
    ('1406124474654396416', 'Electronics', 'Tablet Accessories'),  -- Tablet Keyboard Computer Keyboard Tablet Computer  [1] was: Tablet Accessories
    ('30A3FE09-EFF6-4EF4-A194-88EB6FD19277', 'Electronics', 'Tablet Accessories'),  -- Tablet computer aluminum alloy bracket [1] was: Tablet Accessories
    ('99B14820-06C6-4DEA-B264-09C5A7F54E65', 'Electronics', 'Tablet Accessories'),  -- Tablet computer car holder [1] was: Tablet Accessories
    ('2504130818471616600', 'Electronics', 'Tablet Cases'),  -- Acrylic Transparent Tablet Protective Cover [66] was: Tablet Cases
    ('1601757603481268224', 'Electronics', 'Tablet Cases'),  -- Kraft Paper Pattern Tablet Case [1] was: Tablet Cases
    ('1497839280519778304', 'Electronics', 'Tablet Cases'),  -- Literary Avocado Tablet Silicone Protective Case [38] was: Tablet Cases
    ('3C0D0424-3716-4BE0-B913-58B89F5888E5', 'Electronics', 'Tablet Cases'),  -- Silicone case tablet case [1] was: Tablet Cases
    ('2601060820221605800', 'Electronics', 'Tablet Cases'),  -- Suitable For 101-inch Tablet Cases [1] was: Tablet Cases
    ('4C280460-B454-4F02-AB67-6AE7759966F0', 'Electronics', 'Tablet Cases'),  -- Tablet protection cover [1] was: Tablet Cases
    ('2607110505251637800', 'Electronics', 'Tablet Cases'),  -- Woven Texture Leather Tablet Case [1] was: Tablet Cases
    ('1697810990693363712', 'Essentials', 'Adult Wellness'),  -- Airplane Bottle Automatic Electric Telescopic Rota [1] was: CJ Import
    ('1642471804264517632', 'Essentials', 'Adult Wellness'),  -- Automatic Heating Electric Trainer [1] was: CJ Import
    ('1707704168900726784', 'Essentials', 'Adult Wellness'),  -- Binding Rope Japanese Tutorial Hemp Rope Props [1] was: CJ Import
    ('1700744088301080576', 'Essentials', 'Adult Wellness'),  -- Telescopic Rotating Pronunciation Vibration Hands- [1] was: CJ Import
    ('1689847077481754624', 'Essentials', 'Adult Wellness'),  -- Training Feather Tickling Feet  Toy [1] was: CJ Import
    ('1703972596062101504', 'Essentials', 'Adult Wellness'),  -- Whispering Vibration Breast Clip Going Out Wireles [2] was: CJ Import
    ('2041378461812707330', 'Essentials', 'Adult Wellness'),  -- Women's Masturbation Device Liquid Silicone Toy [1] was: CJ Import
    ('2607310305481608100', 'Essentials', 'Baby Care'),  -- Breastfeeding Gadget Nursing Pillow [1] was: Pillows
    ('2511271106391627900', 'Essentials', 'Baby Care'),  -- Newborn Baby Butt Washing Gadget [1] was: Bathroom Storage
    ('CAAFA914-E5B9-46EE-9C5E-C7813D152CA3', 'Fashion', 'Baby Clothing Sets'),  -- Baby clothing onesies [1] was: Baby Clothing Sets
    ('1632995079025602560', 'Fashion', 'Baby Clothing Sets'),  -- Children's Clothing Sports Basketball Wear Childre [1] was: Baby Clothing Sets
    ('1406157230390251520', 'Fashion', 'Baby Clothing Sets'),  -- Children's Photography Clothing Newborn Baby Theme [1] was: Baby Clothing Sets
    ('1601449422863478784', 'Fashion', 'Baby Clothing Sets'),  -- Fashionable Clothing Suit Baby Leisure Children's  [1] was: Baby Clothing Sets
    ('1406154504268812288', 'Fashion', 'Baby Clothing Sets'),  -- Newborn girl clothing [1] was: Baby Clothing Sets
    ('C54379F4-00FA-4AEC-8D0B-0FEE89373783', 'Fashion', 'Boy Clothing Sets'),  -- Boy's clothing [1] was: Boy Clothing Sets
    ('1769604114264104960', 'Fashion', 'Boy Clothing Sets'),  -- Boys Spring Clothing New Clothes Fashionable Hands [12] was: Boy Clothing Sets
    ('1467036534837481472', 'Fashion', 'Boy Clothing Sets'),  -- Children's Clothing Summer Clothing Baby Romper Bi [1] was: Boy Clothing Sets
    ('1397061832530857984', 'Fashion', 'Boy Clothing Sets'),  -- Children's Day Boys' Performance Costume Brave Lit [1] was: Boy Clothing Sets
    ('1777224877745909760', 'Fashion', 'Boy Clothing Sets'),  -- Children's Dress Autumn And Winter New Solid Color [16] was: Boy Clothing Sets
    ('90E3E713-3D58-4940-8377-2FC1CDE698D2', 'Fashion', 'Boy Clothing Sets'),  -- Cotton Children's Clothing Boys Autumn Clothing Su [10] was: Boy Clothing Sets
    ('B74943E4-57AF-4FBF-B7DE-995B416EEA44', 'Fashion', 'Boy Clothing Sets'),  -- Cute children's clothing [1] was: Boy Clothing Sets
    ('1406143692024188928', 'Fashion', 'Boy Clothing Sets'),  -- newborn clothing [6] was: Boy Clothing Sets
    ('1715961000551260160', 'Fashion', 'Cosplay Costumes'),  -- Parent-Child Men And Women Christmas Outfit Hallow [10] was: Cosplay Costumes
    ('1530092979627765760', 'Fashion', 'Costumes & Cosplay'),  -- European And American High-bright PVC Patent Leath [1] was: CJ Import
    ('2411141158351604400', 'Fashion', 'Costumes & Cosplay'),  -- Men's Ethnic Court Clothing Improved Fresh Clothin [1] was: Girl Clothing Sets
    ('1562036772035637248', 'Fashion', 'Costumes & Cosplay'),  -- Men's Stage Performance Props Bound Leather Clothe [1] was: CJ Import
    ('1448493108844171264', 'Fashion', 'Girl Clothing Sets'),  -- Baby Autumn Clothing Girls Autumn And Winter Cloth [1] was: Girl Clothing Sets
    ('1379372146152837120', 'Fashion', 'Girl Clothing Sets'),  -- Baby Jumpsuit, Cheongsam, Ancient Costume, Chinese [1] was: Girl Clothing Sets
    ('1698956574145912832', 'Fashion', 'Girl Clothing Sets'),  -- Children's Clothing Suit [1] was: Girl Clothing Sets
    ('9858433D-E8AF-4654-8D4F-822D1A94F08C', 'Fashion', 'Girl Clothing Sets'),  -- Children's clothing suits [27] was: Girl Clothing Sets
    ('82545021-7A94-436C-B729-A6A2878D01A9', 'Fashion', 'Girl Clothing Sets'),  -- Children's clothing suits [18] was: Girl Clothing Sets
    ('3C1F5393-39B2-405C-BF4E-4A0646092627', 'Fashion', 'Girl Clothing Sets'),  -- Girl clothing sets [1] was: Girl Clothing Sets
    ('2CD586EA-F964-4EB5-96DB-192BB73508BC', 'Fashion', 'Girl Clothing Sets'),  -- Girls Clothing Set [1] was: Girl Clothing Sets
    ('1737003112713433088', 'Fashion', 'Hoodies & Sweatshirts'),  -- 3D Digital Printed Hoodie With Hoodie [1] was: Blazers
    ('52C0C111-25A6-4A40-AAF0-B5526126A9E1', 'Fashion', 'Lingerie & Sleepwear'),  -- All-match Cross Strap Small Vest Tube Top Underwea [1] was: CJ Import
    ('1552636205710454784', 'Fashion', 'Lingerie & Sleepwear'),  -- Dead Reservoir Water Women's Erotic Lingerie Bodys [1] was: CJ Import
    ('1384816873387986944', 'Fashion', 'Lingerie & Sleepwear'),  -- Eyelash Lace Long Sleeve Nightgown & Belt Appealin [15] was: CJ Import
    ('1607623713975971840', 'Fashion', 'Lingerie & Sleepwear'),  -- Feminine Transparent Lovely Allure Bodysuit [1] was: CJ Import
    ('1637984313193017344', 'Fashion', 'Lingerie & Sleepwear'),  -- Lacquer Leather Cut-out Suspender Bra [1] was: CJ Import
    ('1548172355414011904', 'Fashion', 'Lingerie & Sleepwear'),  -- Men's Underwear Transparent Thong Breathable Mesh [1] was: CJ Import
    ('1412677231817396224', 'Fashion', 'Lingerie & Sleepwear'),  -- Sexy Lace Red Home Sexy Pajamas Can Be Worn Outsid [1] was: CJ Import
    ('1463418338150584320', 'Fashion', 'Lingerie & Sleepwear'),  -- Sexy Sexy Lingerie One-piece Christmas Outfit For  [1] was: Adult Wellness
    ('1613204783601561600', 'Fashion', 'Lingerie & Sleepwear'),  -- Strap Plush Rabbit Girl Underwear Uniform Set [1] was: CJ Import
    ('49F9EF3D-1A01-4780-AAC5-E963710BB9CA', 'Fashion', 'Man Hoodies & Sweatshirts'),  -- 3D Hoodie Horror Character Hoodie [1] was: Man Hoodies & Sweatshirts
    ('BE1CEE8F-FB1A-49FB-B48C-B4DABB810701', 'Fashion', 'Man Hoodies & Sweatshirts'),  -- Candy Color Hoodie [6] was: Man Hoodies & Sweatshirts
    ('47C9AA7A-EF6A-416B-B2B4-677428E8AA1A', 'Fashion', 'Man Hoodies & Sweatshirts'),  -- Hip Hop Hoodie Embroidered Hoodie [10] was: Man Hoodies & Sweatshirts
    ('2606210746061632600', 'Fashion', 'Man Hoodies & Sweatshirts'),  -- Hoodie [5] was: Man Hoodies & Sweatshirts
    ('2602100537511630500', 'Fashion', 'Man Hoodies & Sweatshirts'),  -- Hoodie [1] was: Man Hoodies & Sweatshirts
    ('5DD66B9F-AB67-47F5-A4B3-5896E05D12FD', 'Fashion', 'Man Hoodies & Sweatshirts'),  -- Hoodie Hoodie [1] was: Man Hoodies & Sweatshirts
    ('1477904990524805120', 'Fashion', 'Man Hoodies & Sweatshirts'),  -- Hoodie Skeleton Couple Pullover And Hoodie [1] was: Man Hoodies & Sweatshirts
    ('194E6E4C-1F54-4EF2-B5A4-7C834A1B984C', 'Fashion', 'Man Hoodies & Sweatshirts'),  -- Viking Odin Best Viking Tattoo 3D Hoodies Men Wome [1] was: Man Hoodies & Sweatshirts
    ('22C5F96C-1C91-4FF0-A638-EB3B485ED1A0', 'Fashion', 'Man Hoodies & Sweatshirts'),  -- Viking Odin Best Viking Tattoo 3D Hoodies Men/wome [1] was: Man Hoodies & Sweatshirts
    ('1654367705069264896', 'Fashion', 'Men''s Jackets & Outerwear'),  -- Men Uniform Professional Jacket Outfit Long Sleeve [1] was: Solid
    ('DA5E8FF4-369D-429E-907E-C5373B3F0C97', 'Fashion', 'Men''s Jackets & Outerwear'),  -- Men's Loose Casual Wool Cardigan For Men Wearing D [1] was: Solid
    ('1762294748506763264', 'Fashion', 'Men''s Jackets & Outerwear'),  -- Painting Do The Old Cowboy Jacket Ripped Denim Tro [1] was: Man Trench
    ('2509120606581619000', 'Fashion', 'Men''s Shirts & Sets'),  -- Beach Men And Women Short Sleeve Shirt Outfit [1] was: Men's Suits
    ('1683401819575296000', 'Fashion', 'Men''s Shirts & Sets'),  -- Fashion Men Summer Lapels Shirt Outfit [1] was: Solid
    ('2508140810101623300', 'Fashion', 'Men''s Shirts & Sets'),  -- Loose Long-sleeved Trousers Shirt Outfit Men [1] was: Men's Shirts
    ('1677224602940362752', 'Fashion', 'Men''s Shirts & Sets'),  -- Men's Summer Suit Fashion Loose Men 2 Pieces Outfi [29] was: Solid
    ('2411050600451605200', 'Fashion', 'Men''s Shirts & Sets'),  -- Retro Side Three Bar Stripes Short Sleeve Denim Sh [1] was: Man Jeans
    ('1773309152404709376', 'Fashion', 'Men''s Shirts & Sets'),  -- Spring And Summer Leisure Beach Style Shirt Outfit [1] was: Solid
    ('1681868503214731264', 'Fashion', 'Men''s Sportswear'),  -- Sports T Shirt Men Running Outfit [55] was: Striped
    ('2503130603231624900', 'Fashion', 'Men''s Sportswear'),  -- Summer Short-sleeved Cycling Outfit Suit Men [1] was: Sweatpants
    ('1658501596898144256', 'Fashion', 'Parkas'),  -- Jacket Light Cooked Autumn Outfit For Men [8] was: Parkas
    ('1539178106290974720', 'Fashion', 'T-Shirts & Tops'),  -- Men And Women Summer Street Loose Hip Hop T-shirt  [1] was: Women's Short-Sleeved Shirts
    ('513C2962-B03A-4FEA-9E6A-3204CD46296D', 'Fashion', 'T-Shirts & Tops'),  -- Men and women couple outfit bottoming shirt [1] was: Wool & Blends
    ('1513757196352499712', 'Fashion', 'T-Shirts & Tops'),  -- New Dad Outfit Long Sleeve T Shirt For Men Spring  [1] was: Print
    ('2505280550391613000', 'Fashion', 'Woman Hoodies & Sweatshirts'),  -- Digital Printing Hoodie Hoodie [99] was: Woman Hoodies & Sweatshirts
    ('1413014743584739328', 'Fashion', 'Woman Hoodies & Sweatshirts'),  -- Fleece Hoodie Loose Casual Hoodie [1] was: Woman Hoodies & Sweatshirts
    ('E683E3FE-E57F-4BC7-BF1F-D3F910555735', 'Fashion', 'Woman Hoodies & Sweatshirts'),  -- HOODIE ghost hand fleece hoodie [1] was: Woman Hoodies & Sweatshirts
    ('2606260730221623200', 'Fashion', 'Woman Hoodies & Sweatshirts'),  -- Hoodie [1] was: Woman Hoodies & Sweatshirts
    ('2504021222301615100', 'Fashion', 'Woman Hoodies & Sweatshirts'),  -- Hoodie [1] was: Print
    ('1849317999669825536', 'Fashion', 'Woman Hoodies & Sweatshirts'),  -- Hoodie [1] was: Woman Hoodies & Sweatshirts
    ('2601100337181636300', 'Fashion', 'Woman Hoodies & Sweatshirts'),  -- Hoodie [1] was: Woman Hoodies & Sweatshirts
    ('1672864710661779456', 'Fashion', 'Woman Hoodies & Sweatshirts'),  -- Hoodie Back Text Oversized Hoodie [1] was: Woman Hoodies & Sweatshirts
    ('2504270802191612800', 'Fashion', 'Woman Hoodies & Sweatshirts'),  -- New Hoodie Loose Hoodie [1] was: Woman Hoodies & Sweatshirts
    ('E2E9E6A3-8779-47DD-9EF9-4F7EC1E003F7', 'Fashion', 'Woman Hoodies & Sweatshirts'),  -- Printed hoodie hoodie [1] was: Woman Hoodies & Sweatshirts
    ('2408110937421623000', 'Fashion', 'Woman Hoodies & Sweatshirts'),  -- Women's Hoodie With Printed Hoodie [42] was: Woman Hoodies & Sweatshirts
    ('34B19165-8C26-4B59-9C96-84F07CD61DD4', 'Fashion', 'Woman Hoodies & Sweatshirts'),  -- hoodie sweatshirt hoodie sweatshirt [1] was: Woman Hoodies & Sweatshirts
    ('A10A46B2-82FC-4EC1-9628-7DA58349AE44', 'Home & Kitchen', 'Cooking Tools'),  -- Creative Kitchen Gadget Wooden Handle [1] was: Cooking Tools
    ('1375318304259969024', 'Home & Kitchen', 'Cooking Tools'),  -- Foldable Drain Filter Shelf Kitchen Drain Basket [9] was: Cooking Tools
    ('1397462194270113792', 'Home & Kitchen', 'Cooking Tools'),  -- Kitchen Utensils Shovel Spoon Set Non-stick Pan Ki [1] was: Cooking Tools
    ('1401066689642237952', 'Home & Kitchen', 'Drinkware'),  -- Bicycle Water Bottle Outdoor Sports Water Bottle 6 [3] was: Drinkware
    ('1398125695858774016', 'Home & Kitchen', 'Drinkware'),  -- Cold Water Bottle Large Capacity Glass Water Bottl [1] was: Drinkware
    ('2606131221091633000', 'Home & Kitchen', 'Drinkware'),  -- Fitness Water Bottle, Plastic Water Bottle [1] was: Drinkware
    ('683DD4D3-93E0-4EB4-BB77-6DDB8AD53D9F', 'Home & Kitchen', 'Drinkware'),  -- Glass water bottle [1] was: Drinkware
    ('1414408339592450048', 'Home & Kitchen', 'Drinkware'),  -- SOLO Cold Water Bottle Heat-resistant Glass Cold W [7] was: Drinkware
    ('E5D3BA34-6A49-4F7F-A6B1-CB91559E2D3B', 'Home & Kitchen', 'Drinkware'),  -- Silicone Folding Water Bottle Food Grade Silicone  [1] was: Drinkware
    ('0E46F273-A419-419E-A29F-E64B70742B05', 'Home & Kitchen', 'Drinkware'),  -- Travel Folding Silicone Water Bottle Touch Smart W [4] was: Drinkware
    ('530B2252-8782-4D30-B6CA-6906E99BEBEC', 'Home & Kitchen', 'Drinkware'),  -- Water Bottle Buckle [1] was: Drinkware
    ('1382984013530140672', 'Home & Kitchen', 'Drinkware'),  -- Water bottle set handy cup juice cold water bottle [1] was: Drinkware
    ('1781515956213264384', 'Home & Kitchen', 'Drinkware'),  -- Yoga Water Bottle, Massage Sports Water Bottle [1] was: Drinkware
    ('1388086486385168384', 'Home & Kitchen', 'Home Decor'),  -- Nordic Resin Handmade Old Crafts [1] was: Helmet Headset
    ('2608170755231609800', 'Home & Kitchen', 'Home Gadgets'),  -- Household Fly Bait Gadget [1] was: Home Office Storage
    ('2504200930421609100', 'Home & Kitchen', 'Home Gadgets'),  -- Household High Voltage Mouse Gadget [2] was: Home Office Storage
    ('2607080339521613200', 'Home & Kitchen', 'Home Gadgets'),  -- Household Knife Cutter Medicinal Materials [1] was: Home Office Storage
    ('1686632061840404480', 'Home & Kitchen', 'Home Gadgets'),  -- Medicine Dispenser Home Gadget Portable [2] was: Home Office Storage
    ('2608270033121625200', 'Home & Kitchen', 'Home Gadgets'),  -- Multifunctional Electric Foot-Warming Gadget [1] was: Home Office Storage
    ('5016CA4A-BFCC-46E8-BFF7-CF98B7EC126A', 'Home & Kitchen', 'Home Gadgets'),  -- Portable emergency gadget [1] was: Home Office Storage
    ('1374191847693488128', 'Home & Kitchen', 'Home Gadgets'),  -- Silicone Rubber Water-Filled Hot Water Bottle Plas [1] was: Home Office Storage
    ('1372475455868899328', 'Home & Kitchen', 'Home Gadgets'),  -- Tea craft accessories [1] was: Home Office Storage
    ('4978336F-15C5-476B-BFE8-C907659B70BB', 'Home & Kitchen', 'Home Gadgets'),  -- Temporary Metal Waterproof Key Box At The Door [1] was: CJ Import
    ('639A1CD8-491D-4B70-9F6D-7B75EA5B123B', 'Home & Kitchen', 'Kitchen Knives & Accessories'),  -- Creative Kitchen Knife And Fork Chopsticks Cleanin [1] was: Kitchen Knives & Accessories
    ('484F86B5-7D55-4670-AB28-C1F6F94D04FC', 'Home & Kitchen', 'Kitchen Knives & Accessories'),  -- Juicer accessories [1] was: Kitchen Knives & Accessories
    ('1745344840134569984', 'Home & Kitchen', 'Kitchen Knives & Accessories'),  -- Kitchen Gadget Garlic Press [1] was: Kitchen Knives & Accessories
    ('1366580553209483264', 'Home & Kitchen', 'Kitchen Knives & Accessories'),  -- Kitchen Household Peeler Gadget Copper Plating Set [7] was: Kitchen Knives & Accessories
    ('2607150513181615600', 'Home & Kitchen', 'Kitchen Knives & Accessories'),  -- Waterproof Electric Fish-Scaling Gadget [1] was: Kitchen Knives & Accessories
    ('2509010144501616100', 'Home & Kitchen', 'Kitchen Storage'),  -- Banana Grinder Home Kitchen Gadget [1] was: Kitchen Storage
    ('1364818511989444608', 'Home & Kitchen', 'Kitchen Storage'),  -- Creative Plastic Fruit Coring Gadget [1] was: Kitchen Storage
    ('1644262219691069440', 'Home & Kitchen', 'Kitchen Storage'),  -- Damascus Leather Steel Kitchen Stainless Steel Kit [1] was: Kitchen Storage
    ('1363084216979558400', 'Home & Kitchen', 'Kitchen Storage'),  -- Food Grade Plastic Butter Knife Kitchen Gadget Che [1] was: Kitchen Storage
    ('1364399905883426816', 'Home & Kitchen', 'Kitchen Storage'),  -- Home Kitchen Gourmet Napkin Tea Towel Kitchen Towe [1] was: Kitchen Storage
    ('1425661442689994752', 'Home & Kitchen', 'Kitchen Storage'),  -- Household Kitchen Scissors Chicken Bone Kitchen Fo [1] was: Kitchen Storage
    ('2410251047471621700', 'Home & Kitchen', 'Kitchen Storage'),  -- Kitchen Electronic Measuring Cup Multifunctional K [1] was: Kitchen Storage
    ('1876836104507744257', 'Home & Kitchen', 'Kitchen Storage'),  -- Kitchen Organizer [1] was: Kitchen Storage
    ('1775133424613855232', 'Home & Kitchen', 'Kitchen Storage'),  -- Kitchen Rack For Seasoning Multi-layer Storage Kit [1] was: Kitchen Storage
    ('1631950009329528832', 'Home & Kitchen', 'Kitchen Storage'),  -- Kitchen Storage Shelving Kitchen Supplies Storage  [1] was: Kitchen Storage
    ('2410121221051628400', 'Home & Kitchen', 'Kitchen Storage'),  -- Kitchen Wipes Kitchen Countertop Stove Oven Multif [1] was: Kitchen Storage
    ('5BC022FA-17CB-4C5A-8188-AFB724694036', 'Home & Kitchen', 'Kitchen Storage'),  -- Kitchen cutter chopper [1] was: Kitchen Storage
    ('BDA5DA20-4E9B-4C7B-B1CE-24F004759E4E', 'Home & Kitchen', 'Kitchen Storage'),  -- Kitchen faucet filter [6] was: Kitchen Storage
    ('913315A6-6AFF-4C21-A60B-8BEAD5115B44', 'Home & Kitchen', 'Kitchen Storage'),  -- Kitchen supplies kitchen knife rack [1] was: Kitchen Storage
    ('32FBDFDA-49AA-47D3-9A99-0CB49869057D', 'Home & Kitchen', 'Kitchen Storage'),  -- Stainless steel electric grinder kitchen tool kitc [1] was: Kitchen Storage
    ('B5B9F0C8-FD52-4F45-ADAA-12670D8B4831', 'Home & Kitchen', 'Kitchen Storage'),  -- Tableware Storage Holders Kitchen Knife Plastic St [1] was: Kitchen Storage
    ('AFB2A829-31B2-48C2-B5A6-15017ABD5499', 'Home & Kitchen', 'Kitchen Storage'),  -- Telescopic kitchen rack kitchen supplies rack [1] was: Kitchen Storage
    ('D5AA3E92-AA73-480F-A237-ED586BC4CCF8', 'Home & Kitchen', 'Kitchen Storage'),  -- kitchen bundle [1] was: Kitchen Storage
    ('1431501031333826560', 'Home & Kitchen', 'Kitchen Storage & Racks'),  -- Kitchen Magnetic Gadget Storage Rack [1] was: Home Office Storage
    ('2078958761803030530', 'Home & Kitchen', 'Kitchen Tools & Gadgets'),  -- Dish Drying Mats For Kitchen Counter-Silicone Dish [1] was: Kitchen Appliances
    ('1706149309923729408', 'Home & Kitchen', 'Kitchen Tools & Gadgets'),  -- New Kitchen Gadget Dumpling Mold [1] was: Sports Accessories
    ('2609260716081607100', 'Home & Kitchen', 'Kitchen Tools & Gadgets'),  -- Plastic Wrap Cutter Kitchen Gadget [1] was: Home Office Storage
    ('2411050901171607900', 'Home & Kitchen', 'Kitchen Tools & Gadgets'),  -- Stainless Steel Peeler Kitchen Gadget [1] was: Home Office Storage
    ('954BE26C-4412-4494-866B-0B076AD68E7A', 'Home & Kitchen', 'Pet Drinking Tools'),  -- 500L Pet Water Bottle Travel Sports Drinking Water [2] was: Pet Drinking Tools
    ('1544131551859060736', 'Home & Kitchen', 'Pet Drinking Tools'),  -- Pet Water Bottle Travel Bottle Pet Cat And Dog Wat [1] was: Pet Drinking Tools
    ('61BDBF2C-3880-496C-AE69-A0F178DA5D67', 'Home & Kitchen', 'Water Bottles & Drinkware'),  -- Bike Water Bottle [4] was: Sports Accessories
    ('BC8B7D56-7A95-4831-A272-A33D4CFBF6DA', 'Home & Kitchen', 'Water Bottles & Drinkware'),  -- Cold water bottle glass water bottle [1] was: Home Office Storage
    ('1402228088976314368', 'Home & Kitchen', 'Water Bottles & Drinkware'),  -- Mountain Bike Riding Water Bottle Outdoor Sports W [1] was: Home Office Storage
    ('2408060216211627400', 'Home & Kitchen', 'Water Bottles & Drinkware'),  -- Sports Outdoor Water Bottle Silicone Mineral Water [1] was: Camping & Hiking
    ('1602120214928838656', 'Home & Kitchen', 'Water Bottles & Drinkware'),  -- Water Bottle Holder Water Bottle Carrier With Adju [1] was: Shoulder Bags
    ('1434706091601694720', 'Home & Kitchen', 'Water Bottles & Drinkware'),  -- Water Glass Straw Water Bottle With Scaled Materia [1] was: Kitchen Storage
    ('1421319179453206528', 'Home & Kitchen', 'Water Bottles & Drinkware'),  -- Wholesale GIANT Giant Water Bottle Mountain Road C [1] was: Home Office Storage
    ('1412294456920641536', 'Office & Stationery', 'Craft & DIY Supplies'),  -- Aromatherapy Candle Making Materials Tools Materia [3] was: Home Office Storage
    ('1642356972177592320', 'Office & Stationery', 'Craft & DIY Supplies'),  -- Art And Vintage Decorative Materials [1] was: Home Office Storage
    ('1431432710664097792', 'Office & Stationery', 'Craft & DIY Supplies'),  -- Ceiling Layout Decoration Materials [1] was: Home Office Storage
    ('2512121248581623900', 'Office & Stationery', 'Craft & DIY Supplies'),  -- Christmas Bouquet Materials [1] was: Home Office Storage
    ('F4F4CB98-12B2-4A5E-AF05-30D2C1CAE9EA', 'Office & Stationery', 'Craft & DIY Supplies'),  -- Diamond Paintings Materials Diamonds [1] was: Diamond Painting Cross Stitch
    ('2606190332581629700', 'Office & Stationery', 'Craft & DIY Supplies'),  -- Handmade DIY Materials Corrugated Paper [1] was: Home Office Storage
    ('77CAB35A-98E7-407A-8153-A45B676A6D5E', 'Office & Stationery', 'Craft & DIY Supplies'),  -- Handmade lantern making diy materials [1] was: Lace
    ('C9B56FC2-D7B1-40B7-AB04-DA5F8628ACE3', 'Office & Stationery', 'Craft & DIY Supplies'),  -- Ink painting kit materials [1] was: Home Office Storage
    ('A3894A66-E38F-47A5-887B-43C1C697ADBE', 'Office & Stationery', 'Craft & DIY Supplies'),  -- Lovely color printing materials [12] was: Home Office Storage
    ('1586708547969232896', 'Office & Stationery', 'Craft & DIY Supplies'),  -- Mark Diary Stationery Materials Collage [1] was: Home Office Storage
    ('1646029541414023168', 'Office & Stationery', 'Craft & DIY Supplies'),  -- Note Taking Tool Materials Gift [1] was: Home Office Storage
    ('1626040114147241984', 'Office & Stationery', 'Craft & DIY Supplies'),  -- Outdoor Photo Advertising Materials Poster Spray P [1] was: Apparel Sewing & Fabric
    ('2608140156231602700', 'Toys & Games', 'Toys & Games')  -- Childrens Toys Montessori Educational Materials [1] was: Action & Toy Figures
)
UPDATE public.products p
SET    category    = m.category,
       subcategory = m.subcategory,
       updated_at  = now()
FROM   map m
WHERE  p.supplier = 'cj'
  AND  p.supplier_product_id = m.supplier_product_id
  AND  p.subcategory IS NULL;      -- skips anything already set; safe to re-run

-- Checks: expect 0 rows with NULL subcategory
SELECT count(*) AS still_null FROM public.products WHERE subcategory IS NULL;
SELECT category, subcategory, count(*) FROM public.products GROUP BY 1,2 ORDER BY 1,2;

COMMIT;   -- or ROLLBACK; if the counts look wrong